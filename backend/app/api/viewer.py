"""Medical Viewer API: Binary Int16 HU MPR slices, UInt8 mask slices, and 3D surface meshes."""
from functools import lru_cache
import json
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
import numpy as np
import SimpleITK as sitk
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.ml.phantom_generator import generate_thoracic_ct_phantom
from app.ml.postprocessor import extract_anatomical_3d_meshes
from app.models.entities import (
    MedicalScan,
    SegmentationJob,
    SegmentationResult,
    Study,
    User,
)
from app.services.storage import storage_service


router = APIRouter(prefix="/api/v1/viewer", tags=["Medical Imaging Viewer (2D MPR & 3D Mesh)"])


@lru_cache(maxsize=8)
def _load_cached_npy(resolved_path_str: str) -> np.ndarray:
    """Memory-mapped read of cached canonical LPS+ NumPy array to keep RAM usage minimal."""
    return np.load(resolved_path_str, mmap_mode="r")


def _extract_mpr_slice(
    vol_zyx: np.ndarray,
    plane: str,
    index: int,
    spacing_xyz: Tuple[float, float, float],
) -> Tuple[np.ndarray, float, float]:
    """
    Extract an orthogonal 2D slice from a canonical LPS+ volume (Z, Y, X)
    in standard radiological display orientation:
    - axial:    (Y, X) — Top=Anterior, Bottom=Posterior, Left=Right Lung, Right=Left Lung
    - coronal:  (Z_flipped, X) — Top=Superior, Bottom=Inferior, Left=Right Lung, Right=Left Lung
    - sagittal: (Z_flipped, Y) — Top=Superior, Bottom=Inferior, Left=Anterior, Right=Posterior
    """
    nz, ny, nx = vol_zyx.shape
    sx, sy, sz = spacing_xyz
    plane_lower = plane.lower()

    if plane_lower == "axial":
        if index < 0 or index >= nz:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Axial slice index {index} out of bounds [0, {nz - 1}].",
            )
        slice_2d = np.ascontiguousarray(vol_zyx[index, :, :])
        return slice_2d, sx, sy

    if plane_lower == "coronal":
        if index < 0 or index >= ny:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Coronal slice index {index} out of bounds [0, {ny - 1}].",
            )
        slice_2d = np.ascontiguousarray(vol_zyx[::-1, index, :])
        return slice_2d, sx, sz

    if plane_lower == "sagittal":
        if index < 0 or index >= nx:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Sagittal slice index {index} out of bounds [0, {nx - 1}].",
            )
        slice_2d = np.ascontiguousarray(vol_zyx[::-1, :, index])
        return slice_2d, sy, sz

    raise HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail=f"Invalid MPR plane '{plane}'. Expected 'axial', 'coronal', or 'sagittal'.",
    )


# =========================================================================
# PUBLIC SHOWCASE BENCHMARK ASSETS (No login required, instant demonstration)
# =========================================================================

def _get_showcase_dir() -> Path:
    """Return the directory housing precomputed showcase assets."""
    showcase_dir = storage_service.resolve_path("showcase")
    showcase_dir.mkdir(parents=True, exist_ok=True)
    return showcase_dir


def _ensure_showcase_assets() -> Dict[str, Any]:
    """Generate and cache the 48-slice calibrated benchmark thoracic CT scan and 3D mesh."""
    showcase_dir = _get_showcase_dir()
    ct_npy_path = showcase_dir / "volume_lps_int16.npy"
    mask_npy_path = showcase_dir / "mask_lps_uint8.npy"
    mesh_json_path = showcase_dir / "anatomical_mesh_3d.json"
    info_json_path = showcase_dir / "showcase_info.json"

    if (
        ct_npy_path.exists()
        and mask_npy_path.exists()
        and mesh_json_path.exists()
        and info_json_path.exists()
    ):
        try:
            return json.loads(info_json_path.read_text(encoding="utf-8"))
        except Exception:
            pass

    sitk_img, gt_mask = generate_thoracic_ct_phantom(
        shape_zyx=(48, 256, 256), spacing_xyz_mm=(1.25, 1.25, 2.5)
    )
    hu_arr = sitk.GetArrayFromImage(sitk_img).astype(np.int16)
    np.save(str(ct_npy_path), hu_arr)
    np.save(str(mask_npy_path), gt_mask.astype(np.uint8))

    mask_img = sitk.GetImageFromArray(gt_mask)
    mask_img.CopyInformation(sitk_img)

    label_map = {
        "1": {"key": "right_lung", "name": "Right Lung", "color": "#14B8A6"},
        "2": {"key": "left_lung", "name": "Left Lung", "color": "#38BDF8"},
    }

    mesh = extract_anatomical_3d_meshes(mask_img, label_map, step_size=2)
    mesh_json_path.write_text(json.dumps(mesh), encoding="utf-8")

    info = {
        "scan_id": "showcase_scan",
        "result_id": "showcase_result",
        "patient_anon_id": "PV-SUBJ-104",
        "filename": "chest_ct_helical_thin.nii.gz",
        "dimensions": {"x": 256, "y": 256, "z": 48},
        "spacing_mm": {"x": 1.25, "y": 1.25, "z": 2.5},
        "total_triangles": sum(s["face_count"] for s in mesh["structures"]),
        "structures": [
            {
                "label_id": s["label_id"],
                "name": s["display_name"],
                "color": s["color_hex"],
                "triangles": s["face_count"],
            }
            for s in mesh["structures"]
        ],
    }
    info_json_path.write_text(json.dumps(info, indent=2), encoding="utf-8")
    return info


