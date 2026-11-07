"""Study and Medical Scan ingestion API endpoints."""
from pathlib import Path
import shutil
import tempfile
from typing import List, Optional
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, status
import numpy as np
import SimpleITK as sitk
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, record_audit_event
from app.core.config import settings
from app.db.session import get_db
from app.ml.phantom_generator import generate_thoracic_ct_phantom, write_dicom_zip_from_sitk
from app.ml.preprocessor import (
    MedicalImageValidationError,
    PreprocessedScanArtifact,
    ingest_uploaded_scan,
)
from app.models.entities import MedicalScan, SegmentationJob, Study, User
from app.schemas.dtos import (
    Dimensions3D,
    HURange,
    ScanMetadataDTO,
    Spacing3D,
    StudyCreateRequest,
    StudyResponseDTO,
)
from app.services.storage import storage_service


router = APIRouter(prefix="/api/v1", tags=["Studies & Medical Scans"])


def _build_scan_dto(scan: MedicalScan) -> ScanMetadataDTO:
    latest_status: Optional[str] = None
    latest_result_id: Optional[str] = None
    if scan.segmentation_jobs:
        sorted_jobs = sorted(scan.segmentation_jobs, key=lambda j: j.created_at, reverse=True)
        latest_job = sorted_jobs[0]
        latest_status = latest_job.status
        if latest_job.result:
            latest_result_id = latest_job.result.id
        else:
            for j in sorted_jobs:
                if j.result:
                    latest_result_id = j.result.id
                    break

    return ScanMetadataDTO(
        id=scan.id,
        study_id=scan.study_id,
        original_filename=scan.original_filename,
        file_format=scan.file_format,
        file_size_bytes=scan.file_size_bytes,
        num_slices=scan.num_slices,
        dimensions=Dimensions3D(x=scan.dim_x, y=scan.dim_y, z=scan.dim_z),
        spacing_mm=Spacing3D(x=scan.spacing_x_mm, y=scan.spacing_y_mm, z=scan.spacing_z_mm),
        native_origin_mm=scan.native_origin_mm,
        native_direction=scan.native_direction,
        native_orientation_code=scan.native_orientation_code,
        lps_origin_mm=scan.lps_origin_mm,
        hu_range=HURange(min=scan.hu_min, max=scan.hu_max),
        rescale_slope=scan.rescale_slope,
        rescale_intercept=scan.rescale_intercept,
        is_oblique=scan.is_oblique,
        validation_warnings=scan.validation_warnings or [],
        uploaded_at=scan.uploaded_at,
        latest_job_status=latest_status,
        latest_result_id=latest_result_id,
    )


def _build_study_dto(study: Study) -> StudyResponseDTO:
    scan_dtos = [_build_scan_dto(s) for s in sorted(study.scans, key=lambda x: x.uploaded_at, reverse=True)]
    completed_segs = sum(
        1
        for s in study.scans
        for j in s.segmentation_jobs
        if j.status == "COMPLETED"
    )
    return StudyResponseDTO(
        id=study.id,
        study_code=study.study_code,
        patient_anon_id=study.patient_anon_id,
        title=study.title,
        clinical_notes=study.clinical_notes,
        modality=study.modality,
        acquisition_date=study.acquisition_date,
        status=study.status,
        created_at=study.created_at,
        updated_at=study.updated_at,
        scan_count=len(scan_dtos),
        completed_segmentations=completed_segs,
        scans=scan_dtos,
    )


