"""Dashboard telemetry, NIfTI mask exports, and PDF/JSON research report generation."""
from datetime import datetime, timezone
import hashlib
import io
import json
import platform
from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import FileResponse
import psutil
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, record_audit_event
from app.api.segmentation import _build_job_dto, _build_model_dto
from app.api.studies import _build_study_dto
from app.core.config import settings
from app.db.session import get_db
from app.models.entities import (
    AuditLog,
    Measurement,
    MedicalScan,
    ModelVersion,
    Report,
    SegmentationJob,
    SegmentationResult,
    Study,
    User,
)
from app.schemas.dtos import AuditLogDTO, DashboardSummaryDTO
from app.services.storage import storage_service


router = APIRouter(prefix="/api/v1", tags=["Dashboard, Reports & Exports"])


@router.get("/dashboard/summary", response_model=DashboardSummaryDTO)
def get_dashboard_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DashboardSummaryDTO:
    """Return real database-derived platform statistics and live host hardware telemetry."""
    studies = (
        db.query(Study)
        .filter(Study.user_id == current_user.id)
        .order_by(Study.created_at.desc())
        .all()
    )
    total_studies = len(studies)
    total_scans = sum(len(s.scans) for s in studies)

    all_jobs = (
        db.query(SegmentationJob)
        .join(MedicalScan, SegmentationJob.scan_id == MedicalScan.id)
        .join(Study, MedicalScan.study_id == Study.id)
        .filter(Study.user_id == current_user.id)
        .order_by(SegmentationJob.created_at.desc())
        .all()
    )

    completed_jobs = [j for j in all_jobs if j.status == "COMPLETED"]
    processing_jobs = [j for j in all_jobs if j.status == "PROCESSING"]
    queued_jobs = [j for j in all_jobs if j.status == "QUEUED"]
    failed_jobs = [j for j in all_jobs if j.status == "FAILED"]

    # Mean inference time across completed jobs
    exec_times = [j.execution_time_sec for j in completed_jobs if j.execution_time_sec is not None]
    mean_inf_time = round(sum(exec_times) / len(exec_times), 2) if exec_times else None

    # Mean total lung volume across completed results (label_id == 0)
    total_lung_vols = (
        db.query(Measurement.physical_volume_ml)
        .join(SegmentationResult, Measurement.result_id == SegmentationResult.id)
        .join(SegmentationJob, SegmentationResult.job_id == SegmentationJob.id)
        .join(MedicalScan, SegmentationJob.scan_id == MedicalScan.id)
        .join(Study, MedicalScan.study_id == Study.id)
        .filter(
            Study.user_id == current_user.id,
            Measurement.label_id == 0,
            Measurement.physical_volume_ml > 0,
        )
        .all()
    )
    vols = [float(r[0]) for r in total_lung_vols]
    mean_vol_ml = round(sum(vols) / len(vols), 2) if vols else None

    recent_audit = (
        db.query(AuditLog)
        .filter(AuditLog.user_id == current_user.id)
        .order_by(AuditLog.created_at.desc())
        .limit(12)
        .all()
    )

    models = db.query(ModelVersion).filter(ModelVersion.is_enabled == True).all()  # noqa: E712

    vm = psutil.virtual_memory()
    proc = psutil.Process()
    host_telemetry: Dict[str, Any] = {
        "os": f"{platform.system()} {platform.release()}",
        "cpu_cores_logical": psutil.cpu_count(logical=True),
        "cpu_cores_physical": psutil.cpu_count(logical=False),
        "ram_total_gb": round(vm.total / (1024**3), 2),
        "ram_available_gb": round(vm.available / (1024**3), 2),
        "ram_percent_used": vm.percent,
        "backend_rss_mb": round(proc.memory_info().rss / (1024**2), 1),
        "inference_device": settings.INFERENCE_DEVICE.upper(),
        "inference_batch_size": settings.INFERENCE_BATCH_SIZE,
        "inference_cpu_threads": settings.INFERENCE_CPU_THREADS,
    }

    return DashboardSummaryDTO(
        total_studies=total_studies,
        total_scans=total_scans,
        completed_jobs=len(completed_jobs),
        processing_jobs=len(processing_jobs),
        queued_jobs=len(queued_jobs),
        failed_jobs=len(failed_jobs),
        mean_total_lung_volume_ml=mean_vol_ml,
        mean_inference_time_sec=mean_inf_time,
        recent_jobs=[_build_job_dto(j) for j in all_jobs[:8]],
        recent_studies=[_build_study_dto(st) for st in studies[:6]],
        recent_audit_logs=[AuditLogDTO.model_validate(a) for a in recent_audit],
        active_models=[_build_model_dto(m) for m in models],
        host_telemetry=host_telemetry,
    )


