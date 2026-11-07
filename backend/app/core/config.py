"""Core configuration and settings for PulmoVision AI."""
from pathlib import Path
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent


class Settings(BaseSettings):
    """Application settings loaded from environment variables or .env file."""

    APP_NAME: str = "PulmoVision AI"
    APP_VERSION: str = "1.0.0"
    ENVIRONMENT: str = "development"
    DEBUG: bool = False

    # Security
    JWT_SECRET_KEY: str = "pulmovision-research-secret-key-change-in-production-9f8e7d6c5b4a3"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 720

    # Database
    DATABASE_URL: str = f"sqlite:///{(BACKEND_ROOT / 'pulmovision.db').as_posix()}"

    # Storage & Model Cache
    STORAGE_BACKEND: str = "local"
    LOCAL_STORAGE_PATH: Path = BACKEND_ROOT / "storage"
    MODEL_CACHE_PATH: Path = BACKEND_ROOT / "model_cache"
    MAX_UPLOAD_SIZE_MB: int = 512

    # AI Inference Guardrails (Tuned for 7.68 GB RAM Intel Core i5-1235U Host)
    INFERENCE_DEVICE: str = "cpu"
    INFERENCE_BATCH_SIZE: int = 4
    INFERENCE_CPU_THREADS: int = 6
    MAX_CONCURRENT_JOBS: int = 1

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000"

    model_config = SettingsConfigDict(
        env_file=str(BACKEND_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


settings = Settings()
settings.LOCAL_STORAGE_PATH.mkdir(parents=True, exist_ok=True)
settings.MODEL_CACHE_PATH.mkdir(parents=True, exist_ok=True)

