"""Geometry-aware volumetric morphometry, radiodensity statistics, and reference evaluation metrics."""
from dataclasses import dataclass
from typing import Any, Dict, List

import numpy as np
from scipy.ndimage import distance_transform_edt
import SimpleITK as sitk


@dataclass(frozen=True)
class ComputedStructureMeasurement:
    """Quantitative measurement record for an anatomical structure."""
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
    bbox_lps_voxel: List[int]  # [zmin, zmax, ymin, ymax, xmin, xmax]


def compute_morphometric_measurements(
    lps_ct_image: sitk.Image,
    lps_mask_image: sitk.Image,
    label_map: Dict[str, Any],
) -> List[ComputedStructureMeasurement]:
    """
    Compute physical volumes (mm^3 and mL) using true voxel spacing (sx * sy * sz)
    and Hounsfield Unit radiodensity statistics for each segmented label and total lung.
    """
    ct_arr = sitk.GetArrayFromImage(lps_ct_image).astype(np.float32)
    mask_arr = sitk.GetArrayFromImage(lps_mask_image).astype(np.uint8)

    if ct_arr.shape != mask_arr.shape:
        raise ValueError(
            f"CT array shape {ct_arr.shape} and mask shape {mask_arr.shape} do not match."
        )

    sx, sy, sz = lps_ct_image.GetSpacing()
    voxel_vol_mm3 = float(sx * sy * sz)
    if voxel_vol_mm3 <= 0:
        raise ValueError(f"Invalid non-positive voxel volume: {voxel_vol_mm3} mm^3.")

    total_lung_mask = mask_arr > 0
    total_lung_voxels = int(np.count_nonzero(total_lung_mask))

    results: List[ComputedStructureMeasurement] = []

    # 1. Total Combined Lung (label_id = 0)
    if total_lung_voxels > 0:
        total_hu_vals = ct_arr[total_lung_mask]
        z_idx, y_idx, x_idx = np.where(total_lung_mask)
        total_bbox = [
            int(np.min(z_idx)),
            int(np.max(z_idx)),
            int(np.min(y_idx)),
            int(np.max(y_idx)),
            int(np.min(x_idx)),
            int(np.max(x_idx)),
        ]
        total_mm3 = total_lung_voxels * voxel_vol_mm3
        results.append(
            ComputedStructureMeasurement(
                label_id=0,
                structure_key="total_lung",
                display_name="Total Segmented Lung (Bilateral)",
                color_hex="#60A5FA",
                voxel_count=total_lung_voxels,
                physical_volume_mm3=round(total_mm3, 2),
                physical_volume_ml=round(total_mm3 / 1000.0, 2),
                volume_fraction_pct=100.0,
                mean_hu=round(float(np.mean(total_hu_vals)), 2),
                std_hu=round(float(np.std(total_hu_vals)), 2),
                min_hu=round(float(np.min(total_hu_vals)), 2),
                max_hu=round(float(np.max(total_hu_vals)), 2),
                bbox_lps_voxel=total_bbox,
            )
        )
    else:
        results.append(
            ComputedStructureMeasurement(
                label_id=0,
                structure_key="total_lung",
                display_name="Total Segmented Lung (Bilateral)",
                color_hex="#60A5FA",
                voxel_count=0,
                physical_volume_mm3=0.0,
                physical_volume_ml=0.0,
                volume_fraction_pct=0.0,
                mean_hu=0.0,
                std_hu=0.0,
                min_hu=0.0,
                max_hu=0.0,
                bbox_lps_voxel=[0, 0, 0, 0, 0, 0],
            )
        )

    # 2. Individual anatomical structures (labels 1..N)
    for lbl_str, meta in sorted(label_map.items(), key=lambda kv: int(kv[0])):
        lbl_id = int(lbl_str)
        struct_mask = mask_arr == lbl_id
        v_count = int(np.count_nonzero(struct_mask))
        if v_count > 0:
            hu_vals = ct_arr[struct_mask]
            zi, yi, xi = np.where(struct_mask)
            bbox = [
                int(np.min(zi)),
                int(np.max(zi)),
                int(np.min(yi)),
                int(np.max(yi)),
                int(np.min(xi)),
                int(np.max(xi)),
            ]
            vol_mm3 = v_count * voxel_vol_mm3
            frac_pct = (100.0 * v_count / total_lung_voxels) if total_lung_voxels > 0 else 0.0
            results.append(
                ComputedStructureMeasurement(
                    label_id=lbl_id,
                    structure_key=str(meta["key"]),
                    display_name=str(meta["name"]),
                    color_hex=str(meta["color"]),
                    voxel_count=v_count,
                    physical_volume_mm3=round(vol_mm3, 2),
                    physical_volume_ml=round(vol_mm3 / 1000.0, 2),
                    volume_fraction_pct=round(frac_pct, 2),
                    mean_hu=round(float(np.mean(hu_vals)), 2),
                    std_hu=round(float(np.std(hu_vals)), 2),
                    min_hu=round(float(np.min(hu_vals)), 2),
                    max_hu=round(float(np.max(hu_vals)), 2),
                    bbox_lps_voxel=bbox,
                )
            )
        else:
            results.append(
                ComputedStructureMeasurement(
                    label_id=lbl_id,
                    structure_key=str(meta["key"]),
                    display_name=str(meta["name"]),
                    color_hex=str(meta["color"]),
                    voxel_count=0,
                    physical_volume_mm3=0.0,
                    physical_volume_ml=0.0,
                    volume_fraction_pct=0.0,
                    mean_hu=0.0,
                    std_hu=0.0,
                    min_hu=0.0,
                    max_hu=0.0,
                    bbox_lps_voxel=[0, 0, 0, 0, 0, 0],
                )
            )

    return results