def _assemble_report_payload(res: SegmentationResult) -> Dict[str, Any]:
    job = res.job
    scan = job.scan
    study = scan.study
    mv = job.model_version
    measurements = sorted(res.measurements, key=lambda x: x.label_id)

    return {
        "report_title": "PulmoVision AI — Quantitative Thoracic CT Segmentation Research Report",
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "scientific_disclaimer": (
            "RESEARCH & EDUCATIONAL USE ONLY: This report and all segmentation volumes were generated "
            "automatically by PulmoVision AI for scientific research and educational visualization. "
            "This system is NOT a clinical diagnostic device, holds no regulatory approval (CDSCO/FDA/CE), "
            "and must not be used for clinical decision-making or patient diagnosis."
        ),
        "study": {
            "study_id": study.id,
            "study_code": study.study_code,
            "patient_anonymized_id": study.patient_anon_id,
            "title": study.title,
            "modality": study.modality,
            "acquisition_date": str(study.acquisition_date) if study.acquisition_date else None,
            "clinical_notes": study.clinical_notes,
        },
        "scan_geometry": {
            "scan_id": scan.id,
            "original_filename": scan.original_filename,
            "file_format": scan.file_format,
            "file_sha256": scan.file_sha256,
            "dimensions_xyz": [scan.dim_x, scan.dim_y, scan.dim_z],
            "voxel_spacing_mm": [scan.spacing_x_mm, scan.spacing_y_mm, scan.spacing_z_mm],
            "voxel_volume_mm3": round(scan.spacing_x_mm * scan.spacing_y_mm * scan.spacing_z_mm, 4),
            "native_orientation_code": scan.native_orientation_code,
            "native_origin_mm": scan.native_origin_mm,
            "native_direction_cosines": scan.native_direction,
            "is_oblique_acquisition": scan.is_oblique,
            "hu_min_max": [scan.hu_min, scan.hu_max],
        },
        "ai_model_provenance": {
            "model_key": mv.model_key,
            "display_name": mv.display_name,
            "architecture": mv.architecture,
            "package_version": mv.package_version,
            "task_type": mv.task_type,
            "license_spdx": mv.license_spdx,
            "citation_doi": mv.citation_doi,
            "weights_sha256_prefix": mv.weights_sha256,
            "execution_time_sec": job.execution_time_sec,
            "peak_ram_mb": job.peak_ram_mb,
            "device_used": job.device_used,
            "batch_size_used": job.batch_size_used,
            "spatial_geometry_verified": res.geometry_verified,
        },
        "quantitative_measurements": [
            {
                "label_id": m.label_id,
                "structure_key": m.structure_key,
                "display_name": m.display_name,
                "voxel_count": m.voxel_count,
                "physical_volume_mm3": m.physical_volume_mm3,
                "physical_volume_ml": m.physical_volume_ml,
                "volume_fraction_pct": m.volume_fraction_pct,
                "mean_hu": m.mean_hu,
                "std_hu": m.std_hu,
                "min_hu": m.min_hu,
                "max_hu": m.max_hu,
            }
            for m in measurements
        ],
    }


