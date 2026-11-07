"""Pydantic v2 Data Transfer Objects (DTOs) enforcing strict API contracts."""
from datetime import date, datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


# ============================================================================
# Authentication & User Schemas
# ============================================================================
class UserRegisterRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255, pattern=EMAIL_PATTERN)
    password: str = Field(..., min_length=8, max_length=128)
    full_name: str = Field(..., min_length=2, max_length=150)
    role: str = Field(default="researcher", pattern="^(researcher|clinician|admin)$")


class UserLoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255, pattern=EMAIL_PATTERN)
    password: str = Field(..., min_length=1)


class UserResponseDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    created_at: datetime


class TokenResponseDTO(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in_minutes: int
    user: UserResponseDTO


# ============================================================================
# Study & Medical Scan Schemas
# ============================================================================
class StudyCreateRequest(BaseModel):
    patient_anon_id: str = Field(..., min_length=2, max_length=128, description="De-identified subject code")
    title: str = Field(..., min_length=2, max_length=255)
    clinical_notes: Optional[str] = Field(default=None, max_length=4000)
    modality: str = Field(default="CT")
    acquisition_date: Optional[date] = None


class Dimensions3D(BaseModel):
    x: int
    y: int
    z: int


class Spacing3D(BaseModel):
    x: float
    y: float
    z: float


class HURange(BaseModel):
    min: float
    max: float


class ScanMetadataDTO(BaseModel):
    id: str
    study_id: str
    original_filename: str
    file_format: str
    file_size_bytes: int
    num_slices: int
    dimensions: Dimensions3D
    spacing_mm: Spacing3D
    native_origin_mm: List[float]
    native_direction: List[float]
    native_orientation_code: str
    lps_origin_mm: List[float]
    hu_range: HURange
    rescale_slope: float
    rescale_intercept: float
    is_oblique: bool
    validation_warnings: List[str]
    uploaded_at: datetime
    latest_job_status: Optional[str] = None
    latest_result_id: Optional[str] = None


class StudyResponseDTO(BaseModel):
    id: str
    study_code: str
    patient_anon_id: str
    title: str
    clinical_notes: Optional[str]
    modality: str
    acquisition_date: Optional[date]
    status: str
    created_at: datetime
    updated_at: datetime
    scan_count: int = 0
    completed_segmentations: int = 0
    scans: List[ScanMetadataDTO] = Field(default_factory=list)


# ============================================================================
# Model Registry & Segmentation Job Schemas
# ============================================================================
class ModelVersionDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    model_key: str
    display_name: str
    architecture: str
    package_version: str
    task_type: str
    num_classes: int
    label_map: Dict[str, Any]
    weights_url: str
    weights_sha256: str
    license_spdx: str
    citation_doi: str
    description: str
    known_limitations: str
    is_enabled: bool
    weights_cached_locally: bool = False


class SegmentationJobCreateRequest(BaseModel):
    scan_id: str
    model_key: str = Field(default="lungmask_r231")
    batch_size: Optional[int] = Field(default=None, ge=1, le=16)


class MeasurementDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    label_id: int
    structure_key: str
    display_name: str
    color_hex: str
    voxel_count: int
    physical_volume_mm3: float
    physical_volume_ml: float
    volume_fraction_pct: float
    mean_hu: float
    std_hu: float
    min_hu: float
    max_hu: float
    bbox_lps_voxel: List[int]
    computed_at: datetime


class SegmentationResultDTO(BaseModel):
    id: str
    job_id: str
    scan_id: str
    model_key: str
    model_display_name: str
    task_type: str
    label_summary: Dict[str, Any]
    geometry_verified: bool
    execution_time_sec: Optional[float]
    peak_ram_mb: Optional[float]
    created_at: datetime
    measurements: List[MeasurementDTO] = Field(default_factory=list)


class SegmentationJobStatusDTO(BaseModel):
    id: str
    scan_id: str
    study_id: str
    model_key: str
    model_display_name: str
    status: str
    current_stage: str
    progress_percent: int
    batch_size_used: int
    device_used: str
    execution_time_sec: Optional[float]
    peak_ram_mb: Optional[float]
    error_message: Optional[str]
    created_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    result_id: Optional[str] = None


# ============================================================================
# Dashboard & Telemetry Schemas
# ============================================================================
class AuditLogDTO(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    action: str
    resource_type: str
    resource_id: Optional[str]
    details: Dict[str, Any]
    created_at: datetime


class DashboardSummaryDTO(BaseModel):
    total_studies: int
    total_scans: int
    completed_jobs: int
    processing_jobs: int
    queued_jobs: int
    failed_jobs: int
    mean_total_lung_volume_ml: Optional[float]
    mean_inference_time_sec: Optional[float]
    recent_jobs: List[SegmentationJobStatusDTO]
    recent_studies: List[StudyResponseDTO]
    recent_audit_logs: List[AuditLogDTO]
    active_models: List[ModelVersionDTO]
    host_telemetry: Dict[str, Any]