@router.get("/studies", response_model=List[StudyResponseDTO])
def list_studies(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[StudyResponseDTO]:
    """List all studies accessible to the authenticated researcher."""
    studies = (
        db.query(Study)
        .filter(Study.user_id == current_user.id)
        .order_by(Study.created_at.desc())
        .all()
    )
    return [_build_study_dto(st) for st in studies]


@router.post("/studies", response_model=StudyResponseDTO, status_code=status.HTTP_201_CREATED)
def create_study(
    payload: StudyCreateRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StudyResponseDTO:
    """Create a new medical imaging study container."""
    short_hex = uuid.uuid4().hex[:6].upper()
    study_code = f"PV-2026-{short_hex}"

    study = Study(
        user_id=current_user.id,
        study_code=study_code,
        patient_anon_id=payload.patient_anon_id.strip(),
        title=payload.title.strip(),
        clinical_notes=payload.clinical_notes.strip() if payload.clinical_notes else None,
        modality=payload.modality.upper(),
        acquisition_date=payload.acquisition_date,
        status="ACTIVE",
    )
    db.add(study)
    db.commit()
    db.refresh(study)

    record_audit_event(
        db=db,
        action="STUDY_CREATED",
        resource_type="study",
        resource_id=study.id,
        user_id=current_user.id,
        details={"study_code": study.study_code, "patient_anon_id": study.patient_anon_id},
        request=request,
    )
    return _build_study_dto(study)


@router.get("/studies/{study_id}", response_model=StudyResponseDTO)
def get_study(
    study_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StudyResponseDTO:
    """Retrieve a study and all associated medical scans."""
    study = db.query(Study).filter(Study.id == study_id, Study.user_id == current_user.id).first()
    if not study:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study not found.")
    return _build_study_dto(study)


@router.delete("/studies/{study_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_study(
    study_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Delete a study, its database records, and all associated scan/mask files."""
    study = db.query(Study).filter(Study.id == study_id, Study.user_id == current_user.id).first()
    if not study:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Study not found.")

    active_job = (
        db.query(SegmentationJob)
        .join(MedicalScan, SegmentationJob.scan_id == MedicalScan.id)
        .filter(
            MedicalScan.study_id == study.id,
            SegmentationJob.status.in_(["QUEUED", "PROCESSING"]),
        )
        .first()
    )
    if active_job:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Cannot delete study while a segmentation job is queued or processing.",
        )

    code = study.study_code
    storage_service.delete(f"studies/{study.id}")
    db.delete(study)
    db.commit()

    record_audit_event(
        db=db,
        action="STUDY_DELETED",
        resource_type="study",
        resource_id=study_id,
        user_id=current_user.id,
        details={"study_code": code},
        request=request,
    )


def _persist_ingested_artifact(
    db: Session,
    study: Study,
    artifact: PreprocessedScanArtifact,
    original_filename: str,
    file_sha256: str,
    file_size_bytes: int,
    user_id: str,
    request: Optional[Request] = None,
) -> MedicalScan:
    """Persist native NIfTI and LPS+ Int16 NumPy cache to storage and create MedicalScan row."""
    scan_dir = f"studies/{study.id}/scans/{artifact.scan_id}"
    raw_storage_key = f"{scan_dir}/volume_native.nii.gz"
    raw_target = storage_service.resolve_path(raw_storage_key)
    raw_target.parent.mkdir(parents=True, exist_ok=True)
    sitk.WriteImage(artifact.native_image, str(raw_target), useCompression=True)

    lps_cache_key = f"{scan_dir}/volume_lps_int16.npy"
    lps_target = storage_service.resolve_path(lps_cache_key)
    lps_arr = sitk.GetArrayFromImage(artifact.lps_image).astype(np.int16)
    np.save(str(lps_target), lps_arr)

    nx, ny, nz = artifact.dimensions_xyz
    sx, sy, sz = artifact.spacing_xyz_mm

    scan = MedicalScan(
        id=artifact.scan_id,
        study_id=study.id,
        original_filename=original_filename,
        file_format=artifact.file_format,
        raw_storage_key=raw_storage_key,
        lps_cache_key=lps_cache_key,
        file_sha256=file_sha256,
        file_size_bytes=file_size_bytes,
        num_slices=nz,
        dim_x=nx,
        dim_y=ny,
        dim_z=nz,
        spacing_x_mm=sx,
        spacing_y_mm=sy,
        spacing_z_mm=sz,
        native_origin_mm=artifact.native_origin_mm,
        native_direction=artifact.native_direction,
        native_orientation_code=artifact.native_orientation_code,
        lps_origin_mm=artifact.lps_origin_mm,
        hu_min=artifact.hu_min,
        hu_max=artifact.hu_max,
        rescale_slope=artifact.rescale_slope,
        rescale_intercept=artifact.rescale_intercept,
        is_oblique=artifact.is_oblique,
        validation_warnings=artifact.validation_warnings,
    )
    db.add(scan)
    db.commit()
    db.refresh(scan)

    record_audit_event(
        db=db,
        action="SCAN_UPLOADED",
        resource_type="medical_scan",
        resource_id=scan.id,
        user_id=user_id,
        details={
            "study_id": study.id,
            "filename": original_filename,
            "format": artifact.file_format,
            "dimensions_xyz": [nx, ny, nz],
            "spacing_xyz_mm": [sx, sy, sz],
            "is_oblique": artifact.is_oblique,
        },
        request=request,
    )
    return scan


@router.post("/scans/upload", response_model=ScanMetadataDTO, status_code=status.HTTP_201_CREATED)
def upload_medical_scan(
    request: Request,
    study_id: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScanMetadataDTO:
    """
    Validate and ingest an uploaded Chest CT scan (.nii, .nii.gz, or DICOM .zip).
    Extracts spatial metadata, calibrates Hounsfield Units, and caches LPS+ representation.
    """
    study = db.query(Study).filter(Study.id == study_id, Study.user_id == current_user.id).first()
    if not study:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target study not found.")

    filename = file.filename or "uploaded_scan.nii.gz"
    scan_id = str(uuid.uuid4())
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024

    temp_dir = Path(tempfile.mkdtemp(prefix=f"pv_upload_{scan_id}_"))
    try:
        quarantine_rel = f"quarantine/{scan_id}/{Path(filename).name}"
        try:
            q_path, sha256_hex, size_bytes = storage_service.save_stream(
                quarantine_rel, file.file, max_bytes=max_bytes
            )
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(exc)) from exc

        try:
            artifact = ingest_uploaded_scan(q_path, original_filename=filename, scan_id=scan_id)
        except MedicalImageValidationError as exc:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
        finally:
            storage_service.delete(f"quarantine/{scan_id}")

        scan = _persist_ingested_artifact(
            db=db,
            study=study,
            artifact=artifact,
            original_filename=filename,
            file_sha256=sha256_hex,
            file_size_bytes=size_bytes,
            user_id=current_user.id,
            request=request,
        )
        return _build_scan_dto(scan)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@router.post("/scans/generate-sample", response_model=ScanMetadataDTO, status_code=status.HTTP_201_CREATED)
def generate_sample_thoracic_scan(
    request: Request,
    study_id: str = Query(..., description="Target Study ID"),
    preset: str = Query(
        default="nifti_standard",
        pattern="^(nifti_standard|dicom_axial|dicom_oblique)$",
        description="Sample preset: nifti_standard, dicom_axial, or dicom_oblique",
    ),
    num_slices: int = Query(default=48, ge=16, le=180),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScanMetadataDTO:
    """
    Generate and ingest a calibrated 3D Thoracic CT Benchmark Volume (in NIfTI or oblique/axial DICOM ZIP)
    for reproducible testing, validation, and demonstration.
    """
    study = db.query(Study).filter(Study.id == study_id, Study.user_id == current_user.id).first()
    if not study:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Target study not found.")

    scan_id = str(uuid.uuid4())
    sitk_ct, _ = generate_thoracic_ct_phantom(
        shape_zyx=(num_slices, 256, 256),
        spacing_xyz_mm=(1.25, 1.25, 2.5),
    )

    temp_dir = Path(tempfile.mkdtemp(prefix=f"pv_sample_{scan_id}_"))
    try:
        if preset == "nifti_standard":
            fname = f"thoracic_ct_benchmark_{num_slices}slices.nii.gz"
            fpath = temp_dir / fname
            sitk.WriteImage(sitk_ct, str(fpath), useCompression=True)
        elif preset == "dicom_axial":
            fname = f"thoracic_ct_dicom_axial_{num_slices}slices.zip"
            fpath = temp_dir / fname
            write_dicom_zip_from_sitk(
                sitk_ct,
                fpath,
                patient_id=study.patient_anon_id,
                gantry_tilt_deg=0.0,
                shuffle_filenames=True,
            )
        else:
            fname = f"thoracic_ct_dicom_oblique_12deg_{num_slices}slices.zip"
            fpath = temp_dir / fname
            write_dicom_zip_from_sitk(
                sitk_ct,
                fpath,
                patient_id=study.patient_anon_id,
                gantry_tilt_deg=12.0,
                shuffle_filenames=True,
            )

        raw_bytes = fpath.read_bytes()
        import hashlib
        sha256_hex = hashlib.sha256(raw_bytes).hexdigest()
        artifact = ingest_uploaded_scan(fpath, original_filename=fname, scan_id=scan_id)

        scan = _persist_ingested_artifact(
            db=db,
            study=study,
            artifact=artifact,
            original_filename=fname,
            file_sha256=sha256_hex,
            file_size_bytes=len(raw_bytes),
            user_id=current_user.id,
            request=request,
        )
        return _build_scan_dto(scan)
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@router.get("/scans/{scan_id}", response_model=ScanMetadataDTO)
def get_scan_metadata(
    scan_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ScanMetadataDTO:
    """Retrieve metadata for a specific medical scan."""
    scan = (
        db.query(MedicalScan)
        .join(Study, MedicalScan.study_id == Study.id)
        .filter(MedicalScan.id == scan_id, Study.user_id == current_user.id)
        .first()
    )
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medical scan not found.")
    return _build_scan_dto(scan)