@router.get("/reports/{result_id}/export-mask")
def export_nifti_segmentation_mask(
    result_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    """
    Download the segmentation mask in NIfTI (.nii.gz) format preserving the exact
    native patient Origin, Voxel Spacing, and Direction Cosine Matrix.
    """
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

    mask_path = storage_service.resolve_path(res.native_mask_key)
    if not mask_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Native NIfTI mask file missing.")

    study_code = res.job.scan.study.study_code
    model_key = res.job.model_version.model_key
    download_name = f"{study_code}_{model_key}_mask_native.nii.gz"

    record_audit_event(
        db=db,
        action="MASK_EXPORTED_NIFTI",
        resource_type="segmentation_result",
        resource_id=res.id,
        user_id=current_user.id,
        details={"filename": download_name},
        request=request,
    )
    return FileResponse(
        path=str(mask_path),
        media_type="application/gzip",
        filename=download_name,
    )


@router.get("/reports/{result_id}/export-json")
def export_json_research_report(
    result_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Generate and download a comprehensive JSON research report for a segmentation result."""
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

    payload = _assemble_report_payload(res)
    json_bytes = json.dumps(payload, indent=2).encode("utf-8")

    study = res.job.scan.study
    rel_key = f"studies/{study.id}/reports/report_{res.id}.json"
    _, sha256_hex = storage_service.save_bytes(rel_key, json_bytes)

    report_row = Report(
        result_id=res.id,
        generated_by_user_id=current_user.id,
        report_format="JSON",
        storage_key=rel_key,
        file_sha256=sha256_hex,
        report_payload=payload,
    )
    db.add(report_row)
    db.commit()

    record_audit_event(
        db=db,
        action="REPORT_EXPORTED_JSON",
        resource_type="report",
        resource_id=report_row.id,
        user_id=current_user.id,
        details={"result_id": res.id},
        request=request,
    )

    download_name = f"{study.study_code}_PulmoVision_Report.json"
    return Response(
        content=json_bytes,
        media_type="application/json",
        headers={"Content-Disposition": f'attachment; filename="{download_name}"'},
    )


@router.get("/reports/{result_id}/export-pdf")
def export_pdf_research_report(
    result_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """Generate and download a formatted PDF Quantitative Research Report."""
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

    payload = _assemble_report_payload(res)
    study_info = payload["study"]
    geom = payload["scan_geometry"]
    model_info = payload["ai_model_provenance"]
    metrics_list = payload["quantitative_measurements"]

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=16 * mm,
        rightMargin=16 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title=f"PulmoVision AI Report - {study_info['study_code']}",
    )
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "PVTitle",
        parent=styles["Heading1"],
        fontSize=15,
        leading=19,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=4,
    )
    sec_style = ParagraphStyle(
        "PVSection",
        parent=styles["Heading2"],
        fontSize=11,
        leading=14,
        textColor=colors.HexColor("#0284C7"),
        spaceBefore=10,
        spaceAfter=4,
    )
    disclaimer_style = ParagraphStyle(
        "PVDisclaimer",
        parent=styles["Normal"],
        fontSize=8,
        leading=11,
        textColor=colors.HexColor("#991B1B"),
        backColor=colors.HexColor("#FEF2F2"),
        borderPadding=6,
    )
    normal_sm = ParagraphStyle("PVSmall", parent=styles["Normal"], fontSize=9, leading=12)

    story = [
        Paragraph("PulmoVision AI — Quantitative Lung Segmentation Research Report", title_style),
        Paragraph(f"Generated (UTC): {payload['generated_at_utc']}", normal_sm),
        Spacer(1, 3 * mm),
        Paragraph(payload["scientific_disclaimer"], disclaimer_style),
        Spacer(1, 4 * mm),
        Paragraph("1. Study & Scan Spatial Geometry", sec_style),
    ]

    meta_rows = [
        ["Study Code", study_info["study_code"], "Subject ID (Anon)", study_info["patient_anonymized_id"]],
        ["Scan File", geom["original_filename"], "Format", geom["file_format"]],
        [
            "Matrix (X × Y × Z)",
            f"{geom['dimensions_xyz'][0]} × {geom['dimensions_xyz'][1]} × {geom['dimensions_xyz'][2]}",
            "Spacing (mm)",
            f"{geom['voxel_spacing_mm'][0]:.3f} × {geom['voxel_spacing_mm'][1]:.3f} × {geom['voxel_spacing_mm'][2]:.3f}",
        ],
        [
            "Native Orientation",
            geom["native_orientation_code"],
            "Oblique Gantry",
            "Yes" if geom["is_oblique_acquisition"] else "No",
        ],
        [
            "HU Intensity Range",
            f"[{geom['hu_min_max'][0]:.1f}, {geom['hu_min_max'][1]:.1f}] HU",
            "Geometry Verified",
            "PASS" if model_info["spatial_geometry_verified"] else "FAIL",
        ],
    ]
    meta_table = Table(meta_rows, colWidths=[36 * mm, 52 * mm, 36 * mm, 52 * mm])
    meta_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F1F5F9")),
                ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F1F5F9")),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#0F172A")),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                ("PADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(meta_table)

    story.append(Paragraph("2. AI Segmentation Engine & Execution Telemetry", sec_style))
    model_rows = [
        ["Model Name", model_info["display_name"], "Task", model_info["task_type"]],
        ["Architecture", model_info["architecture"], "Package / License", f"{model_info['package_version']} ({model_info['license_spdx']})"],
        [
            "Execution Time",
            f"{model_info['execution_time_sec']} s ({model_info['device_used'].upper()}, batch={model_info['batch_size_used']})",
            "Peak Memory RSS",
            f"{model_info['peak_ram_mb']} MB",
        ],
        ["Scientific Reference", model_info["citation_doi"], "Weights SHA-256", model_info["weights_sha256_prefix"]],
    ]
    model_table = Table(model_rows, colWidths=[36 * mm, 64 * mm, 32 * mm, 44 * mm])
    model_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F1F5F9")),
                ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#F1F5F9")),
                ("FONTNAME", (0, 0), (-1, -1), "Helvetica"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                ("PADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(model_table)

    story.append(Paragraph("3. Quantitative Volumetric & Radiodensity Measurements", sec_style))
    quant_rows = [
        ["Label", "Anatomical Structure", "Voxel Count", "Volume (mL)", "Fraction (%)", "Mean ± SD (HU)"]
    ]
    for m in metrics_list:
        lbl_txt = "Total" if m["label_id"] == 0 else str(m["label_id"])
        quant_rows.append(
            [
                lbl_txt,
                m["display_name"],
                f"{m['voxel_count']:,}",
                f"{m['physical_volume_ml']:.2f} mL",
                f"{m['volume_fraction_pct']:.1f}%",
                f"{m['mean_hu']:.1f} ± {m['std_hu']:.1f}",
            ]
        )

    quant_table = Table(
        quant_rows,
        colWidths=[15 * mm, 58 * mm, 26 * mm, 26 * mm, 22 * mm, 29 * mm],
    )
    quant_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8.5),
                ("BACKGROUND", (0, 1), (-1, 1), colors.HexColor("#E0F2FE")),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                ("PADDING", (0, 0), (-1, -1), 5),
            ]
        )
    )
    story.append(quant_table)

    doc.build(story)
    pdf_bytes = buf.getvalue()

    study = res.job.scan.study
    rel_key = f"studies/{study.id}/reports/report_{res.id}.pdf"
    _, sha256_hex = storage_service.save_bytes(rel_key, pdf_bytes)

    report_row = Report(
        result_id=res.id,
        generated_by_user_id=current_user.id,
        report_format="PDF",
        storage_key=rel_key,
        file_sha256=sha256_hex,
        report_payload=payload,
    )
    db.add(report_row)
    db.commit()

    record_audit_event(
        db=db,
        action="REPORT_EXPORTED_PDF",
        resource_type="report",
        resource_id=report_row.id,
        user_id=current_user.id,
        details={"result_id": res.id},
        request=request,
    )

    download_name = f"{study.study_code}_PulmoVision_Report.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{download_name}"'},
    )