@router.get("/showcase/info")
def get_showcase_info() -> Dict[str, Any]:
    """Return benchmark metadata for public showcase demonstration."""
    return _ensure_showcase_assets()


@router.get("/showcase/slice")
def get_showcase_slice(
    plane: str = Query(default="axial", pattern="^(axial|coronal|sagittal)$"),
    index: int = Query(default=24, ge=0),
) -> Response:
    """Stream a calibrated Int16 Hounsfield Unit 2D slice from the showcase benchmark volume."""
    _ensure_showcase_assets()
    ct_npy_path = _get_showcase_dir() / "volume_lps_int16.npy"
    vol_zyx = _load_cached_npy(str(ct_npy_path))

    slice_2d, sp_horiz, sp_vert = _extract_mpr_slice(
        vol_zyx=vol_zyx,
        plane=plane,
        index=index,
        spacing_xyz=(1.25, 1.25, 2.5),
    )
    slice_int16 = slice_2d.astype("<i2")
    height, width = slice_int16.shape

    headers = {
        "X-Slice-Width": str(width),
        "X-Slice-Height": str(height),
        "X-Spacing-Horizontal-MM": f"{sp_horiz:.6f}",
        "X-Spacing-Vertical-MM": f"{sp_vert:.6f}",
        "X-Plane": plane.lower(),
        "X-Slice-Index": str(index),
        "X-Data-Type": "int16-le",
        "Access-Control-Expose-Headers": (
            "X-Slice-Width, X-Slice-Height, X-Spacing-Horizontal-MM, "
            "X-Spacing-Vertical-MM, X-Plane, X-Slice-Index, X-Data-Type"
        ),
    }
    return Response(
        content=slice_int16.tobytes(),
        media_type="application/octet-stream",
        headers=headers,
    )


@router.get("/showcase/mask-slice")
def get_showcase_mask_slice(
    plane: str = Query(default="axial", pattern="^(axial|coronal|sagittal)$"),
    index: int = Query(default=24, ge=0),
) -> Response:
    """Stream a UInt8 binary mask slice aligned with the showcase CT slice."""
    _ensure_showcase_assets()
    mask_npy_path = _get_showcase_dir() / "mask_lps_uint8.npy"
    mask_zyx = _load_cached_npy(str(mask_npy_path))

    slice_2d, sp_horiz, sp_vert = _extract_mpr_slice(
        vol_zyx=mask_zyx,
        plane=plane,
        index=index,
        spacing_xyz=(1.25, 1.25, 2.5),
    )
    slice_uint8 = slice_2d.astype(np.uint8)
    height, width = slice_uint8.shape

    headers = {
        "X-Slice-Width": str(width),
        "X-Slice-Height": str(height),
        "X-Spacing-Horizontal-MM": f"{sp_horiz:.6f}",
        "X-Spacing-Vertical-MM": f"{sp_vert:.6f}",
        "X-Plane": plane.lower(),
        "X-Slice-Index": str(index),
        "X-Data-Type": "uint8",
        "Access-Control-Expose-Headers": (
            "X-Slice-Width, X-Slice-Height, X-Spacing-Horizontal-MM, "
            "X-Spacing-Vertical-MM, X-Plane, X-Slice-Index, X-Data-Type"
        ),
    }
    return Response(
        content=slice_uint8.tobytes(),
        media_type="application/octet-stream",
        headers=headers,
    )


