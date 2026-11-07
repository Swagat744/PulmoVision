"""Normalized 9-table SQLAlchemy 2.0 ORM schema for PulmoVision AI."""
from datetime import date, datetime, timezone
from typing import Any, Dict, List, Optional
import uuid

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def new_uuid() -> str:
    return str(uuid.uuid4())


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    role: Mapped[str] = mapped_column(String(32), nullable=False, default="researcher")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )

    studies: Mapped[List["Study"]] = relationship(
        "Study", back_populates="owner", cascade="all, delete-orphan"
    )
    audit_logs: Mapped[List["AuditLog"]] = relationship("AuditLog", back_populates="user")


class Study(Base):
    __tablename__ = "studies"
    __table_args__ = (
        Index("ix_studies_user_created", "user_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    study_code: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    patient_anon_id: Mapped[str] = mapped_column(String(128), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    clinical_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    modality: Mapped[str] = mapped_column(String(16), nullable=False, default="CT")
    acquisition_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="ACTIVE")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=utc_now, onupdate=utc_now
    )

    owner: Mapped["User"] = relationship("User", back_populates="studies")
    scans: Mapped[List["MedicalScan"]] = relationship(
        "MedicalScan", back_populates="study", cascade="all, delete-orphan"
    )


class MedicalScan(Base):
    __tablename__ = "medical_scans"
    __table_args__ = (
        Index("ix_scans_study_id", "study_id"),
        CheckConstraint("dim_x > 0 AND dim_y > 0 AND dim_z > 0", name="ck_scans_positive_dims"),
        CheckConstraint(
            "spacing_x_mm > 0 AND spacing_y_mm > 0 AND spacing_z_mm > 0",
            name="ck_scans_positive_spacing",
        ),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    study_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("studies.id", ondelete="CASCADE"), nullable=False
    )
    original_filename: Mapped[str] = mapped_column(String(255), nullable=False)
    file_format: Mapped[str] = mapped_column(String(16), nullable=False)  # DICOM_ZIP, DICOM_SERIES, NIFTI
    raw_storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    lps_cache_key: Mapped[str] = mapped_column(String(512), nullable=False)
    file_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)
    num_slices: Mapped[int] = mapped_column(Integer, nullable=False)
    dim_x: Mapped[int] = mapped_column(Integer, nullable=False)
    dim_y: Mapped[int] = mapped_column(Integer, nullable=False)
    dim_z: Mapped[int] = mapped_column(Integer, nullable=False)
    spacing_x_mm: Mapped[float] = mapped_column(Float, nullable=False)
    spacing_y_mm: Mapped[float] = mapped_column(Float, nullable=False)
    spacing_z_mm: Mapped[float] = mapped_column(Float, nullable=False)
    native_origin_mm: Mapped[List[float]] = mapped_column(JSON, nullable=False)
    native_direction: Mapped[List[float]] = mapped_column(JSON, nullable=False)
    native_orientation_code: Mapped[str] = mapped_column(String(8), nullable=False)
    lps_origin_mm: Mapped[List[float]] = mapped_column(JSON, nullable=False)
    hu_min: Mapped[float] = mapped_column(Float, nullable=False)
    hu_max: Mapped[float] = mapped_column(Float, nullable=False)
    rescale_slope: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)
    rescale_intercept: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    is_oblique: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    validation_warnings: Mapped[List[str]] = mapped_column(JSON, nullable=False, default=list)
    uploaded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)

    study: Mapped["Study"] = relationship("Study", back_populates="scans")
    segmentation_jobs: Mapped[List["SegmentationJob"]] = relationship(
        "SegmentationJob", back_populates="scan", cascade="all, delete-orphan"
    )


class ModelVersion(Base):
    __tablename__ = "model_versions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    model_key: Mapped[str] = mapped_column(String(64), unique=True, nullable=False, index=True)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    architecture: Mapped[str] = mapped_column(String(64), nullable=False)
    package_version: Mapped[str] = mapped_column(String(32), nullable=False)
    task_type: Mapped[str] = mapped_column(String(64), nullable=False)  # left_right_lung | five_lobes
    num_classes: Mapped[int] = mapped_column(Integer, nullable=False)
    label_map: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    weights_url: Mapped[str] = mapped_column(String(512), nullable=False)
    weights_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    license_spdx: Mapped[str] = mapped_column(String(64), nullable=False, default="Apache-2.0")
    citation_doi: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    known_limitations: Mapped[str] = mapped_column(Text, nullable=False)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    registered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)

    jobs: Mapped[List["SegmentationJob"]] = relationship("SegmentationJob", back_populates="model_version")


