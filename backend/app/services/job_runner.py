"""Memory-bounded single-worker background job executor for lung segmentation."""
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import gc
import hashlib
import json

import numpy as np
import SimpleITK as sitk

from app.core.config import settings
from app.core.logging import logger
from app.db.session import SessionLocal
from app.ml.adapters import get_segmentation_adapter
from app.ml.metrics import compute_morphometric_measurements
from app.ml.postprocessor import extract_anatomical_3d_meshes
from app.models.entities import (
    AuditLog,
    Measurement,
    MedicalScan,
    ModelVersion,
    SegmentationJob,
    SegmentationResult,
)
from app.services.storage import storage_service


_executor = ThreadPoolExecutor(
    max_workers=settings.MAX_CONCURRENT_JOBS,
    thread_name_prefix="pulmovision_ai_worker",
)


def execute_segmentation_job_sync(job_id: str) -> None:
    """
    Execute a segmentation job end-to-end:
    1. Load native SimpleITK volume from storage.
    2. Run verified LungMask adapter with progress updates.
    3. Verify spatial metadata preservation and write native .nii.gz mask.
    4. Write canonical LPS+ mask cache (.npy) and 3D Marching Cubes mesh (.json).
    5. Compute physical volumes (mL) and HU statistics and persist Measurement rows.
    """
    db = SessionLocal()
    try:
        job = db.query(SegmentationJob).filter(SegmentationJob.id == job_id).first()
        if not job:
            logger.error(f"SegmentationJob '{job_id}' not found.")
            return
        if job.status == "CANCELLED":
            logger.info(f"SegmentationJob '{job_id}' was cancelled before execution.")
            return

        scan = db.query(MedicalScan).filter(MedicalScan.id == job.scan_id).first()
        model_ver = db.query(ModelVersion).filter(ModelVersion.id == job.model_version_id).first()
        if not scan or not model_ver:
            job.status = "FAILED"
            job.error_message = "Associated MedicalScan or ModelVersion record is missing."
            job.completed_at = datetime.now(timezone.utc)
            db.commit()
            return

        job.status = "PROCESSING"
        job.started_at = datetime.now(timezone.utc)
        job.progress_percent = 5
        job.current_stage = "Loading calibrated CT volume from storage"
        db.commit()

        def _on_progress(pct: int, stage: str) -> None:
            try:
                job.progress_percent = pct
                job.current_stage = stage
                db.commit()
            except Exception:
                db.rollback()

        raw_nifti_path = storage_service.resolve_path(scan.raw_storage_key)
        native_image = sitk.ReadImage(str(raw_nifti_path))

        adapter = get_segmentation_adapter(model_ver.model_key)
        adapter_out = adapter.predict(
            native_image=native_image,
            batch_size=job.batch_size_used or settings.INFERENCE_BATCH_SIZE,
            progress_callback=_on_progress,
        )

        _on_progress(88, "Saving native-geometry NIfTI segmentation mask")
        result_dir = f"studies/{scan.study_id}/scans/{scan.id}/results/{job.id}"
        native_mask_key = f"{result_dir}/segmentation_mask_native.nii.gz"
        native_mask_path = storage_service.resolve_path(native_mask_key)
        native_mask_path.parent.mkdir(parents=True, exist_ok=True)
        sitk.WriteImage(adapter_out.native_mask_image, str(native_mask_path), useCompression=True)
        mask_sha256 = hashlib.sha256(native_mask_path.read_bytes()).hexdigest()

        # Save canonical LPS+ uint8 array for fast 2D MPR slice serving
        lps_mask_cache_key = f"{result_dir}/mask_lps_uint8.npy"
        lps_mask_path = storage_service.resolve_path(lps_mask_cache_key)
        lps_mask_arr = sitk.GetArrayFromImage(adapter_out.lps_mask_image).astype(np.uint8)
        np.save(str(lps_mask_path), lps_mask_arr)

        _on_progress(92, "Extracting physical-space (mm) 3D surface mesh via Marching Cubes")
        mesh_dict = extract_anatomical_3d_meshes(
            lps_mask_image=adapter_out.lps_mask_image,
            label_map=model_ver.label_map,
            step_size=2,
        )
        mesh_storage_key = f"{result_dir}/anatomical_mesh_3d.json"
        storage_service.save_bytes(mesh_storage_key, json.dumps(mesh_dict).encode("utf-8"))

        _on_progress(96, "Computing geometry-aware physical volumes (mL) & HU statistics")
        lps_ct_orient = sitk.DICOMOrientImageFilter_GetOrientationFromDirectionCosines(
            native_image.GetDirection()
        )
        lps_ct_image = (
            sitk.DICOMOrient(native_image, "LPS") if lps_ct_orient != "LPS" else native_image
        )
        computed_metrics = compute_morphometric_measurements(
            lps_ct_image=lps_ct_image,
            lps_mask_image=adapter_out.lps_mask_image,
            label_map=model_ver.label_map,
        )

        seg_result = SegmentationResult(
            job_id=job.id,
            native_mask_key=native_mask_key,
            lps_mask_cache_key=lps_mask_cache_key,
            mesh_storage_key=mesh_storage_key,
            mask_sha256=mask_sha256,
            label_summary=adapter_out.label_summary,
            geometry_verified=adapter_out.geometry_verified,
        )
        db.add(seg_result)
        db.flush()

        for m in computed_metrics:
            db.add(
                Measurement(
                    result_id=seg_result.id,
                    label_id=m.label_id,
                    structure_key=m.structure_key,
                    display_name=m.display_name,
                    color_hex=m.color_hex,
                    voxel_count=m.voxel_count,
                    physical_volume_mm3=m.physical_volume_mm3,
                    physical_volume_ml=m.physical_volume_ml,
                    volume_fraction_pct=m.volume_fraction_pct,
                    mean_hu=m.mean_hu,
                    std_hu=m.std_hu,
                    min_hu=m.min_hu,
                    max_hu=m.max_hu,
                    bbox_lps_voxel=m.bbox_lps_voxel,
                )
            )

        job.status = "COMPLETED"
        job.current_stage = "Completed"
        job.progress_percent = 100
        job.execution_time_sec = adapter_out.execution_time_sec
        job.peak_ram_mb = adapter_out.peak_ram_mb
        job.device_used = adapter_out.device_used
        job.completed_at = datetime.now(timezone.utc)

        db.add(
            AuditLog(
                user_id=job.requested_by_user_id,
                action="SEGMENTATION_JOB_COMPLETED",
                resource_type="segmentation_job",
                resource_id=job.id,
                details={
                    "scan_id": scan.id,
                    "model_key": model_ver.model_key,
                    "result_id": seg_result.id,
                    "execution_time_sec": adapter_out.execution_time_sec,
                    "peak_ram_mb": adapter_out.peak_ram_mb,
                },
            )
        )
        db.commit()
        logger.info(
            f"Job {job.id} COMPLETED in {adapter_out.execution_time_sec:.2f}s "
            f"(peak RSS: {adapter_out.peak_ram_mb:.1f} MB)."
        )
    except Exception as exc:
        logger.exception(f"SegmentationJob '{job_id}' failed: {exc}")
        db.rollback()
        try:
            failed_job = db.query(SegmentationJob).filter(SegmentationJob.id == job_id).first()
            if failed_job:
                failed_job.status = "FAILED"
                failed_job.current_stage = "Failed"
                failed_job.error_message = str(exc)
                failed_job.completed_at = datetime.now(timezone.utc)
                db.add(
                    AuditLog(
                        user_id=failed_job.requested_by_user_id,
                        action="SEGMENTATION_JOB_FAILED",
                        resource_type="segmentation_job",
                        resource_id=failed_job.id,
                        details={"error": str(exc)},
                    )
                )
                db.commit()
        except Exception:
            db.rollback()
    finally:
        db.close()
        gc.collect()


def enqueue_segmentation_job(job_id: str) -> None:
    """Submit a segmentation job ID to the single-worker background executor."""
    _executor.submit(execute_segmentation_job_sync, job_id)

