"""Oblique-aware DICOM & NIfTI ingestion, HU calibration, and LPS+ coordinate standardization."""
from dataclasses import dataclass
from pathlib import Path
import shutil
import tempfile
from typing import Dict, List, Literal, Tuple
import zipfile

import numpy as np
import pydicom
from pydicom.errors import InvalidDicomError
import SimpleITK as sitk


class MedicalImageValidationError(ValueError):
    """Raised when an uploaded medical image fails format, geometry, or series validation."""


class NonUniformSliceSpacingError(MedicalImageValidationError):
    """Raised when a DICOM series has missing slices or non-uniform inter-slice gaps."""


@dataclass(frozen=True)
class PreprocessedScanArtifact:
    """Output contract between the preprocessing pipeline and backend services."""
    scan_id: str
    native_image: sitk.Image
    lps_image: sitk.Image
    file_format: Literal["DICOM_ZIP", "DICOM_SERIES", "NIFTI"]
    dimensions_xyz: Tuple[int, int, int]
    spacing_xyz_mm: Tuple[float, float, float]
    native_origin_mm: List[float]
    native_direction: List[float]
    native_orientation_code: str
    lps_origin_mm: List[float]
    hu_min: float
    hu_max: float
    rescale_slope: float
    rescale_intercept: float
    is_oblique: bool
    validation_warnings: List[str]


def _check_is_oblique(direction_9: List[float] | Tuple[float, ...]) -> bool:
    """Return True if any column of the 3x3 direction cosine matrix deviates from principal axes."""
    mat = np.asarray(direction_9, dtype=np.float64).reshape(3, 3)
    for col in range(3):
        axis_max = float(np.max(np.abs(mat[:, col])))
        if axis_max < 0.9999:
            return True
    return False


def _clamp_hu_sitk(image: sitk.Image) -> Tuple[sitk.Image, float, float]:
    """Clamp scanner outside-FOV padding values (<-2048) to -1024 HU and cast to Int16."""
    arr = sitk.GetArrayFromImage(image).astype(np.float32)
    arr[arr < -2048.0] = -1024.0
    arr = np.clip(np.round(arr), -1024.0, 4096.0).astype(np.int16)
    hu_min = float(np.min(arr))
    hu_max = float(np.max(arr))
    out = sitk.GetImageFromArray(arr)
    out.CopyInformation(image)
    return out, hu_min, hu_max


