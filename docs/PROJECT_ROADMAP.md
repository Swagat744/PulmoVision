# PulmoVision AI — Project Roadmap (`PROJECT_ROADMAP.md`)

## Phase A — Core MVP (Completed & Verified)
- [x] **Authentication & Security:** Argon2id password hashing, JWT session tokens, RBAC, and immutable database audit logs.
- [x] **Normalized 9-Table Schema:** `users`, `studies`, `medical_scans`, `model_versions`, `segmentation_jobs`, `segmentation_results`, `measurements`, `reports`, `audit_logs`.
- [x] **Oblique-Aware DICOM & NIfTI Ingestion:** Scalar projection slice sorting $d_i = \mathbf{p}_i \cdot (\mathbf{r}_0 \times \mathbf{c}_0)$, coplanarity & slice-gap verification, HU calibration, and canonical LPS+ standardization.
- [x] **Real AI Segmentation (`lungmask_r231`):** Verified SHA-256 weight caching (`unet_r231-d5d2fc3d.pth`), bilateral Right/Left lung separation, `CopyInformation()` spatial metadata restoration, and single-worker CPU execution.
- [x] **Precision 2D MPR & 3D Surface Medical Viewer:** Axial, Coronal, and Sagittal `Int16Array` HU viewports with continuous Window/Level LUT, physical aspect-ratio scaling, multi-label overlays, side-by-side comparison mode, and Three.js 3D anatomical surface viewer.
- [x] **Geometry-Aware Quantitative Analysis & Exports:** True voxel-spacing physical volumes ($\text{mL}$), HU density statistics, native-geometry `.nii.gz` mask export, and PDF/JSON research report exports.

---

## Phase B — Advanced Capabilities (Implemented & Integrated)
- [x] **Five-Lobe Pulmonary Segmentation (`lungmask_ltrclobes`):** Integrated into the model registry (`LUL`, `LLL`, `RUL`, `RML`, `RLL`) with SHA-256 verification (`3a07043d`).
- [x] **Multi-Model Result Selection:** Researchers can run both `R231` and `LTRCLobes` on the same scan and switch between results in the workspace.
- [x] **Reference Evaluation Metrics:** Implemented Dice Similarity Coefficient ($\text{DSC}$), Jaccard IoU, Relative Volume Difference ($\text{RVD}$), and 95th-percentile Hausdorff Distance ($\text{HD}_{95}$ in $\text{mm}$).
- [x] **Empirical Hardware Benchmarking:** Automated benchmark suite (`backend/scripts/benchmark_pipeline.py`) recording per-slice latency and peak RSS.

---

## Phase C — Future Research Directions (Not Falsified in UI)
In strict compliance with Section 4 ("Do not implement these features as fake UI demonstrations"), the following pathology-specific tasks are reserved for future research once dedicated validated weights are integrated via `BaseSegmentationAdapter`:
- [ ] **Pulmonary Nodule Detection & Volumetry** (requires LIDC-IDRI / LUNA16 3D detection/segmentation weights).
- [ ] **NSCLC Lung Tumor Segmentation** (requires MSD Task06_Lung 3D nnU-Net weights).
- [ ] **Tracheobronchial Airway Tree & Pulmonary Vessel Segmentation** (requires ATM'22 / Parse2022 weights).

