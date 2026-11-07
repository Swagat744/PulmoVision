"""AI Segmentation Jobs, Results, and Model Registry API endpoints."""
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, record_audit_event
from app.core.config import settings
from app.db.session import get_db
from app.ml.adapters import get_segmentation_adapter
from app.models.entities import (
    MedicalScan,
    ModelVersion,
    SegmentationJob,
    SegmentationResult,
    Study,
    User,
)
from app.schemas.dtos import (
    MeasurementDTO,
    ModelVersionDTO,
    SegmentationJobCreateRequest,
    SegmentationJobStatusDTO,
    SegmentationResultDTO,
)
from app.services.job_runner import enqueue_segmentation_job, execute_segmentation_job_sync


router = APIRouter(prefix="/api/v1", tags=["AI Segmentation & Model Registry"])


def _build_model_dto(mv: ModelVersion) -> ModelVersionDTO:
    cached = False
    try:
        adapter = get_segmentation_adapter(mv.model_key)
        cached = adapter.is_weights_cached()
    except Exception:
        cached = False
    dto = ModelVersionDTO.model_validate(mv)
    dto.weights_cached_locally = cached
    return dto


def _build_job_dto(job: SegmentationJob) -> SegmentationJobStatusDTO:
    return SegmentationJobStatusDTO(
        id=job.id,
        scan_id=job.scan_id,
        study_id=job.scan.study_id if job.scan else "",
        model_key=job.model_version.model_key if job.model_version else "",
        model_display_name=job.model_version.display_name if job.model_version else "",
        status=job.status,
        current_stage=job.current_stage,
        progress_percent=job.progress_percent,
        batch_size_used=job.batch_size_used,
        device_used=job.device_used,
        execution_time_sec=job.execution_time_sec,
        peak_ram_mb=job.peak_ram_mb,
        error_message=job.error_message,
        created_at=job.created_at,
        started_at=job.started_at,
        completed_at=job.completed_at,
        result_id=job.result.id if job.result else None,
    )


def _build_result_dto(res: SegmentationResult) -> SegmentationResultDTO:
    job = res.job
    mv = job.model_version
    measurements = [
        MeasurementDTO.model_validate(m)
        for m in sorted(res.measurements, key=lambda x: x.label_id)
    ]
    return SegmentationResultDTO(
        id=res.id,
        job_id=job.id,
        scan_id=job.scan_id,
        model_key=mv.model_key,
        model_display_name=mv.display_name,
        task_type=mv.task_type,
        label_summary=res.label_summary,
        geometry_verified=res.geometry_verified,
        execution_time_sec=job.execution_time_sec,
        peak_ram_mb=job.peak_ram_mb,
        created_at=res.created_at,
        measurements=measurements,
    )