def sort_and_validate_dicom_series(
    dicom_files: List[Path],
    scan_id: str,
) -> PreprocessedScanArtifact:
    """
    Validate and assemble a 3D CT volume from DICOM slices using oblique-aware
    normal projection: d_i = p_i · (r_0 × c_0).
    """
    warnings: List[str] = []
    series_map: Dict[str, List[pydicom.Dataset]] = {}

    for fpath in dicom_files:
        if not fpath.is_file() or fpath.name.startswith(".") or fpath.name == "DICOMDIR":
            continue
        try:
            ds = pydicom.dcmread(str(fpath), force=True)
        except (InvalidDicomError, Exception):
            continue

        if not hasattr(ds, "PixelData") or not hasattr(ds, "ImagePositionPatient") or not hasattr(
            ds, "ImageOrientationPatient"
        ):
            continue

        series_uid = str(getattr(ds, "SeriesInstanceUID", "DEFAULT_SERIES"))
        series_map.setdefault(series_uid, []).append(ds)

    if not series_map:
        raise MedicalImageValidationError(
            "No valid volumetric DICOM slices with PixelData, ImagePositionPatient, "
            "and ImageOrientationPatient were found."
        )

    # Select largest volumetric series
    sorted_series = sorted(series_map.items(), key=lambda kv: len(kv[1]), reverse=True)
    selected_uid, slices = sorted_series[0]
    if len(sorted_series) > 1:
        warnings.append(
            f"Archive contained {len(sorted_series)} DICOM series; selected primary series "
            f"'{selected_uid}' with {len(slices)} slices."
        )

    if len(slices) < 4:
        raise MedicalImageValidationError(
            f"Selected DICOM series contains only {len(slices)} slices; a minimum of 4 volumetric slices is required."
        )

    modality = str(getattr(slices[0], "Modality", "CT")).upper()
    if modality != "CT":
        warnings.append(f"DICOM Modality tag is '{modality}' (expected 'CT'). Proceeding with HU validation.")

    # Reference geometry from first slice
    ref = slices[0]
    ref_rows = int(ref.Rows)
    ref_cols = int(ref.Columns)
    ref_ps = [float(x) for x in ref.PixelSpacing]  # [row_spacing_y, col_spacing_x]
    spacing_row_y = float(ref_ps[0])
    spacing_col_x = float(ref_ps[1])

    iop_ref = [float(x) for x in ref.ImageOrientationPatient]
    r_0 = np.asarray(iop_ref[0:3], dtype=np.float64)
    c_0 = np.asarray(iop_ref[3:6], dtype=np.float64)
    r_norm = np.linalg.norm(r_0)
    c_norm = np.linalg.norm(c_0)
    if r_norm < 1e-6 or c_norm < 1e-6:
        raise MedicalImageValidationError("Invalid zero-length ImageOrientationPatient vectors.")
    r_0 = r_0 / r_norm
    c_0 = c_0 / c_norm

    # Compute right-handed slice normal vector: n = (r_0 × c_0) / ||r_0 × c_0||
    normal_vec = np.cross(r_0, c_0)
    n_norm = np.linalg.norm(normal_vec)
    if n_norm < 1e-6:
        raise MedicalImageValidationError("Row and column direction cosines in ImageOrientationPatient are collinear.")
    normal_vec = normal_vec / n_norm

    # Project each slice along normal_vec and validate slice consistency
    projected_items: List[Tuple[float, str, pydicom.Dataset]] = []
    seen_sop_uids = set()

    for idx, ds in enumerate(slices):
        sop_uid = str(getattr(ds, "SOPInstanceUID", f"slice_{idx}"))
        if sop_uid in seen_sop_uids:
            warnings.append(f"Skipped duplicate SOPInstanceUID '{sop_uid}'.")
            continue
        seen_sop_uids.add(sop_uid)

        if int(ds.Rows) != ref_rows or int(ds.Columns) != ref_cols:
            raise MedicalImageValidationError(
                f"Inconsistent slice matrix dimensions in series: expected ({ref_rows}, {ref_cols}), "
                f"found ({ds.Rows}, {ds.Columns})."
            )

        ps = [float(x) for x in ds.PixelSpacing]
        if abs(ps[0] - spacing_row_y) > 1e-3 or abs(ps[1] - spacing_col_x) > 1e-3:
            raise MedicalImageValidationError(
                "Inconsistent PixelSpacing detected across slices within the same DICOM series."
            )

        iop = [float(x) for x in ds.ImageOrientationPatient]
        r_i = np.asarray(iop[0:3], dtype=np.float64)
        c_i = np.asarray(iop[3:6], dtype=np.float64)
        r_i = r_i / np.linalg.norm(r_i)
        c_i = c_i / np.linalg.norm(c_i)

        if float(np.dot(r_i, r_0)) < 0.999 or float(np.dot(c_i, c_0)) < 0.999:
            raise MedicalImageValidationError(
                "Non-coplanar slice orientations detected within the DICOM series (dot product < 0.999)."
            )

        ipp = np.asarray([float(x) for x in ds.ImagePositionPatient], dtype=np.float64)
        d_i = float(np.dot(ipp, normal_vec))
        projected_items.append((d_i, sop_uid, ds))

    # Sort strictly by ascending scalar projection d_i along the slice normal
    projected_items.sort(key=lambda item: item[0])

    # Deduplicate slices at identical physical positions (within 1e-3 mm)
    deduped_items: List[Tuple[float, pydicom.Dataset]] = []
    for d_i, sop_uid, ds in projected_items:
        if deduped_items and abs(d_i - deduped_items[-1][0]) < 1e-3:
            warnings.append(f"Removed duplicate spatial slice position at d={d_i:.3f} mm.")
            continue
        deduped_items.append((d_i, ds))

    if len(deduped_items) < 4:
        raise MedicalImageValidationError("Fewer than 4 unique spatial slices remain after deduplication.")

    positions = np.asarray([item[0] for item in deduped_items], dtype=np.float64)
    deltas = np.diff(positions)
    median_dz = float(np.median(deltas))
    if median_dz <= 0:
        raise MedicalImageValidationError(f"Invalid non-positive inter-slice spacing: {median_dz} mm.")

    max_deviation = float(np.max(np.abs(deltas - median_dz)))
    tolerance = max(0.15 * median_dz, 0.5)
    if max_deviation > tolerance:
        gap_idx = int(np.argmax(np.abs(deltas - median_dz)))
        raise NonUniformSliceSpacingError(
            f"Non-uniform slice spacing detected between sorted slices {gap_idx} and {gap_idx + 1}: "
            f"delta={deltas[gap_idx]:.3f} mm vs median={median_dz:.3f} mm (max deviation {max_deviation:.3f} mm > "
            f"tolerance {tolerance:.3f} mm)."
        )

    # Assemble 3D calibrated HU volume (Z, Y, X)
    num_slices = len(deduped_items)
    hu_volume = np.empty((num_slices, ref_rows, ref_cols), dtype=np.int16)
    first_slope = float(getattr(deduped_items[0][1], "RescaleSlope", 1.0))
    first_intercept = float(getattr(deduped_items[0][1], "RescaleIntercept", 0.0))

    for z_idx, (_, ds) in enumerate(deduped_items):
        raw_slice = ds.pixel_array.astype(np.float32)
        slope = float(getattr(ds, "RescaleSlope", 1.0))
        intercept = float(getattr(ds, "RescaleIntercept", 0.0))
        hu_slice = raw_slice * slope + intercept
        hu_slice[hu_slice < -2048.0] = -1024.0
        hu_volume[z_idx] = np.clip(np.round(hu_slice), -1024.0, 4096.0).astype(np.int16)

    # Construct 3x3 ITK direction cosine matrix (columns: r_0, c_0, normal_vec)
    direction_mat = np.column_stack((r_0, c_0, normal_vec))
    direction_flat = [float(x) for x in direction_mat.flatten()]
    origin_first = [float(x) for x in deduped_items[0][1].ImagePositionPatient]

    native_sitk = sitk.GetImageFromArray(hu_volume)
    native_sitk.SetSpacing((spacing_col_x, spacing_row_y, median_dz))
    native_sitk.SetOrigin(origin_first)
    native_sitk.SetDirection(direction_flat)

    native_orient = sitk.DICOMOrientImageFilter_GetOrientationFromDirectionCosines(
        native_sitk.GetDirection()
    )
    lps_sitk = sitk.DICOMOrient(native_sitk, "LPS") if native_orient != "LPS" else native_sitk
    is_oblique = _check_is_oblique(direction_flat)

    return PreprocessedScanArtifact(
        scan_id=scan_id,
        native_image=native_sitk,
        lps_image=lps_sitk,
        file_format="DICOM_ZIP",
        dimensions_xyz=(int(lps_sitk.GetWidth()), int(lps_sitk.GetHeight()), int(lps_sitk.GetDepth())),
        spacing_xyz_mm=tuple(float(s) for s in lps_sitk.GetSpacing()),  # type: ignore[arg-type]
        native_origin_mm=origin_first,
        native_direction=direction_flat,
        native_orientation_code=native_orient,
        lps_origin_mm=[float(x) for x in lps_sitk.GetOrigin()],
        hu_min=float(np.min(hu_volume)),
        hu_max=float(np.max(hu_volume)),
        rescale_slope=first_slope,
        rescale_intercept=first_intercept,
        is_oblique=is_oblique,
        validation_warnings=warnings,
    )


