"""Adapter registry for PulmoVision AI segmentation engines."""
from app.ml.adapters.base import (
    BaseSegmentationAdapter,
    ModelWeightsUnavailableError,
    SegmentationAdapterOutput,
)
from app.ml.adapters.lungmask_adapter import LUNGMASK_MODEL_SPECS, LungMaskAdapter


def get_segmentation_adapter(model_key: str) -> BaseSegmentationAdapter:
    """Instantiate the verified segmentation adapter for the requested model_key."""
    if model_key in LUNGMASK_MODEL_SPECS:
        return LungMaskAdapter(model_key=model_key)
    raise ValueError(f"Unknown or unsupported segmentation model_key '{model_key}'.")


__all__ = [
    "BaseSegmentationAdapter",
    "ModelWeightsUnavailableError",
    "SegmentationAdapterOutput",
    "LungMaskAdapter",
    "LUNGMASK_MODEL_SPECS",
    "get_segmentation_adapter",
]

