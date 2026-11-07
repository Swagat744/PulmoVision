"""Database session management, foreign-key enforcement, and model registry seeding."""
from typing import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.core.logging import logger
from app.core.security import get_password_hash
from app.db.base import Base
from app.models.entities import ModelVersion, User


connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(settings.DATABASE_URL, connect_args=connect_args, future=True)

if settings.DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def _enable_sqlite_fks(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()


SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine, future=True)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a SQLAlchemy database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db_and_seed(db: Session) -> None:
    """Create tables and seed verified lungmask models and default researcher account."""
    Base.metadata.create_all(bind=engine)

    r231_labels = {
        "1": {"key": "right_lung", "name": "Right Lung", "color": "#14B8A6"},
        "2": {"key": "left_lung", "name": "Left Lung", "color": "#38BDF8"},
    }
    # Seed verified LungMask R231 (Left/Right Lung) model
    r231 = db.query(ModelVersion).filter(ModelVersion.model_key == "lungmask_r231").first()
    if not r231:
        r231 = ModelVersion(
            model_key="lungmask_r231",
            display_name="LungMask U-Net (R231 — Bilateral Left/Right Lung)",
            architecture="2D U-Net (depth=5, batch_norm=True, upsample)",
            package_version="lungmask==0.2.22",
            task_type="left_right_lung",
            num_classes=3,
            label_map=r231_labels,
            weights_url="https://github.com/JoHof/lungmask/releases/download/v0.0/unet_r231-d5d2fc3d.pth",
            weights_sha256="d5d2fc3d",
            license_spdx="Apache-2.0",
            citation_doi="https://doi.org/10.1186/s41747-020-00173-2",
            description=(
                "Peer-reviewed 2D U-Net trained on 231 diverse routine clinical chest CT scans "
                "covering severe pathologies, effusions, consolidations, and varying scanners. "
                "Separates anatomical Right Lung (Label 1) and Left Lung (Label 2) while excluding the main trachea."
            ),
            known_limitations=(
                "Operates slice-by-slice in axial plane (256x256 resampled) followed by 3D connected-component "
                "postprocessing. Requires full thoracic cross-section surrounded by body wall tissue; "
                "not a pathology/nodule detector."
            ),
            is_enabled=True,
        )
        db.add(r231)
    else:
        r231.label_map = r231_labels

    ltrc_labels = {
        "1": {"key": "left_upper_lobe", "name": "Left Upper Lobe (LUL)", "color": "#38BDF8"},
        "2": {"key": "left_lower_lobe", "name": "Left Lower Lobe (LLL)", "color": "#EC4899"},
        "3": {"key": "right_upper_lobe", "name": "Right Upper Lobe (RUL)", "color": "#14B8A6"},
        "4": {"key": "right_middle_lobe", "name": "Right Middle Lobe (RML)", "color": "#F59E0B"},
        "5": {"key": "right_lower_lobe", "name": "Right Lower Lobe (RLL)", "color": "#8B5CF6"},
    }
    # Seed verified LungMask LTRCLobes (5-Lobe) model
    ltrc = db.query(ModelVersion).filter(ModelVersion.model_key == "lungmask_ltrclobes").first()
    if not ltrc:
        ltrc = ModelVersion(
            model_key="lungmask_ltrclobes",
            display_name="LungMask U-Net (LTRCLobes — Five Pulmonary Lobes)",
            architecture="2D U-Net (depth=5, batch_norm=True, upsample)",
            package_version="lungmask==0.2.22",
            task_type="five_lobes",
            num_classes=6,
            label_map=ltrc_labels,
            weights_url="https://github.com/JoHof/lungmask/releases/download/v0.0/unet_ltrclobes-3a07043d.pth",
            weights_sha256="3a07043d",
            license_spdx="Apache-2.0",
            citation_doi="https://doi.org/10.1186/s41747-020-00173-2",
            description=(
                "Trained on the NHLBI Lung Tissue Research Consortium (LTRC) dataset to segment "
                "all five anatomical pulmonary lobes (LUL, LLL, RUL, RML, RLL)."
            ),
            known_limitations=(
                "May exhibit reduced boundary accuracy near interlobar fissures when severe dense consolidation "
                "obscures fissure visibility or on thick-slice (>5 mm) acquisitions."
            ),
            is_enabled=True,
        )
        db.add(ltrc)
    else:
        ltrc.label_map = ltrc_labels

    # Seed default researcher account if none exists
    default_user = db.query(User).filter(User.email == "researcher@pulmovision.ai").first()
    if not default_user:
        default_user = User(
            email="researcher@pulmovision.ai",
            hashed_password=get_password_hash("PulmoVision2026!"),
            full_name="Dr. Elena Vance (Thoracic Imaging Research)",
            role="researcher",
            is_active=True,
        )
        db.add(default_user)

    db.commit()
    logger.info("Database schema initialized and verified model registry seeded.")