def load_and_validate_nifti(file_path: Path, scan_id: str) -> PreprocessedScanArtifact:
    """Load, validate, and standardize a 3D NIfTI (.nii / .nii.gz) CT volume."""
    warnings: List[str] = []
    try:
        raw_img = sitk.ReadImage(str(file_path))
    except Exception as exc:
        raise MedicalImageValidationError(f"Failed to read NIfTI volume '{file_path.name}': {exc}") from exc

    dim = raw_img.GetDimension()
    if dim == 4:
        size_4d = raw_img.GetSize()
        if size_4d[3] == 1:
            raw_img = sitk.Extract(
                raw_img,
                size=(size_4d[0], size_4d[1], size_4d[2], 0),
                index=(0, 0, 0, 0),
            )
            warnings.append("Extracted 3D volume from 4D NIfTI with singleton temporal dimension.")
        else:
            raise MedicalImageValidationError(
                f"4D multi-frame NIfTI volumes (t={size_4d[3]}) are not supported; upload a 3D chest CT volume."
            )
    elif dim != 3:
        raise MedicalImageValidationError(f"Invalid NIfTI dimension {dim}D; expected a 3D volumetric CT scan.")

    size_xyz = raw_img.GetSize()
    if any(s < 4 for s in size_xyz):
        raise MedicalImageValidationError(
            f"Volume dimensions {size_xyz} are too small; minimum 4 voxels per axis required."
        )

    spacing_xyz = raw_img.GetSpacing()
    if any(sp <= 0 for sp in spacing_xyz):
        raise MedicalImageValidationError(f"Invalid non-positive voxel spacing {spacing_xyz}.")

    native_sitk, hu_min, hu_max = _clamp_hu_sitk(raw_img)
    if hu_max < -500.0 or hu_min > 500.0:
        warnings.append(
            f"Unusual intensity range [{hu_min:.1f}, {hu_max:.1f}] detected; verify scan is calibrated in Hounsfield Units."
        )

    direction_flat = [float(x) for x in native_sitk.GetDirection()]
    native_orient = sitk.DICOMOrientImageFilter_GetOrientationFromDirectionCosines(
        native_sitk.GetDirection()
    )
    lps_sitk = sitk.DICOMOrient(native_sitk, "LPS") if native_orient != "LPS" else native_sitk
    is_oblique = _check_is_oblique(direction_flat)

    return PreprocessedScanArtifact(
        scan_id=scan_id,
        native_image=native_sitk,
        lps_image=lps_sitk,
        file_format="NIFTI",
        dimensions_xyz=(int(lps_sitk.GetWidth()), int(lps_sitk.GetHeight()), int(lps_sitk.GetDepth())),
        spacing_xyz_mm=(
            float(lps_sitk.GetSpacing()[0]),
            float(lps_sitk.GetSpacing()[1]),
            float(lps_sitk.GetSpacing()[2]),
        ),
        native_origin_mm=[float(x) for x in native_sitk.GetOrigin()],
        native_direction=direction_flat,
        native_orientation_code=native_orient,
        lps_origin_mm=[float(x) for x in lps_sitk.GetOrigin()],
        hu_min=hu_min,
        hu_max=hu_max,
        rescale_slope=1.0,
        rescale_intercept=0.0,
        is_oblique=is_oblique,
        validation_warnings=warnings,
    )


