"""Unit tests for oblique DICOM sorting, coordinate preservation, volumetrics, and 3D mesh extraction."""
from pathlib import Path
import zipfile

import numpy as np
import pytest
import SimpleITK as sitk

from app.ml.metrics import compute_morphometric_measurements, evaluate_against_reference_mask
from app.ml.phantom_generator import generate_thoracic_ct_phantom, write_dicom_zip_from_sitk
from app.ml.postprocessor import extract_anatomical_3d_meshes
from app.ml.preprocessor import (
    MedicalImageValidationError,
    NonUniformSliceSpacingError,
    ingest_uploaded_scan,
    load_and_validate_nifti,
)


def test_oblique_dicom_slice_sorting_and_hu_calibration(tmp_path: Path) -> None:
    """
    Verify that a DICOM series acquired with a 14-degree oblique gantry tilt and
    shuffled filenames/InstanceNumbers is reconstructed in exact spatial order
    using scalar projection d_i = p_i · (r_0 × c_0).
    """
    sitk_orig, _ = generate_thoracic_ct_phantom(
        shape_zyx=(20, 128, 128),
        spacing_xyz_mm=(1.5, 1.5, 3.0),
        origin_xyz_mm=(-95.0, -90.0, -60.0),
    )
    zip_path = tmp_path / "oblique_shuffled.zip"
    write_dicom_zip_from_sitk(
        sitk_img=sitk_orig,
        zip_path=zip_path,
        gantry_tilt_deg=14.0,
        shuffle_filenames=True,
    )

    artifact = ingest_uploaded_scan(zip_path, original_filename="oblique_shuffled.zip", scan_id="test-oblique-1")
    assert artifact.is_oblique is True
    assert artifact.dimensions_xyz == (128, 128, 20)
    assert np.allclose(artifact.spacing_xyz_mm, (1.5, 1.5, 3.0), atol=1e-3)

    # Verify voxel-for-voxel HU reconstruction matches the unshuffled source volume
    reconstructed_arr = sitk.GetArrayFromImage(artifact.native_image)
    original_arr = sitk.GetArrayFromImage(sitk_orig)
    assert np.array_equal(reconstructed_arr, original_arr)


def test_non_uniform_dicom_slice_gap_rejected(tmp_path: Path) -> None:
    """Verify that missing a slice in the middle of a DICOM series raises NonUniformSliceSpacingError."""
    sitk_orig, _ = generate_thoracic_ct_phantom(shape_zyx=(12, 64, 64), spacing_xyz_mm=(2.0, 2.0, 2.5))
    full_zip = tmp_path / "full.zip"
    write_dicom_zip_from_sitk(sitk_orig, full_zip, gantry_tilt_deg=0.0, shuffle_filenames=False)

    gap_zip = tmp_path / "gapped.zip"
    with zipfile.ZipFile(full_zip, "r") as zin, zipfile.ZipFile(gap_zip, "w") as zout:
        for item in zin.infolist():
            # Omit slice_0005.dcm to create a 5.0 mm gap in a 2.5 mm series
            if item.filename == "slice_0005.dcm":
                continue
            zout.writestr(item, zin.read(item.filename))

    with pytest.raises(NonUniformSliceSpacingError):
        ingest_uploaded_scan(gap_zip, original_filename="gapped.zip", scan_id="test-gap")


def test_nifti_ras_to_lps_canonical_standardization(tmp_path: Path) -> None:
    """Verify NIfTI loading preserves native geometry while generating an axis-aligned LPS+ view."""
    sitk_orig, _ = generate_thoracic_ct_phantom(shape_zyx=(16, 128, 128), spacing_xyz_mm=(1.2, 1.2, 2.5))
    # Reorient to RAS to simulate a typical neuroimaging/research NIfTI file
    ras_img = sitk.DICOMOrient(sitk_orig, "RAS")
    nifti_path = tmp_path / "ras_scan.nii.gz"
    sitk.WriteImage(ras_img, str(nifti_path))

    artifact = load_and_validate_nifti(nifti_path, scan_id="test-ras")
    assert artifact.native_orientation_code == "RAS"
    lps_orient = sitk.DICOMOrientImageFilter_GetOrientationFromDirectionCosines(
        artifact.lps_image.GetDirection()
    )
    assert lps_orient == "LPS"
    assert np.allclose(artifact.spacing_xyz_mm, (1.2, 1.2, 2.5), atol=1e-4)


def test_morphometric_physical_volume_and_3d_mesh() -> None:
    """Verify exact voxel-to-mL physical volume calculation and physical-space Marching Cubes mesh."""
    sitk_ct, gt_mask = generate_thoracic_ct_phantom(
        shape_zyx=(24, 128, 128),
        spacing_xyz_mm=(1.5, 1.5, 2.0),
    )
    mask_sitk = sitk.GetImageFromArray(gt_mask)
    mask_sitk.CopyInformation(sitk_ct)

    label_map = {
        "1": {"key": "right_lung", "name": "Right Lung", "color": "#38BDF8"},
        "2": {"key": "left_lung", "name": "Left Lung", "color": "#14B8A6"},
    }
    metrics = compute_morphometric_measurements(sitk_ct, mask_sitk, label_map)
    by_key = {m.structure_key: m for m in metrics}

    voxel_vol_mm3 = 1.5 * 1.5 * 2.0  # 4.5 mm^3
    expected_right_voxels = int(np.count_nonzero(gt_mask == 1))
    expected_left_voxels = int(np.count_nonzero(gt_mask == 2))
    expected_total_ml = round((expected_right_voxels + expected_left_voxels) * voxel_vol_mm3 / 1000.0, 2)

    assert by_key["right_lung"].voxel_count == expected_right_voxels
    assert by_key["left_lung"].voxel_count == expected_left_voxels
    assert by_key["total_lung"].physical_volume_ml == expected_total_ml
    assert -900.0 <= by_key["total_lung"].mean_hu <= -700.0

    # Reference evaluation check
    eval_res = evaluate_against_reference_mask(gt_mask, gt_mask, spacing_xyz_mm=(1.5, 1.5, 2.0))
    assert eval_res["dice_score"] == 1.0
    assert eval_res["hd95_mm"] == 0.0

    # 3D Marching Cubes mesh check
    mesh_out = extract_anatomical_3d_meshes(mask_sitk, label_map, step_size=2)
    assert len(mesh_out["structures"]) == 2
    for struct in mesh_out["structures"]:
        assert struct["vertex_count"] > 50
        assert struct["face_count"] > 50