class SegmentationJob(Base):
    __tablename__ = "segmentation_jobs"
    __table_args__ = (
        Index("ix_jobs_scan_status", "scan_id", "status"),
        Index("ix_jobs_status_created", "status", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    scan_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("medical_scans.id", ondelete="CASCADE"), nullable=False
    )
    model_version_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("model_versions.id", ondelete="RESTRICT"), nullable=False
    )
    requested_by_user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="QUEUED"
    )  # QUEUED, PROCESSING, COMPLETED, FAILED, CANCELLED
    current_stage: Mapped[str] = mapped_column(String(64), nullable=False, default="Queued")
    progress_percent: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    batch_size_used: Mapped[int] = mapped_column(Integer, nullable=False, default=4)
    device_used: Mapped[str] = mapped_column(String(16), nullable=False, default="cpu")
    execution_time_sec: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    peak_ram_mb: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    scan: Mapped["MedicalScan"] = relationship("MedicalScan", back_populates="segmentation_jobs")
    model_version: Mapped["ModelVersion"] = relationship("ModelVersion", back_populates="jobs")
    result: Mapped[Optional["SegmentationResult"]] = relationship(
        "SegmentationResult", back_populates="job", uselist=False, cascade="all, delete-orphan"
    )


class SegmentationResult(Base):
    __tablename__ = "segmentation_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    job_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("segmentation_jobs.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    native_mask_key: Mapped[str] = mapped_column(String(512), nullable=False)
    lps_mask_cache_key: Mapped[str] = mapped_column(String(512), nullable=False)
    mesh_storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    mask_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    label_summary: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    geometry_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)

    job: Mapped["SegmentationJob"] = relationship("SegmentationJob", back_populates="result")
    measurements: Mapped[List["Measurement"]] = relationship(
        "Measurement", back_populates="result", cascade="all, delete-orphan"
    )
    reports: Mapped[List["Report"]] = relationship(
        "Report", back_populates="result", cascade="all, delete-orphan"
    )


class Measurement(Base):
    __tablename__ = "measurements"
    __table_args__ = (
        UniqueConstraint("result_id", "label_id", name="uq_measurement_result_label"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    result_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("segmentation_results.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label_id: Mapped[int] = mapped_column(Integer, nullable=False)  # 0=Total Combined Lung, 1..5=Individual
    structure_key: Mapped[str] = mapped_column(String(64), nullable=False)
    display_name: Mapped[str] = mapped_column(String(128), nullable=False)
    color_hex: Mapped[str] = mapped_column(String(16), nullable=False)
    voxel_count: Mapped[int] = mapped_column(BigInteger, nullable=False)
    physical_volume_mm3: Mapped[float] = mapped_column(Float, nullable=False)
    physical_volume_ml: Mapped[float] = mapped_column(Float, nullable=False)
    volume_fraction_pct: Mapped[float] = mapped_column(Float, nullable=False)
    mean_hu: Mapped[float] = mapped_column(Float, nullable=False)
    std_hu: Mapped[float] = mapped_column(Float, nullable=False)
    min_hu: Mapped[float] = mapped_column(Float, nullable=False)
    max_hu: Mapped[float] = mapped_column(Float, nullable=False)
    bbox_lps_voxel: Mapped[List[int]] = mapped_column(JSON, nullable=False)
    computed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)

    result: Mapped["SegmentationResult"] = relationship("SegmentationResult", back_populates="measurements")


class Report(Base):
    __tablename__ = "reports"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    result_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("segmentation_results.id", ondelete="CASCADE"), nullable=False, index=True
    )
    generated_by_user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    report_format: Mapped[str] = mapped_column(String(32), nullable=False)  # PDF, JSON
    storage_key: Mapped[str] = mapped_column(String(512), nullable=False)
    file_sha256: Mapped[str] = mapped_column(String(64), nullable=False)
    report_payload: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)

    result: Mapped["SegmentationResult"] = relationship("SegmentationResult", back_populates="reports")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    __table_args__ = (
        Index("ix_audit_created", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=new_uuid)
    user_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(64), nullable=False)
    resource_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    details: Mapped[Dict[str, Any]] = mapped_column(JSON, nullable=False, default=dict)
    ip_address: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=utc_now)

    user: Mapped[Optional["User"]] = relationship("User", back_populates="audit_logs")

