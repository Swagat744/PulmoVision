"""PulmoVision AI — FastAPI Application Entrypoint."""
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api import auth, reports, segmentation, studies, viewer
from app.core.config import settings
from app.core.logging import logger
from app.db.session import SessionLocal, init_db_and_seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize database schema and seed verified models on startup."""
    db = SessionLocal()
    try:
        init_db_and_seed(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description=(
        "AI-Powered Thoracic CT Segmentation, 2D/3D Anatomical Visualization, "
        "and Quantitative Volumetric Research Platform. (Research & Educational Prototype)"
    ),
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=[
        "X-Slice-Width",
        "X-Slice-Height",
        "X-Spacing-Horizontal-MM",
        "X-Spacing-Vertical-MM",
        "X-Plane",
        "X-Slice-Index",
        "X-Data-Type",
    ],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Sanitize unexpected internal exceptions so server file paths never leak to clients."""
    logger.exception(f"Unhandled exception on {request.method} {request.url.path}: {exc}")
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An internal processing error occurred. Please check server logs."},
    )


app.include_router(auth.router)
app.include_router(studies.router)
app.include_router(segmentation.router)
app.include_router(viewer.router)
app.include_router(reports.router)


@app.get("/api/v1/health", tags=["Health"])
def health_check():
    """Return service health and research disclaimer."""
    return {
        "status": "healthy",
        "service": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "disclaimer": (
            "Research and educational prototype only. Not a clinically approved diagnostic device."
        ),
    }

