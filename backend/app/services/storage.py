"""Configurable file storage abstraction with path-traversal protection and SHA-256 hashing."""
from abc import ABC, abstractmethod
import hashlib
from pathlib import Path
import shutil
from typing import BinaryIO

from app.core.config import settings


class StorageBackend(ABC):
    """Abstract storage interface for medical volumes, masks, meshes, and reports."""

    @abstractmethod
    def save_bytes(self, relative_key: str, data: bytes) -> tuple[Path, str]:
        """Persist raw bytes and return (resolved_path, sha256_hex)."""

    @abstractmethod
    def save_stream(self, relative_key: str, stream: BinaryIO, max_bytes: int) -> tuple[Path, str, int]:
        """Persist a file-like stream with size enforcement, returning (path, sha256_hex, size_bytes)."""

    @abstractmethod
    def resolve_path(self, relative_key: str) -> Path:
        """Resolve a storage key safely within the storage root."""

    @abstractmethod
    def exists(self, relative_key: str) -> bool:
        """Return True if the storage key exists."""

    @abstractmethod
    def delete(self, relative_key: str) -> None:
        """Delete a file or directory tree under the given relative key."""


class LocalStorageBackend(StorageBackend):
    """Local filesystem storage backend with strict path-traversal guards."""

    def __init__(self, root_dir: Path | None = None) -> None:
        self.root = (root_dir or settings.LOCAL_STORAGE_PATH).resolve()
        self.root.mkdir(parents=True, exist_ok=True)

    def resolve_path(self, relative_key: str) -> Path:
        clean_key = relative_key.lstrip("/\\").replace("\\", "/")
        candidate = (self.root / clean_key).resolve()
        if not str(candidate).startswith(str(self.root)):
            raise ValueError(f"Security violation: storage key '{relative_key}' escapes storage root.")
        return candidate

    def save_bytes(self, relative_key: str, data: bytes) -> tuple[Path, str]:
        target = self.resolve_path(relative_key)
        target.parent.mkdir(parents=True, exist_ok=True)
        sha256_hex = hashlib.sha256(data).hexdigest()
        target.write_bytes(data)
        return target, sha256_hex

    def save_stream(self, relative_key: str, stream: BinaryIO, max_bytes: int) -> tuple[Path, str, int]:
        target = self.resolve_path(relative_key)
        target.parent.mkdir(parents=True, exist_ok=True)
        hasher = hashlib.sha256()
        total_bytes = 0
        chunk_size = 1024 * 1024  # 1 MiB
        try:
            with open(target, "wb") as out_f:
                while True:
                    chunk = stream.read(chunk_size)
                    if not chunk:
                        break
                    total_bytes += len(chunk)
                    if total_bytes > max_bytes:
                        raise ValueError(
                            f"Upload exceeds maximum allowed size of {max_bytes // (1024 * 1024)} MB."
                        )
                    hasher.update(chunk)
                    out_f.write(chunk)
        except Exception:
            if target.exists():
                target.unlink(missing_ok=True)
            raise
        return target, hasher.hexdigest(), total_bytes

    def exists(self, relative_key: str) -> bool:
        return self.resolve_path(relative_key).exists()

    def delete(self, relative_key: str) -> None:
        target = self.resolve_path(relative_key)
        if target.is_dir():
            shutil.rmtree(target, ignore_errors=True)
        elif target.exists():
            target.unlink(missing_ok=True)


storage_service = LocalStorageBackend()