@router.get("/showcase/mesh")
def get_showcase_mesh() -> Dict[str, Any]:
    """Return the real precomputed 3D Marching Cubes surface mesh for the showcase volume."""
    _ensure_showcase_assets()
    mesh_json_path = _get_showcase_dir() / "anatomical_mesh_3d.json"
    payload = json.loads(mesh_json_path.read_text(encoding="utf-8"))
    payload["result_id"] = "showcase_result"
    return payload


# =========================================================================
# AUTHENTICATED PATIENT STUDY VIEWER ENDPOINTS
# =========================================================================

@router.get("/scans/{scan_id}/slice")
def get_scan_mpr_slice(
    scan_id: str,
    plane: str = Query(default="axial", pattern="^(axial|coronal|sagittal)$"),
    index: int = Query(..., ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """
    Stream a calibrated Int16 Hounsfield Unit 2D slice in canonical radiological LPS+ orientation.
    Exposes custom headers for exact matrix dimensions and physical aspect-ratio scaling.
    """
    scan = (
        db.query(MedicalScan)
        .join(Study, MedicalScan.study_id == Study.id)
        .filter(MedicalScan.id == scan_id, Study.user_id == current_user.id)
        .first()
    )
    if not scan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Medical scan not found.")

    lps_path = storage_service.resolve_path(scan.lps_cache_key)
    if not lps_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="LPS volume cache file missing.")

    vol_zyx = _load_cached_npy(str(lps_path))
    slice_2d, sp_horiz, sp_vert = _extract_mpr_slice(
        vol_zyx=vol_zyx,
        plane=plane,
        index=index,
        spacing_xyz=(scan.spacing_x_mm, scan.spacing_y_mm, scan.spacing_z_mm),
    )
    slice_int16 = slice_2d.astype("<i2")
    height, width = slice_int16.shape

    headers = {
        "X-Slice-Width": str(width),
        "X-Slice-Height": str(height),
        "X-Spacing-Horizontal-MM": f"{sp_horiz:.6f}",
        "X-Spacing-Vertical-MM": f"{sp_vert:.6f}",
        "X-Plane": plane.lower(),
        "X-Slice-Index": str(index),
        "X-Data-Type": "int16-le",
        "Access-Control-Expose-Headers": (
            "X-Slice-Width, X-Slice-Height, X-Spacing-Horizontal-MM, "
            "X-Spacing-Vertical-MM, X-Plane, X-Slice-Index, X-Data-Type"
        ),
    }
    return Response(
        content=slice_int16.tobytes(),
        media_type="application/octet-stream",
        headers=headers,
    )


@router.get("/results/{result_id}/mask-slice")
def get_result_mpr_mask_slice(
    result_id: str,
    plane: str = Query(default="axial", pattern="^(axial|coronal|sagittal)$"),
    index: int = Query(..., ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    """
    Stream a UInt8 multi-label segmentation mask slice aligned pixel-for-pixel
    with the corresponding CT MPR slice.
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

    scan = res.job.scan
    mask_path = storage_service.resolve_path(res.lps_mask_cache_key)
    if not mask_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="LPS mask cache file missing.")

    mask_zyx = _load_cached_npy(str(mask_path))
    slice_2d, sp_horiz, sp_vert = _extract_mpr_slice(
        vol_zyx=mask_zyx,
        plane=plane,
        index=index,
        spacing_xyz=(scan.spacing_x_mm, scan.spacing_y_mm, scan.spacing_z_mm),
    )
    slice_uint8 = slice_2d.astype(np.uint8)
    height, width = slice_uint8.shape

    headers = {
        "X-Slice-Width": str(width),
        "X-Slice-Height": str(height),
        "X-Spacing-Horizontal-MM": f"{sp_horiz:.6f}",
        "X-Spacing-Vertical-MM": f"{sp_vert:.6f}",
        "X-Plane": plane.lower(),
        "X-Slice-Index": str(index),
        "X-Data-Type": "uint8",
        "Access-Control-Expose-Headers": (
            "X-Slice-Width, X-Slice-Height, X-Spacing-Horizontal-MM, "
            "X-Spacing-Vertical-MM, X-Plane, X-Slice-Index, X-Data-Type"
        ),
    }
    return Response(
        content=slice_uint8.tobytes(),
        media_type="application/octet-stream",
        headers=headers,
    )


@router.get("/results/{result_id}/mesh")
def get_result_3d_mesh(
    result_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Return the precomputed physical-space (mm) 3D Marching Cubes anatomical surface mesh."""
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

    mesh_path = storage_service.resolve_path(res.mesh_storage_key)
    if not mesh_path.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="3D mesh file missing.")

    payload = json.loads(mesh_path.read_text(encoding="utf-8"))
    payload["result_id"] = res.id
    return payload
