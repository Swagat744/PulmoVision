# PulmoVision AI — Sample Benchmark Datasets

This directory contains synthetic thoracic CT phantoms and empirical benchmark data used for automated testing, pipeline validation, and user evaluation of PulmoVision AI.

## Important Privacy & Ethical Notice

> [!NOTE]
> All datasets in this directory are **100% synthetically generated** using mathematical geometric primitives (ellipsoids, cylinders, Gaussian HU noise, and bronchial tree simulations) implemented in [`backend/app/ml/phantom_generator.py`](../backend/app/ml/phantom_generator.py).
> 
> **Zero clinical, personal, or patient-identifiable data (PHI/PII) is contained in these files.** They are fully compliant with HIPAA de-identification standards and are safe for open-source distribution and reproducible research benchmarking.

---

## Included Datasets

### 1. `pulmovision_chest_ct_axial_dicom.zip` (~3.4 MB)
* **Modality:** CT (Computed Tomography)
* **Matrix Size:** 48 slices × 256 rows × 256 columns
* **Voxel Spacing:** $1.25 \times 1.25 \times 2.50\text{ mm}$
* **Orientation:** Axial standard acquisition ($\text{Gantry Tilt} = 0.0^\circ$)
* **Coordinate Direction:** Standard LPS+ identity cosines
* **Simulated Anatomy:** Bilateral lung cavities (-750 to -850 HU), heart (-20 to +40 HU), thoracic spine (+450 to +700 HU), chest wall (+30 HU), and surrounding air (-1000 HU).
* **Filename Shuffling:** DICOM file names are randomized (`slice_XXXX.dcm`) to test the backend's robust mathematical slice sorting via `ImagePositionPatient` along the slice normal vector.

### 2. `pulmovision_chest_ct_oblique_12deg_dicom.zip` (~3.4 MB)
* **Modality:** CT (Computed Tomography)
* **Matrix Size:** 48 slices × 256 rows × 256 columns
* **Voxel Spacing:** $1.25 \times 1.25 \times 2.50\text{ mm}$
* **Orientation:** Oblique acquisition with a $12.0^\circ$ simulated gantry tilt / patient tilt.
* **Orientation Patient Vectors:** Non-identity direction cosines tested by SimpleITK LPS canonical standardization.
* **Purpose:** Verifies that the preprocessing pipeline correctly sorts oblique DICOM slices using patient coordinates ($S_i = \mathbf{P}_i \cdot \mathbf{n}$) rather than falling back to slice location or alphanumeric filename ordering.

### 3. `empirical_benchmark_results.json` (~1.2 KB)
* Raw empirical performance metrics recorded across Tier 1 ($32 \times 256 \times 256$) and Tier 2 ($64 \times 256 \times 256$) runs on a benchmark reference host (Intel Core i5-1235U, 7.68 GB RAM, Windows 11).
* Captures inference runtime, peak RSS memory consumption, Marching Cubes extraction latency, and Dice coefficient against synthetic ground truth.

---

## How to Regenerate Benchmark Datasets

You can regenerate or extend these datasets at any time using the backend benchmark script:

```powershell
# From the backend directory
cd D:\PulmoVision\backend
.\.venv\Scripts\Activate.ps1
python scripts/benchmark_pipeline.py
```

This will run the full pipeline, synthesize new calibrated phantoms, perform Marching Cubes mesh extraction, and update `empirical_benchmark_results.json`.

