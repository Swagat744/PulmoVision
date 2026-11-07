"""End-to-end integration tests: Auth -> Study -> Upload -> Real LungMask AI -> Viewer -> Export."""
from pathlib import Path

from fastapi.testclient import TestClient
import numpy as np
import SimpleITK as sitk

from app.ml.phantom_generator import generate_thoracic_ct_phantom
from main import app


def test_complete_end_to_end_pulmovision_workflow(tmp_path: Path) -> None:
    """
    Test the complete clinical research workflow:
    Upload CT -> Validate -> Preprocess -> Segment (real lungmask R231) -> Save -> Visualize -> Measure -> Export.
    """
    with TestClient(app) as client:
        # 1. Health check
        health = client.get("/api/v1/health")
        assert health.status_code == 200
        assert health.json()["status"] == "healthy"

        # 2. Unauthorized check
        unauth = client.get("/api/v1/studies")
        assert unauth.status_code == 401

        # 3. Login with seeded researcher account
        login_resp = client.post(
            "/api/v1/auth/login",
            json={"email": "researcher@pulmovision.ai", "password": "PulmoVision2026!"},
        )
        assert login_resp.status_code == 200
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # 4. Create a study
        study_resp = client.post(
            "/api/v1/studies",
            headers=headers,
            json={
                "patient_anon_id": "PV-TEST-001",
                "title": "Integration Test Thoracic CT Study",
                "clinical_notes": "Automated verification of R231 bilateral segmentation.",
                "modality": "CT",
            },
        )
        assert study_resp.status_code == 201
        study_id = study_resp.json()["id"]

        # 5. Upload an invalid file -> verify 422 rejection
        bad_file = tmp_path / "corrupt.nii.gz"
        bad_file.write_bytes(b"not a valid nifti file")
        with open(bad_file, "rb") as bf:
            bad_resp = client.post(
                "/api/v1/scans/upload",
                headers=headers,
                data={"study_id": study_id},
                files={"file": ("corrupt.nii.gz", bf, "application/gzip")},
            )
        assert bad_resp.status_code == 422

        # 6. Generate and upload a calibrated 3D Thoracic CT NIfTI volume (16 slices, 256x256)
        sitk_ct, _ = generate_thoracic_ct_phantom(
            shape_zyx=(16, 256, 256),
            spacing_xyz_mm=(1.25, 1.25, 2.5),
            origin_xyz_mm=(-160.0, -160.0, -60.0),
        )
        nifti_path = tmp_path / "chest_ct_test.nii.gz"
        sitk.WriteImage(sitk_ct, str(nifti_path), useCompression=True)

        with open(nifti_path, "rb") as nf:
            up_resp = client.post(
                "/api/v1/scans/upload",
                headers=headers,
                data={"study_id": study_id},
                files={"file": ("chest_ct_test.nii.gz", nf, "application/gzip")},
            )
        assert up_resp.status_code == 201, up_resp.text
        scan_dto = up_resp.json()
        scan_id = scan_dto["id"]
        assert scan_dto["dimensions"] == {"x": 256, "y": 256, "z": 16}
        assert scan_dto["spacing_mm"] == {"x": 1.25, "y": 1.25, "z": 2.5}

        # 7. Run real LungMask R231 segmentation job synchronously
        job_resp = client.post(
            "/api/v1/segmentation/jobs?sync=true",
            headers=headers,
            json={"scan_id": scan_id, "model_key": "lungmask_r231", "batch_size": 4},
        )
        assert job_resp.status_code == 202, job_resp.text
        job_dto = job_resp.json()
        assert job_dto["status"] == "COMPLETED", f"Job failed: {job_dto.get('error_message')}"
        assert job_dto["progress_percent"] == 100
        assert job_dto["result_id"] is not None
        result_id = job_dto["result_id"]

        # 8. Verify segmentation result & quantitative measurements
        res_resp = client.get(f"/api/v1/segmentation/results/{result_id}", headers=headers)
        assert res_resp.status_code == 200
        res_dto = res_resp.json()
        assert res_dto["geometry_verified"] is True
        measurements = {m["structure_key"]: m for m in res_dto["measurements"]}
        assert "total_lung" in measurements
        assert "right_lung" in measurements
        assert "left_lung" in measurements
        assert measurements["right_lung"]["physical_volume_ml"] > 50.0
        assert measurements["left_lung"]["physical_volume_ml"] > 50.0
        assert np.isclose(
            measurements["total_lung"]["physical_volume_ml"],
            measurements["right_lung"]["physical_volume_ml"] + measurements["left_lung"]["physical_volume_ml"],
            atol=0.1,
        )

        # 9. Verify 2D MPR binary slices (axial, coronal, sagittal)
        for plane, idx, exp_w, exp_h in [
            ("axial", 8, 256, 256),
            ("coronal", 128, 256, 16),
            ("sagittal", 128, 256, 16),
        ]:
            ct_slice = client.get(
                f"/api/v1/viewer/scans/{scan_id}/slice?plane={plane}&index={idx}",
                headers=headers,
            )
            assert ct_slice.status_code == 200
            assert int(ct_slice.headers["X-Slice-Width"]) == exp_w
            assert int(ct_slice.headers["X-Slice-Height"]) == exp_h
            assert len(ct_slice.content) == exp_w * exp_h * 2  # Int16 = 2 bytes

            mask_slice = client.get(
                f"/api/v1/viewer/results/{result_id}/mask-slice?plane={plane}&index={idx}",
                headers=headers,
            )
            assert mask_slice.status_code == 200
            assert len(mask_slice.content) == exp_w * exp_h  # UInt8 = 1 byte

        # 10. Verify 3D Anatomical Mesh endpoint
        mesh_resp = client.get(f"/api/v1/viewer/results/{result_id}/mesh", headers=headers)
        assert mesh_resp.status_code == 200
        mesh_json = mesh_resp.json()
        assert len(mesh_json["structures"]) == 2

        # 11. Verify NIfTI mask export preserves exact native spatial metadata
        mask_dl = client.get(f"/api/v1/reports/{result_id}/export-mask", headers=headers)
        assert mask_dl.status_code == 200
        exported_mask_path = tmp_path / "exported_mask.nii.gz"
        exported_mask_path.write_bytes(mask_dl.content)
        exported_sitk = sitk.ReadImage(str(exported_mask_path))
        assert exported_sitk.GetSize() == sitk_ct.GetSize()
        assert np.allclose(exported_sitk.GetSpacing(), sitk_ct.GetSpacing(), atol=1e-5)
        assert np.allclose(exported_sitk.GetOrigin(), sitk_ct.GetOrigin(), atol=1e-4)
        assert np.allclose(exported_sitk.GetDirection(), sitk_ct.GetDirection(), atol=1e-5)

        # 12. Verify JSON and PDF report exports
        json_rep = client.get(f"/api/v1/reports/{result_id}/export-json", headers=headers)
        assert json_rep.status_code == 200
        assert "scientific_disclaimer" in json_rep.json()

        pdf_rep = client.get(f"/api/v1/reports/{result_id}/export-pdf", headers=headers)
        assert pdf_rep.status_code == 200
        assert pdf_rep.content.startswith(b"%PDF")

        # 13. Verify Dashboard summary reflects real database state
        dash = client.get("/api/v1/dashboard/summary", headers=headers)
        assert dash.status_code == 200
        dash_json = dash.json()
        assert dash_json["total_studies"] >= 1
        assert dash_json["completed_jobs"] >= 1