def evaluate_against_reference_mask(
    pred_mask_zyx: np.ndarray,
    ref_mask_zyx: np.ndarray,
    spacing_xyz_mm: tuple[float, float, float],
) -> Dict[str, Any]:
    """
    Compute scientific segmentation evaluation metrics (Dice Similarity Coefficient,
    Jaccard IoU, Relative Volume Difference, and 95th-percentile Hausdorff Distance in mm)
    strictly when a ground-truth reference mask is provided.
    """
    if pred_mask_zyx.shape != ref_mask_zyx.shape:
        raise ValueError("Predicted and reference masks must have identical shapes.")

    sx, sy, sz = spacing_xyz_mm
    spacing_zyx = (float(sz), float(sy), float(sx))

    pred_bin = pred_mask_zyx > 0
    ref_bin = ref_mask_zyx > 0

    intersection = int(np.count_nonzero(pred_bin & ref_bin))
    pred_sum = int(np.count_nonzero(pred_bin))
    ref_sum = int(np.count_nonzero(ref_bin))
    union = int(np.count_nonzero(pred_bin | ref_bin))

    dice = (2.0 * intersection / (pred_sum + ref_sum)) if (pred_sum + ref_sum) > 0 else 1.0
    iou = (intersection / union) if union > 0 else 1.0
    rvd_pct = (100.0 * (pred_sum - ref_sum) / ref_sum) if ref_sum > 0 else 0.0

    # Compute 95th percentile Hausdorff Distance (HD95) in physical mm
    if pred_sum > 0 and ref_sum > 0:
        dt_pred = distance_transform_edt(~pred_bin, sampling=spacing_zyx)
        dt_ref = distance_transform_edt(~ref_bin, sampling=spacing_zyx)
        d_pred_to_ref = dt_ref[pred_bin]
        d_ref_to_pred = dt_pred[ref_bin]
        hd95 = float(np.percentile(np.concatenate([d_pred_to_ref, d_ref_to_pred]), 95))
    else:
        hd95 = float("nan")

    return {
        "dice_score": round(float(dice), 4),
        "jaccard_iou": round(float(iou), 4),
        "relative_volume_diff_pct": round(float(rvd_pct), 2),
        "hd95_mm": round(hd95, 3) if not np.isnan(hd95) else None,
    }

