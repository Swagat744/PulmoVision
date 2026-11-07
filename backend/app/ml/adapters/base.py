"""Abstract base class and data contracts for pluggable medical segmentation adapters."""
from abc import ABC, abstractmethod
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable, Dict, Optional

import SimpleITK as sitk


class ModelWeightsUnavailableError(RuntimeError):
    """Raised when verified pretrained model weights cannot be located or downloaded."""


@dataclass(frozen=True)
class SegmentationAdapterOutput:
    """Output contract returned by a segmentation model adapter."""
    model_key: str
    native_mask_image: sitk.Image
    lps_mask_image: sitk.Image
    label_map: Dict[str, Any]
    label_summary: Dict[str, int]
    execution_time_sec: float
    peak_ram_mb: float
    device_used: str
    geometry_verified: bool


class BaseSegmentationAdapter(ABC):
    """Pluggable interface that all segmentation model engines must implement."""

    @abstractmethod
    def is_weights_cached(self) -> bool:
        """Return True if verified model weights exist in the local model cache."""

    @abstractmethod
    def ensure_weights_available(self) -> Path:
        """Verify local cached weights by SHA-256 or download from verified release URL."""

    @abstractmethod
    def predict(
        self,
        native_image: sitk.Image,
        batch_size: int = 4,
        progress_callback: Optional[Callable[[int, str], None]] = None,
    ) -> SegmentationAdapterOutput:
        """Execute segmentation while preserving exact native spatial geometry."""