@router.get("/models", response_model=List[ModelVersionDTO])
def list_registered_models(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[ModelVersionDTO]:
    """Return all registered and verified AI segmentation models and their weight cache status."""
    models = db.query(ModelVersion).filter(ModelVersion.is_enabled == True).all()  # noqa: E712
    return [_build_model_dto(m) for m in models]


@router.post(
    "/segmentation/jobs",
    response_model=SegmentationJobStatusDTO,
    status_code=status.HTTP_202_ACCEPTED,
)
def submit_segmentation_job(
    payload: SegmentationJobCreateRequest,
    request: Request,
    sync: bool = Query(default=False, description="Execute synchronously (used for integration tests)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SegmentationJobStatusDTO:
    """Enqueue an asynchronous lung segmentation job on the memory-bounded worker."""
    scan = (
        db.query(MedicalScan)
        .join(Study, MedicalScan.study_id == Study.id)
        .filter(MedicalScan.id == payload.scan_id, Study.user_id == current_user.id)
        .first()
    )
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medical scan not found.")

    model_ver = (
        db.query(ModelVersion)
        .filter(ModelVersion.model_key == payload.model_key, ModelVersion.is_enabled == True)  # noqa: E712
        .first()
    )
    if not model_ver:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Segmentation model '{payload.model_key}' is not registered or enabled.",
        )

    effective_batch = payload.batch_size or settings.INFERENCE_BATCH_SIZE
    job = SegmentationJob(
        scan_id=scan.id,
        model_version_id=model_ver.id,
        requested_by_user_id=current_user.id,
        status="QUEUED",
        current_stage="Queued for inference worker",
        progress_percent=0,
        batch_size_used=effective_batch,
        device_used=settings.INFERENCE_DEVICE,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    record_audit_event(
        db=db,
        action="SEGMENTATION_JOB_QUEUED",
        resource_type="segmentation_job",
        resource_id=job.id,
        user_id=current_user.id,
        details={"scan_id": scan.id, "model_key": model_ver.model_key, "batch_size": effective_batch},
        request=request,
    )

    if sync:
        execute_segmentation_job_sync(job.id)
        db.expire_all()
        job = db.query(SegmentationJob).filter(SegmentationJob.id == job.id).first()  # type: ignore[assignment]
    else:
        enqueue_segmentation_job(job.id)

    return _build_job_dto(job)


@router.get("/segmentation/jobs", response_model=List[SegmentationJobStatusDTO])
def list_segmentation_jobs(
    scan_id: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[SegmentationJobStatusDTO]:
    """List segmentation jobs for the authenticated user, optionally filtered by scan_id."""
    q = (
        db.query(SegmentationJob)
        .join(MedicalScan, SegmentationJob.scan_id == MedicalScan.id)
        .join(Study, MedicalScan.study_id == Study.id)
        .filter(Study.user_id == current_user.id)
    )
    if scan_id:
        q = q.filter(SegmentationJob.scan_id == scan_id)
    jobs = q.order_by(SegmentationJob.created_at.desc()).limit(50).all()
    return [_build_job_dto(j) for j in jobs]


@router.get("/segmentation/jobs/{job_id}", response_model=SegmentationJobStatusDTO)
def get_segmentation_job_status(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SegmentationJobStatusDTO:
    """Poll the live progress and status of a segmentation job."""
    job = (
        db.query(SegmentationJob)
        .join(MedicalScan, SegmentationJob.scan_id == MedicalScan.id)
        .join(Study, MedicalScan.study_id == Study.id)
        .filter(SegmentationJob.id == job_id, Study.user_id == current_user.id)
        .first()
    )
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segmentation job not found.")
    return _build_job_dto(job)


@router.post("/segmentation/jobs/{job_id}/cancel", response_model=SegmentationJobStatusDTO)
def cancel_segmentation_job(
    job_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SegmentationJobStatusDTO:
    """Cancel a queued segmentation job."""
    job = (
        db.query(SegmentationJob)
        .join(MedicalScan, SegmentationJob.scan_id == MedicalScan.id)
        .join(Study, MedicalScan.study_id == Study.id)
        .filter(SegmentationJob.id == job_id, Study.user_id == current_user.id)
        .first()
    )
    if not job:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segmentation job not found.")
    if job.status != "QUEUED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Only QUEUED jobs can be cancelled (current status: {job.status}).",
        )
    job.status = "CANCELLED"
    job.current_stage = "Cancelled by user"
    job.completed_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(job)
    return _build_job_dto(job)


@router.get("/segmentation/results/{result_id}", response_model=SegmentationResultDTO)
def get_segmentation_result(
    result_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SegmentationResultDTO:
    """Retrieve a completed segmentation result and all quantitative structure measurements."""
    res = (
        db.query(SegmentationResult)
        .join(SegmentationJob, SegmentationResult.job_id == SegmentationJob.id)
        .join(MedicalScan, SegmentationJob.scan_id == MedicalScan.id)
        .join(Study, MedicalScan.study_id == Study.id)
        .filter(SegmentationResult.id == result_id, Study.user_id == current_user.id)
        .first()
    )
    if not res:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segmentation result not found.")
    return _build_result_dto(res)


@router.get("/segmentation/scans/{scan_id}/results", response_model=List[SegmentationResultDTO])
def list_scan_segmentation_results(
    scan_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> List[SegmentationResultDTO]:
    """List all completed segmentation results for a scan (enabling multi-model comparison)."""
    results = (
        db.query(SegmentationResult)
        .join(SegmentationJob, SegmentationResult.job_id == SegmentationJob.id)
        .join(MedicalScan, SegmentationJob.scan_id == MedicalScan.id)
        .join(Study, MedicalScan.study_id == Study.id)
        .filter(MedicalScan.id == scan_id, Study.user_id == current_user.id)
        .order_by(SegmentationResult.created_at.desc())
        .all()
    )
    return [_build_result_dto(r) for r in results]