def ingest_uploaded_scan(file_path: Path, original_filename: str, scan_id: str) -> PreprocessedScanArtifact:
    """
    Dispatch an uploaded file (.nii, .nii.gz, .zip of DICOMs, or .dcm) to the appropriate
    validator and return a standardized PreprocessedScanArtifact.
    """
    lower_name = original_filename.lower()
    if lower_name.endswith(".nii") or lower_name.endswith(".nii.gz"):
        return load_and_validate_nifti(file_path, scan_id=scan_id)

    if lower_name.endswith(".zip"):
        if not zipfile.is_zipfile(file_path):
            raise MedicalImageValidationError("Uploaded .zip file is not a valid ZIP archive.")
        temp_dir = Path(tempfile.mkdtemp(prefix=f"pv_dicom_{scan_id}_"))
        try:
            with zipfile.ZipFile(file_path, "r") as zf:
                for member in zf.infolist():
                    if ".." in member.filename or member.filename.startswith("/"):
                        raise MedicalImageValidationError("Unsafe path detected inside ZIP archive.")
                zf.extractall(temp_dir)
            all_files = [p for p in temp_dir.rglob("*") if p.is_file()]
            return sort_and_validate_dicom_series(all_files, scan_id=scan_id)
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)

    raise MedicalImageValidationError(
        f"Unsupported file format for '{original_filename}'. Supported formats: NIfTI (.nii, .nii.gz) "
        f"or ZIP archive of volumetric DICOM series (.zip)."
    )

