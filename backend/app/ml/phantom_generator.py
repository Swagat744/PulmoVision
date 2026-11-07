"""Anatomically realistic 3D Thoracic CT Phantom Generator (NIfTI & Oblique/Axial DICOM)."""
from pathlib import Path
from typing import Tuple
import zipfile

import numpy as np
import pydicom
from pydicom.dataset import Dataset, FileDataset, FileMetaDataset
from pydicom.uid import ExplicitVRLittleEndian, generate_uid
import SimpleITK as sitk


def generate_thoracic_ct_phantom(
    shape_zyx: Tuple[int, int, int] = (48, 256, 256),
    spacing_xyz_mm: Tuple[float, float, float] = (1.25, 1.25, 2.5),
    origin_xyz_mm: Tuple[float, float, float] = (-160.0, -160.0, -120.0),
    seed: int = 42,
) -> Tuple[sitk.Image, np.ndarray]:
    """
    Synthesize a calibrated 3D Chest CT volume in Hounsfield Units (Int16)
    with realistic thoracic wall, ribs, spine, mediastinum, heart, and
    bilateral lungs (Right Lung = 1, Left Lung = 2) with pulmonary vascular texture.

    Returns:
      (sitk_ct_image, ground_truth_mask_zyx)
      where ground_truth_mask_zyx has 1=Right Lung, 2=Left Lung.
    """
    rng = np.random.default_rng(seed)
    nz, ny, nx = shape_zyx

    # Normalized 3D coordinate grids in [-1, 1] of exact shape (nz, ny, nx)
    z_1d = np.linspace(-1.0, 1.0, nz, dtype=np.float32)
    y_1d = np.linspace(-1.0, 1.0, ny, dtype=np.float32)
    x_1d = np.linspace(-1.0, 1.0, nx, dtype=np.float32)
    z, y, x = np.meshgrid(z_1d, y_1d, x_1d, indexing="ij")

    # Initialize background air (-1000 HU)
    hu = np.full(shape_zyx, -1000.0, dtype=np.float32)
    gt_mask = np.zeros(shape_zyx, dtype=np.uint8)

    # 1. Thoracic body torso ellipse (soft tissue +45 HU, subcutaneous fat -75 HU rim)
    torso_dist = (x / 0.78) ** 2 + (y / 0.56) ** 2
    in_torso = torso_dist <= 1.0
    in_fat_rim = (torso_dist <= 1.0) & (torso_dist > 0.86)
    hu[in_torso] = 45.0
    hu[in_fat_rim] = -70.0

    # CT table beneath posterior back (y > 0.58)
    table_mask = (np.abs(x) < 0.65) & (y >= 0.58) & (y <= 0.63)
    hu[table_mask] = 180.0

    # 2. Anatomical dome taper along z (apices at z -> +1, diaphragm at z -> -1)
    # In LPS+: z=0 is inferior (diaphragm), z=nz-1 is superior (apex)
    dome_scale = np.clip(1.0 - 0.32 * (z - 0.05) ** 2, 0.45, 1.0)
    axial_valid = (z >= -0.82) & (z <= 0.85)

    # 3. Right Lung (LPS x < 0, screen left) & Left Lung (LPS x > 0, screen right)
    rx_center = -0.30 * dome_scale
    lx_center = 0.30 * dome_scale
    ry_center = -0.03
    ly_center = -0.02
    r_rx = 0.27 * dome_scale
    l_rx = 0.25 * dome_scale
    r_ry = 0.37 * dome_scale
    l_ry = 0.36 * dome_scale

    right_ellipsoid = (((x - rx_center) / r_rx) ** 2 + ((y - ry_center) / r_ry) ** 2 <= 1.0) & axial_valid
    left_ellipsoid = (((x - lx_center) / l_rx) ** 2 + ((y - ly_center) / l_ry) ** 2 <= 1.0) & axial_valid

    # 4. Mediastinum & Cardiac Notch (carves medial aspect, especially inferior-anterior left lung)
    heart_z_weight = np.exp(-((z + 0.22) / 0.45) ** 2)
    mediastinum = (
        ((x - 0.06 * heart_z_weight) / (0.16 + 0.07 * heart_z_weight)) ** 2
        + ((y + 0.10 * heart_z_weight) / (0.24 + 0.06 * heart_z_weight)) ** 2
    ) <= 1.0

    # Diaphragmatic domes pushing up from inferior (z < -0.55)
    right_diaphragm = (((x + 0.28) / 0.24) ** 2 + ((y - 0.02) / 0.30) ** 2 + ((z + 0.82) / 0.28) ** 2) <= 1.0
    left_diaphragm = (((x - 0.28) / 0.22) ** 2 + ((y - 0.02) / 0.28) ** 2 + ((z + 0.85) / 0.25) ** 2) <= 1.0

    right_lung = right_ellipsoid & (~mediastinum) & (~right_diaphragm)
    left_lung = left_ellipsoid & (~mediastinum) & (~left_diaphragm)

    # 5. Populate lung parenchyma (-830 HU baseline + gravity gradient + vascular branching)
    ap_gradient = 45.0 * y  # Posterior slightly denser due to supine gravity gradient
    vascular_field = (
        35.0 * np.sin(18.0 * x) * np.cos(18.0 * y) * np.cos(10.0 * z)
        + 25.0 * np.cos(28.0 * x + 12.0 * z) * np.sin(24.0 * y)
    )
    lung_hu = -825.0 + ap_gradient + vascular_field

    hu[right_lung] = lung_hu[right_lung]
    hu[left_lung] = lung_hu[left_lung]
    gt_mask[right_lung] = 1
    gt_mask[left_lung] = 2

    # 6. Interlobar fissures (thin slightly higher attenuation planes ~ -650 HU)
    # Right oblique fissure & right horizontal fissure; Left oblique fissure
    r_oblique_fissure = right_lung & (np.abs(y - 0.45 * z) < 0.018)
    r_horiz_fissure = right_lung & (y < 0.05) & (np.abs(z - 0.12) < 0.018)
    l_oblique_fissure = left_lung & (np.abs(y - 0.48 * z) < 0.018)
    hu[r_oblique_fissure | r_horiz_fissure | l_oblique_fissure] = -640.0

    # 7. Trachea & Mainstem Bronchi (excluded from lung parenchyma mask, filled with air -990 HU)
    trachea_mask = (z > 0.20) & ((x / 0.045) ** 2 + ((y + 0.02) / 0.045) ** 2 <= 1.0)
    trachea_wall = (z > 0.20) & ((x / 0.058) ** 2 + ((y + 0.02) / 0.058) ** 2 <= 1.0) & (~trachea_mask)
    hu[trachea_wall] = 65.0
    hu[trachea_mask] = -995.0
    gt_mask[trachea_mask | trachea_wall] = 0

    # 8. Vertebral column (posterior midline x ~ 0, y ~ 0.34) & Rib ring
    vertebral_body = ((x / 0.09) ** 2 + ((y - 0.33) / 0.08) ** 2) <= 1.0
    spinal_canal = ((x / 0.035) ** 2 + ((y - 0.41) / 0.035) ** 2) <= 1.0
    spinous_proc = ((x / 0.025) ** 2 + ((y - 0.47) / 0.05) ** 2) <= 1.0
    hu[vertebral_body | spinous_proc] = 520.0
    hu[spinal_canal] = 25.0

    # Periodic ribs along z inside the thoracic wall
    rib_ring = (torso_dist <= 0.85) & (torso_dist >= 0.74) & (np.cos(11.0 * np.pi * z) > 0.35)
    hu[rib_ring] = 610.0

    # Add realistic quantum CT noise (sigma = 14 HU)
    noise = rng.normal(loc=0.0, scale=14.0, size=shape_zyx).astype(np.float32)
    hu = np.clip(np.round(hu + noise), -1024.0, 3071.0).astype(np.int16)

    sitk_img = sitk.GetImageFromArray(hu)
    sitk_img.SetSpacing(spacing_xyz_mm)
    sitk_img.SetOrigin(origin_xyz_mm)
    sitk_img.SetDirection([1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0])
    return sitk_img, gt_mask


