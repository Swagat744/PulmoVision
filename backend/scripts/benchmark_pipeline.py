"""Empirical Hardware Benchmark & Sample Dataset Generator for PulmoVision AI."""
import json
from pathlib import Path
import platform
import sys
import time

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))

import psutil
import SimpleITK as sitk

from app.ml.adapters import get_segmentation_adapter
from app.ml.metrics import compute_morphometric_measurements, evaluate_against_reference_mask
from app.ml.phantom_generator import generate_thoracic_ct_phantom, write_dicom_zip_from_sitk
from app.ml.postprocessor import extract_anatomical_3d_meshes


def run_benchmark_and_generate_samples() -> None:
    sample_dir = BACKEND_DIR.parent / "sample_data"
    sample_dir.mkdir(parents=True, exist_ok=True)

    print("=== PulmoVision AI: Generating Sample Benchmark CT Datasets ===")
    sitk_sample, gt_sample = generate_thoracic_ct_phantom(
        shape_zyx=(48, 256, 256),
        spacing_xyz_mm=(1.25, 1.25, 2.5),
    )
    nifti_sample_path = sample_dir / "pulmovision_chest_ct_48slices.nii.gz"
    sitk.WriteImage(sitk_sample, str(nifti_sample_path), useCompression=True)
    print(f"Saved NIfTI sample: {nifti_sample_path}")

    dicom_axial_path = sample_dir / "pulmovision_chest_ct_axial_dicom.zip"
    write_dicom_zip_from_sitk(
        sitk_sample,
        dicom_axial_path,
        patient_id="PV-SAMPLE-AXIAL",
        gantry_tilt_deg=0.0,
        shuffle_filenames=True,
    )
    print(f"Saved Axial DICOM ZIP sample: {dicom_axial_path}")

    dicom_oblique_path = sample_dir / "pulmovision_chest_ct_oblique_12deg_dicom.zip"
    write_dicom_zip_from_sitk(
        sitk_sample,
        dicom_oblique_path,
        patient_id="PV-SAMPLE-OBLIQUE",
        gantry_tilt_deg=12.0,
        shuffle_filenames=True,
    )
    print(f"Saved Oblique (12 deg tilt) DICOM ZIP sample: {dicom_oblique_path}")

    print("\n=== PulmoVision AI: Executing Empirical Hardware Benchmark (lungmask_r231) ===")
    proc = psutil.Process()
    vm = psutil.virtual_memory()
    baseline_rss_mb = round(proc.memory_info().rss / (1024**2), 2)

    adapter = get_segmentation_adapter("lungmask_r231")
    adapter.ensure_weights_available()

    tiers = [
        {"tier": "Tier 1 (32 x 256 x 256)", "shape": (32, 256, 256), "spacing": (1.25, 1.25, 2.5)},
        {"tier": "Tier 2 (64 x 256 x 256)", "shape": (64, 256, 256), "spacing": (1.25, 1.25, 2.0)},
    ]

    results = []
    for t in tiers:
        ct_img, gt_mask = generate_thoracic_ct_phantom(
            shape_zyx=t["shape"],
            spacing_xyz_mm=t["spacing"],
        )
        t_start = time.perf_counter()
        out = adapter.predict(ct_img, batch_size=4)
        t_inf = time.perf_counter() - t_start

        t_mesh_start = time.perf_counter()
        mesh = extract_anatomical_3d_meshes(out.lps_mask_image, out.label_map, step_size=2)
        t_mesh = round(time.perf_counter() - t_mesh_start, 3)

        metrics = compute_morphometric_measurements(ct_img, out.lps_mask_image, out.label_map)
        pred_arr = sitk.GetArrayFromImage(out.lps_mask_image)
        eval_scores = evaluate_against_reference_mask(pred_arr, gt_mask, t["spacing"])

        tier_summary = {
            "tier": t["tier"],
            "shape_zyx": list(t["shape"]),
            "batch_size": 4,
            "inference_time_sec": round(t_inf, 3),
            "ms_per_slice": round(1000.0 * t_inf / t["shape"][0], 1),
            "marching_cubes_mesh_sec": t_mesh,
            "peak_rss_mb": out.peak_ram_mb,
            "geometry_verified": out.geometry_verified,
            "dice_vs_phantom_gt": eval_scores["dice_score"],
            "hd95_mm_vs_phantom_gt": eval_scores["hd95_mm"],
            "total_lung_volume_ml": next(m.physical_volume_ml for m in metrics if m.label_id == 0),
            "mesh_structures_extracted": len(mesh["structures"]),
        }
        results.append(tier_summary)
        print(json.dumps(tier_summary, indent=2))

    report = {
        "host": {
            "os": f"{platform.system()} {platform.release()}",
            "processor": platform.processor(),
            "logical_cores": psutil.cpu_count(logical=True),
            "total_ram_gb": round(vm.total / (1024**3), 2),
            "baseline_rss_mb": baseline_rss_mb,
        },
        "benchmarks": results,
    }
    out_file = sample_dir / "empirical_benchmark_results.json"
    out_file.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nSaved empirical benchmark results to {out_file}")


if __name__ == "__main__":
    run_benchmark_and_generate_samples()

