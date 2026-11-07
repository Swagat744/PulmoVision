"""Verified LungMask (JoHof/lungmask v0.2.22) adapter with SHA-256 weight caching and geometry verification."""
import gc
import hashlib
from pathlib import Path
import time
from typing import Any, Callable, Dict, Optional

import certifi
from lungmask import mask as lm_mask
from lungmask import utils as lm_utils
from more_itertools import chunked
import numpy as np
import psutil
import requests
import SimpleITK as sitk
import torch

from app.core.config import settings
from app.core.logging import logger
from app.ml.adapters.base import (
    BaseSegmentationAdapter,
    ModelWeightsUnavailableError,
    SegmentationAdapterOutput,
)


LUNGMASK_MODEL_SPECS: Dict[str, Dict[str, Any]] = {
    "lungmask_r231": {
        "lm_name": "R231",
        "filename": "unet_r231-d5d2fc3d.pth",
        "url": "https://github.com/JoHof/lungmask/releases/download/v0.0/unet_r231-d5d2fc3d.pth",
        "sha256_prefix": "d5d2fc3d",
        "expected_bytes": 124340403,
        "num_classes": 3,
        "label_map": {
            "1": {"key": "right_lung", "name": "Right Lung", "color": "#14B8A6"},
            "2": {"key": "left_lung", "name": "Left Lung", "color": "#38BDF8"},
        },
    },
    "lungmask_ltrclobes": {
        "lm_name": "LTRCLobes",
        "filename": "unet_ltrclobes-3a07043d.pth",
        "url": "https://github.com/JoHof/lungmask/releases/download/v0.0/unet_ltrclobes-3a07043d.pth",
        "sha256_prefix": "3a07043d",
        "expected_bytes": 124338462,
        "num_classes": 6,
        "label_map": {
            "1": {"key": "left_upper_lobe", "name": "Left Upper Lobe (LUL)", "color": "#38BDF8"},
            "2": {"key": "left_lower_lobe", "name": "Left Lower Lobe (LLL)", "color": "#EC4899"},
            "3": {"key": "right_upper_lobe", "name": "Right Upper Lobe (RUL)", "color": "#14B8A6"},
            "4": {"key": "right_middle_lobe", "name": "Right Middle Lobe (RML)", "color": "#F59E0B"},
            "5": {"key": "right_lower_lobe", "name": "Right Lower Lobe (RLL)", "color": "#8B5CF6"},
        },
    },
}


