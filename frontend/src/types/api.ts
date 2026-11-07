export interface UserDTO {
  id: string;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export interface TokenResponseDTO {
  access_token: string;
  token_type: string;
  expires_in_minutes: number;
  user: UserDTO;
}

export interface Dimensions3D {
  x: number;
  y: number;
  z: number;
}

export interface Spacing3D {
  x: number;
  y: number;
  z: number;
}

export interface HURange {
  min: number;
  max: number;
}

export interface ScanMetadataDTO {
  id: string;
  study_id: string;
  original_filename: string;
  file_format: string;
  file_size_bytes: number;
  num_slices: number;
  dimensions: Dimensions3D;
  spacing_mm: Spacing3D;
  native_origin_mm: number[];
  native_direction: number[];
  native_orientation_code: string;
  lps_origin_mm: number[];
  hu_range: HURange;
  rescale_slope: number;
  rescale_intercept: number;
  is_oblique: boolean;
  validation_warnings: string[];
  uploaded_at: string;
  latest_job_status: string | null;
  latest_result_id: string | null;
}

export interface StudyDTO {
  id: string;
  study_code: string;
  patient_anon_id: string;
  title: string;
  clinical_notes: string | null;
  modality: string;
  acquisition_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  scan_count: number;
  completed_segmentations: number;
  scans: ScanMetadataDTO[];
}

export interface LabelMeta {
  key: string;
  name: string;
  color: string;
}

export interface ModelVersionDTO {
  id: string;
  model_key: string;
  display_name: string;
  architecture: string;
  package_version: string;
  task_type: string;
  num_classes: number;
  label_map: Record<string, LabelMeta>;
  weights_url: string;
  weights_sha256: string;
  license_spdx: string;
  citation_doi: string;
  description: string;
  known_limitations: string;
  is_enabled: boolean;
  weights_cached_locally: boolean;
}

export interface MeasurementDTO {
  id: string;
  label_id: number;
  structure_key: string;
  display_name: string;
  color_hex: string;
  voxel_count: number;
  physical_volume_mm3: number;
  physical_volume_ml: number;
  volume_fraction_pct: number;
  mean_hu: number;
  std_hu: number;
  min_hu: number;
  max_hu: number;
  bbox_lps_voxel: number[];
  computed_at: string;
}

export interface SegmentationResultDTO {
  id: string;
  job_id: string;
  scan_id: string;
  model_key: string;
  model_display_name: string;
  task_type: string;
  label_summary: Record<string, number>;
  geometry_verified: boolean;
  execution_time_sec: number | null;
  peak_ram_mb: number | null;
  created_at: string;
  measurements: MeasurementDTO[];
}

export interface SegmentationJobStatusDTO {
  id: string;
  scan_id: string;
  study_id: string;
  model_key: string;
  model_display_name: string;
  status: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  current_stage: string;
  progress_percent: number;
  batch_size_used: number;
  device_used: string;
  execution_time_sec: number | null;
  peak_ram_mb: number | null;
  error_message: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  result_id: string | null;
}

export interface AuditLogDTO {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface DashboardSummaryDTO {
  total_studies: number;
  total_scans: number;
  completed_jobs: number;
  processing_jobs: number;
  queued_jobs: number;
  failed_jobs: number;
  mean_total_lung_volume_ml: number | null;
  mean_inference_time_sec: number | null;
  recent_jobs: SegmentationJobStatusDTO[];
  recent_studies: StudyDTO[];
  recent_audit_logs: AuditLogDTO[];
  active_models: ModelVersionDTO[];
  host_telemetry: {
    os: string;
    cpu_cores_logical: number;
    cpu_cores_physical: number;
    ram_total_gb: number;
    ram_available_gb: number;
    ram_percent_used: number;
    backend_rss_mb: number;
    inference_device: string;
    inference_batch_size: number;
    inference_cpu_threads: number;
  };
}

export interface AnatomicalMeshStructure {
  label_id: number;
  structure_key: string;
  display_name: string;
  color_hex: string;
  vertex_count: number;
  face_count: number;
  vertices_flat: number[];
  normals_flat: number[];
  faces_flat: number[];
}

export interface AnatomicalMeshResponseDTO {
  result_id: string;
  coordinate_system: string;
  volume_dimensions_xyz: number[];
  spacing_xyz_mm: number[];
  structures: AnatomicalMeshStructure[];
}

export type MPRPlane = 'axial' | 'coronal' | 'sagittal';

export interface BinaryCTSlicePayload {
  width: number;
  height: number;
  spacingHorizMM: number;
  spacingVertMM: number;
  plane: MPRPlane;
  sliceIndex: number;
  huData: Int16Array;
}

export interface BinaryMaskSlicePayload {
  width: number;
  height: number;
  maskData: Uint8Array;
}