def write_dicom_zip_from_sitk(
    sitk_img: sitk.Image,
    zip_path: Path,
    patient_id: str = "PV-ANON-001",
    study_description: str = "Thoracic CT Research Phantom",
    gantry_tilt_deg: float = 0.0,
    shuffle_filenames: bool = False,
) -> Path:
    """
    Export a 3D SimpleITK CT image as a standards-compliant multi-slice DICOM ZIP archive.
    Supports oblique gantry tilt (`gantry_tilt_deg`) and intentionally shuffled filenames
    to test oblique projection sorting `d_i = p_i · (r × c)`.
    """
    arr_zyx = sitk.GetArrayFromImage(sitk_img).astype(np.int16)
    nz, ny, nx = arr_zyx.shape
    sx, sy, sz = sitk_img.GetSpacing()
    ox, oy, oz = sitk_img.GetOrigin()

    # Construct direction cosines with optional gantry tilt around X axis (row axis)
    theta = np.deg2rad(gantry_tilt_deg)
    r_vec = np.array([1.0, 0.0, 0.0], dtype=np.float64)
    c_vec = np.array([0.0, float(np.cos(theta)), float(np.sin(theta))], dtype=np.float64)
    n_vec = np.cross(r_vec, c_vec)
    iop_list = [float(v) for v in np.concatenate([r_vec, c_vec])]
    base_origin = np.array([ox, oy, oz], dtype=np.float64)

    study_uid = generate_uid()
    series_uid = generate_uid()
    frame_uid = generate_uid()

    slice_indices = list(range(nz))
    if shuffle_filenames:
        rng = np.random.default_rng(12345)
        rng.shuffle(slice_indices)

    zip_path.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for file_order_idx, z_idx in enumerate(slice_indices):
            file_meta = FileMetaDataset()
            file_meta.FileMetaInformationVersion = b"\x00\x01"
            file_meta.MediaStorageSOPClassUID = "1.2.840.10008.5.1.4.1.1.2"  # CT Image Storage
            sop_uid = generate_uid()
            file_meta.MediaStorageSOPInstanceUID = sop_uid
            file_meta.TransferSyntaxUID = ExplicitVRLittleEndian
            file_meta.ImplementationClassUID = generate_uid()

            ds = FileDataset(None, {}, file_meta=file_meta, preamble=b"\x00" * 128)

            ds.SOPClassUID = file_meta.MediaStorageSOPClassUID
            ds.SOPInstanceUID = sop_uid
            ds.StudyInstanceUID = study_uid
            ds.SeriesInstanceUID = series_uid
            ds.FrameOfReferenceUID = frame_uid

            ds.PatientName = "ANONYMIZED^RESEARCH"
            ds.PatientID = patient_id
            ds.Modality = "CT"
            ds.StudyDescription = study_description
            ds.SeriesDescription = "Chest CT Volumetric"
            ds.SeriesNumber = 1
            # Intentionally set InstanceNumber to file_order_idx + 1 when shuffled to prove
            # our sorter ignores InstanceNumber and uses (p_i · (r × c))!
            ds.InstanceNumber = int(file_order_idx + 1)

            pos_xyz = base_origin + float(z_idx) * float(sz) * n_vec
            ds.ImagePositionPatient = [float(pos_xyz[0]), float(pos_xyz[1]), float(pos_xyz[2])]
            ds.ImageOrientationPatient = iop_list
            ds.SliceThickness = float(sz)
            ds.PixelSpacing = [float(sy), float(sx)]

            ds.Rows = int(ny)
            ds.Columns = int(nx)
            ds.SamplesPerPixel = 1
            ds.PhotometricInterpretation = "MONOCHROME2"
            ds.BitsAllocated = 16
            ds.BitsStored = 16
            ds.HighBit = 15
            ds.PixelRepresentation = 1  # signed int16
            ds.RescaleIntercept = -1024.0
            ds.RescaleSlope = 1.0

            # Store raw pixel values such that raw * 1.0 + (-1024.0) == HU
            stored_pixels = (arr_zyx[z_idx].astype(np.int32) + 1024).astype(np.int16)
            ds.PixelData = stored_pixels.tobytes()

            import io
            bio = io.BytesIO()
            pydicom.dcmwrite(bio, ds, enforce_file_format=True)
            zf.writestr(f"slice_{file_order_idx:04d}.dcm", bio.getvalue())

    return zip_path