class LungMaskAdapter(BaseSegmentationAdapter):
    """
    Production adapter for JoHof/lungmask (Apache-2.0, Hofmanninger et al., 2020).
    Uses requests + certifi to download and verify weights locally, avoiding Windows
    urllib SSL certificate issues, and enforces memory-safe CPU batch execution.
    """

    def __init__(self, model_key: str = "lungmask_r231", cache_dir: Optional[Path] = None) -> None:
        if model_key not in LUNGMASK_MODEL_SPECS:
            raise ValueError(f"Unsupported lungmask model_key '{model_key}'.")
        self.model_key = model_key
        self.spec = LUNGMASK_MODEL_SPECS[model_key]
        self.cache_dir = (cache_dir or settings.MODEL_CACHE_PATH).resolve()
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.weight_path = self.cache_dir / self.spec["filename"]

    def is_weights_cached(self) -> bool:
        if not self.weight_path.exists():
            return False
        if self.weight_path.stat().st_size != self.spec["expected_bytes"]:
            return False
        return True

    def ensure_weights_available(self) -> Path:
        """Verify local cached .pth file or download from official GitHub Release with SHA-256 check."""
        if self.is_weights_cached():
            sha = hashlib.sha256(self.weight_path.read_bytes()).hexdigest()
            if sha.startswith(self.spec["sha256_prefix"]):
                return self.weight_path
            logger.warning(f"Cached weight {self.weight_path} failed SHA-256 check; re-downloading.")
            self.weight_path.unlink(missing_ok=True)

        url = self.spec["url"]
        tmp_path = self.weight_path.with_suffix(".pth.part")
        logger.info(f"Downloading verified LungMask weights '{self.spec['filename']}' from {url} ...")
        try:
            hasher = hashlib.sha256()
            with requests.get(url, stream=True, timeout=60, verify=certifi.where()) as resp:
                resp.raise_for_status()
                with open(tmp_path, "wb") as out_f:
                    for chunk in resp.iter_content(chunk_size=1024 * 1024):
                        if chunk:
                            hasher.update(chunk)
                            out_f.write(chunk)
            digest = hasher.hexdigest()
            if not digest.startswith(self.spec["sha256_prefix"]):
                tmp_path.unlink(missing_ok=True)
                raise ModelWeightsUnavailableError(
                    f"Downloaded weight SHA-256 '{digest}' did not match expected prefix '{self.spec['sha256_prefix']}'."
                )
            tmp_path.replace(self.weight_path)
            logger.info(f"Verified LungMask weights cached at {self.weight_path} (SHA-256: {digest[:16]}...).")
            return self.weight_path
        except Exception as exc:
            tmp_path.unlink(missing_ok=True)
            raise ModelWeightsUnavailableError(
                f"Failed to download or verify LungMask weights for '{self.model_key}': {exc}"
            ) from exc

    def predict(
        self,
        native_image: sitk.Image,
        batch_size: int = 4,
        progress_callback: Optional[Callable[[int, str], None]] = None,
    ) -> SegmentationAdapterOutput:
        t0 = time.perf_counter()
        proc = psutil.Process()
        peak_rss_bytes = proc.memory_info().rss

        def _update_progress(pct: int, stage: str) -> None:
            nonlocal peak_rss_bytes
            curr_rss = proc.memory_info().rss
            if curr_rss > peak_rss_bytes:
                peak_rss_bytes = curr_rss
            if progress_callback:
                progress_callback(pct, stage)

        _update_progress(8, "Verifying pretrained model weights")
        weight_file = self.ensure_weights_available()

        torch.set_num_threads(settings.INFERENCE_CPU_THREADS)
        device_str = "cuda" if (settings.INFERENCE_DEVICE == "cuda" and torch.cuda.is_available()) else "cpu"
        device = torch.device(device_str)

        _update_progress(15, f"Loading {self.spec['lm_name']} U-Net into {device_str.upper()} memory")
        model = lm_mask.get_model(self.spec["lm_name"], str(weight_file))
        model.to(device)
        model.eval()

        _update_progress(22, "Standardizing orientation to canonical LPS+ & normalizing HU")
        curr_orient = sitk.DICOMOrientImageFilter_GetOrientationFromDirectionCosines(
            native_image.GetDirection()
        )
        lps_input_sitk = sitk.DICOMOrient(native_image, "LPS") if curr_orient != "LPS" else native_image
        inimg_raw = sitk.GetArrayFromImage(lps_input_sitk)

        tvolslices, xnew_box = lm_utils.preprocess(inimg_raw, resolution=[256, 256])
        tvolslices[tvolslices > 600] = 600
        tvolslices = np.divide((tvolslices + 1024), 1624)

        total_slices = len(tvolslices)
        effective_batch = max(1, min(batch_size, 16))
        pred_slices_list = []

        with torch.inference_mode():
            chunks = list(chunked(tvolslices, effective_batch))
            num_chunks = max(1, len(chunks))
            for c_idx, mbnp in enumerate(chunks):
                mbt = torch.as_tensor(
                    np.asarray(mbnp)[:, None, ::],
                    dtype=torch.float32,
                    device=device,
                )
                logits = model(mbt)
                pred = torch.max(logits, 1)[1].detach().cpu().numpy().astype(np.uint8)
                pred_slices_list.append(pred)
                pct = 25 + int(45.0 * (c_idx + 1) / num_chunks)
                _update_progress(
                    pct,
                    f"Running U-Net inference ({min((c_idx + 1) * effective_batch, total_slices)}/{total_slices} slices)",
                )

        timage_res = np.vstack(pred_slices_list)
        del pred_slices_list, tvolslices, model
        gc.collect()

        _update_progress(74, "Applying 3D connected-component analysis & cavity hole filling")
        if int(np.max(timage_res)) > 0:
            outmask_256 = lm_utils.postprocessing(timage_res, disable_tqdm=True)
        else:
            outmask_256 = timage_res

        _update_progress(84, "Restoring native voxel grid resolution & patient orientation")
        lps_mask_arr = np.asarray(
            [
                lm_utils.reshape_mask(outmask_256[i], xnew_box[i], inimg_raw.shape[1:])
                for i in range(outmask_256.shape[0])
            ],
            dtype=np.uint8,
        )

        # Build canonical LPS+ mask sitk.Image
        lps_mask_sitk = sitk.GetImageFromArray(lps_mask_arr)
        lps_mask_sitk.CopyInformation(lps_input_sitk)

        # Reorient back to native acquisition orientation if needed and restore exact metadata
        if curr_orient != "LPS":
            native_mask_sitk = sitk.DICOMOrient(lps_mask_sitk, curr_orient)
        else:
            native_mask_sitk = sitk.GetImageFromArray(lps_mask_arr)
        native_mask_sitk.CopyInformation(native_image)

        # Explicitly verify spatial geometry equivalence
        spacing_ok = np.allclose(native_mask_sitk.GetSpacing(), native_image.GetSpacing(), atol=1e-5)
        origin_ok = np.allclose(native_mask_sitk.GetOrigin(), native_image.GetOrigin(), atol=1e-4)
        direction_ok = np.allclose(native_mask_sitk.GetDirection(), native_image.GetDirection(), atol=1e-5)
        size_ok = native_mask_sitk.GetSize() == native_image.GetSize()
        geometry_verified = bool(spacing_ok and origin_ok and direction_ok and size_ok)
        if not geometry_verified:
            raise RuntimeError("Spatial geometry verification failed between native input and output mask.")

        # Tally per-label voxel counts
        unique_labels, counts = np.unique(lps_mask_arr, return_counts=True)
        label_summary = {str(int(lbl)): int(cnt) for lbl, cnt in zip(unique_labels, counts) if int(lbl) > 0}

        curr_rss = proc.memory_info().rss
        if curr_rss > peak_rss_bytes:
            peak_rss_bytes = curr_rss
        elapsed = time.perf_counter() - t0

        return SegmentationAdapterOutput(
            model_key=self.model_key,
            native_mask_image=native_mask_sitk,
            lps_mask_image=lps_mask_sitk,
            label_map=self.spec["label_map"],
            label_summary=label_summary,
            execution_time_sec=round(elapsed, 3),
            peak_ram_mb=round(peak_rss_bytes / (1024.0 * 1024.0), 2),
            device_used=device_str,
            geometry_verified=geometry_verified,
        )

