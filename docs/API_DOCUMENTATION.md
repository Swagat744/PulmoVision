# PulmoVision AI — REST API & Binary Streaming Documentation (`API_DOCUMENTATION.md`)

Base URL (Development): `http://127.0.0.1:8000`
Interactive OpenAPI / Swagger UI: `http://127.0.0.1:8000/docs`

All protected endpoints require an HTTP header:
```http
Authorization: Bearer <jwt_access_token>
```

---

## 1. Authentication (`/api/v1/auth`)

### `POST /api/v1/auth/register`
Registers a new researcher or clinician account and returns an active JWT token.
* **Request Body (`application/json`):**
```json
{
  "email": "researcher@pulmovision.ai",
  "password": "PulmoVision2026!",
  "full_name": "Dr. Elena Vance",
  "role": "researcher"
}
```
* **Responses:** `201 Created` (`TokenResponseDTO`), `409 Conflict` (duplicate email).

### `POST /api/v1/auth/login`
Authenticates user credentials via Argon2id verification.
* **Request Body:** `{"email": "...", "password": "..."}`
* **Responses:** `200 OK` (`TokenResponseDTO`), `401 Unauthorized`.

### `GET /api/v1/auth/me`
Returns the authenticated `UserResponseDTO`.

---

## 2. Studies & Medical Scan Ingestion (`/api/v1/studies` & `/api/v1/scans`)

### `GET /api/v1/studies`
Lists all studies belonging to the authenticated user, ordered by `created_at DESC`, including nested `ScanMetadataDTO` records.

### `POST /api/v1/studies`
Creates a de-identified study container with an auto-generated `study_code` (`PV-2026-XXXXXX`).

### `DELETE /api/v1/studies/{study_id}`
Deletes the study, cascades deletion across database records, and purges associated scan/mask files from storage. Rejects with `409 Conflict` if a segmentation job is currently `QUEUED` or `PROCESSING`.

### `POST /api/v1/scans/upload`
Multipart upload (`study_id`, `file`) supporting `.nii`, `.nii.gz`, and `.zip` archives of volumetric DICOM series.
* **Validation:** Rejects corrupt files, <4 slices, non-coplanar series, or missing-slice gaps (`NonUniformSliceSpacingError`) with `422 Unprocessable Entity`.
* **Responses:** `201 Created` (`ScanMetadataDTO`), `413 Content Too Large`, `422 Unprocessable Entity`.

### `POST /api/v1/scans/generate-sample`
Query parameters: `study_id`, `preset` (`nifti_standard` | `dicom_axial` | `dicom_oblique`), `num_slices` (`16..180`).
Synthesizes and ingests a calibrated 3D Thoracic CT benchmark volume.

---

## 3. AI Segmentation Jobs & Model Registry (`/api/v1/models` & `/api/v1/segmentation`)

### `GET /api/v1/models`
Returns registered `ModelVersionDTO` entries (`lungmask_r231` and `lungmask_ltrclobes`), including live `weights_cached_locally` verification.

### `POST /api/v1/segmentation/jobs`
Submits an asynchronous segmentation job to the single-worker background executor.
* **Request Body:**
```json
{
  "scan_id": "uuid-of-scan",
  "model_key": "lungmask_r231",
  "batch_size": 4
}
```
* **Query Parameter:** `sync=true` (optional; executes synchronously for automated testing).
* **Response:** `202 Accepted` (`SegmentationJobStatusDTO`).

### `GET /api/v1/segmentation/jobs/{job_id}`
Polls job state (`QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED`), `progress_percent` (`0..100`), `current_stage`, `execution_time_sec`, `peak_ram_mb`, and `result_id`.

### `GET /api/v1/segmentation/results/{result_id}`
Returns `SegmentationResultDTO` including all `MeasurementDTO` structure records.

---

## 4. Medical Imaging Viewer Binary Streaming (`/api/v1/viewer`)

### `GET /api/v1/viewer/scans/{scan_id}/slice?plane={axial|coronal|sagittal}&index={int}`
Streams a raw little-endian `Int16Array` buffer of calibrated Hounsfield Units in standard radiological LPS+ orientation.
* **Response Headers:**
  * `Content-Type: application/octet-stream`
  * `X-Slice-Width`: integer pixel width
  * `X-Slice-Height`: integer pixel height
  * `X-Spacing-Horizontal-MM`: float physical $\text{mm}$ per horizontal pixel
  * `X-Spacing-Vertical-MM`: float physical $\text{mm}$ per vertical pixel
  * `X-Plane`: `axial | coronal | sagittal`
  * `X-Slice-Index`: integer slice index
  * `X-Data-Type: int16-le`

### `GET /api/v1/viewer/results/{result_id}/mask-slice?plane={axial|coronal|sagittal}&index={int}`
Streams a raw `Uint8Array` buffer of integer class labels (`0..2` or `0..5`) aligned pixel-for-pixel with the corresponding CT slice.

### `GET /api/v1/viewer/results/{result_id}/mesh`
Returns `AnatomicalMeshResponseDTO` containing physical-space ($\text{mm}$) Marching Cubes triangle vertices, normals, and face indices per anatomical structure.

### Public Live Showcase Endpoints (No Auth Required)
* `GET /api/v1/viewer/showcase/info`: Telemetry and structure list for the public benchmark scan.
* `GET /api/v1/viewer/showcase/slice?plane={plane}&index={index}`: Streams Int16 CT slice binary.
* `GET /api/v1/viewer/showcase/mask-slice?plane={plane}&index={index}`: Streams UInt8 segmentation mask slice binary.
* `GET /api/v1/viewer/showcase/mesh`: Returns Marching Cubes 3D surface mesh JSON.

---

## 5. Dashboard, Reports & NIfTI Exports (`/api/v1/dashboard` & `/api/v1/reports`)

* `GET /api/v1/dashboard/summary` — Real database KPIs, recent jobs, audit trail, and live `psutil` host CPU/RAM telemetry.
* `GET /api/v1/reports/{result_id}/export-mask` — Downloads the native-geometry `.nii.gz` segmentation mask (`application/gzip`).
* `GET /api/v1/reports/{result_id}/export-pdf` — Generates and downloads a formatted PDF Quantitative Research Report (`application/pdf`).
* `GET /api/v1/reports/{result_id}/export-json` — Generates and downloads the full JSON telemetry report (`application/json`).

