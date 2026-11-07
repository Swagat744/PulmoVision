# PulmoVision AI — Testing & Quality Assurance (`TESTING.md`)

## 1. Automated Test Execution

To run the complete unit, AI contract, and end-to-end integration test suite:

```powershell
cd D:\PulmoVision\backend
.\.venv\Scripts\python.exe -m pytest tests/ -v
```

### Verified Test Suite Results (`5 passed`)

| Test Case | File | Verified Engineering Contract | Status |
| :--- | :--- | :--- | :---: |
| `test_oblique_dicom_slice_sorting_and_hu_calibration` | `tests/test_unit_medical_pipeline.py` | Reconstructs a $14^\circ$ oblique-tilted DICOM series with shuffled filenames & scrambled `InstanceNumber` using scalar projection $d_i = \mathbf{p}_i \cdot (\mathbf{r}_0 \times \mathbf{c}_0)$, verifying exact voxel-for-voxel HU equality and `is_oblique=True`. | **PASSED** |
| `test_non_uniform_dicom_slice_gap_rejected` | `tests/test_unit_medical_pipeline.py` | Removes an interior DICOM slice (`slice_0005.dcm`) to create a $5.0\text{ mm}$ gap in a $2.5\text{ mm}$ series and verifies that `NonUniformSliceSpacingError` is raised. | **PASSED** |
| `test_nifti_ras_to_lps_canonical_standardization` | `tests/test_unit_medical_pipeline.py` | Loads a `RAS`-oriented NIfTI file, preserves native `RAS` metadata, and verifies that the viewer cache is standardized to `LPS`. | **PASSED** |
| `test_morphometric_physical_volume_and_3d_mesh` | `tests/test_unit_medical_pipeline.py` | Verifies physical volume formula ($\text{mL} = N \cdot \Delta x \Delta y \Delta z / 1000$), HU mean/std, $\text{DSC}=1.0$, $\text{HD}_{95}=0.0\text{ mm}$, and Marching Cubes 3D mesh extraction. | **PASSED** |
| `test_complete_end_to_end_pulmovision_workflow` | `tests/test_integration_api_and_ai.py` | End-to-end integration test through FastAPI `TestClient`: Auth (`401` guard + JWT login) $\to$ Create Study $\to$ Reject corrupt NIfTI (`422`) $\to$ Upload 3D Chest CT $\to$ Run real `lungmask_r231` U-Net segmentation $\to$ Verify `geometry_verified=True` & Right/Left lung volumes $\to$ Stream binary Int16 MPR & UInt8 mask slices (`axial`, `coronal`, `sagittal`) $\to$ Fetch 3D mesh $\to$ Export `.nii.gz` mask and verify `Origin`/`Spacing`/`Direction` match input scan $\to$ Export JSON & PDF reports $\to$ Verify Dashboard summary. | **PASSED** |

---

## 2. Frontend Type-Checking & Production Bundle Verification

```powershell
cd D:\PulmoVision\frontend
npm run build
```
* Executes `tsc -b` (strict TypeScript type verification across all DTOs, API client methods, Canvas2D MPR viewer, and Three.js 3D viewer) followed by `vite build`.
* **Result:** `✓ 1580 modules transformed. ✓ built in 5.33s` with zero errors.

