import logging
from logging.config import dictConfig
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.graph_routes import router as graph_router
from app.api.ml_routes import router as ml_router
from app.api.phase_routes import router as phase_router
from app.api.routes import router as api_router
from app.core.config import settings
from app.db.base import Base
from app.db.session import engine
from app.ingestion.scheduler import start_scheduler
from app.ml.manager import load_models
from app.integration.databricks import trigger_default_job

LOG_FILE_PATH = Path(__file__).resolve().parents[1] / "backend.log"


def configure_logging() -> None:
    LOG_FILE_PATH.parent.mkdir(parents=True, exist_ok=True)
    dictConfig(
        {
            "version": 1,
            "disable_existing_loggers": False,
            "formatters": {
                "default": {
                    "format": "%(asctime)s %(levelname)s [%(name)s] %(message)s",
                },
            },
            "handlers": {
                "console": {
                    "class": "logging.StreamHandler",
                    "formatter": "default",
                    "level": "INFO",
                },
                "file": {
                    "class": "logging.FileHandler",
                    "filename": str(LOG_FILE_PATH),
                    "encoding": "utf-8",
                    "formatter": "default",
                    "level": "INFO",
                },
            },
            "root": {
                "handlers": ["console", "file"],
                "level": "INFO",
            },
            "loggers": {
                "uvicorn": {
                    "handlers": ["console", "file"],
                    "level": "INFO",
                    "propagate": False,
                },
                "uvicorn.error": {
                    "handlers": ["console", "file"],
                    "level": "INFO",
                    "propagate": False,
                },
                "uvicorn.access": {
                    "handlers": ["console", "file"],
                    "level": "INFO",
                    "propagate": False,
                },
            },
        }
    )


configure_logging()
logger = logging.getLogger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Database bootstrap failed during startup", exc_info=exc)
    # load ML models into memory
    try:
        load_models()
    except Exception:
        logger.exception("Failed to load ML models on startup")

    # Trigger Databricks default job, but keep startup alive if Databricks denies the request.
    try:
        databricks_result = trigger_default_job()
        if not databricks_result.get("triggered", True):
            reason = databricks_result.get("reason") or databricks_result.get("error", "Unknown reason")
            logger.info("Databricks startup job skipped: %s", reason)
    except Exception:
        logger.exception("Failed to trigger Databricks job on startup")

    start_scheduler()
    yield
    # shutdown (scheduler cleanup could go here)


app = FastAPI(title=settings.app_name, lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")
app.include_router(ml_router, prefix="/api/v1")
app.include_router(phase_router, prefix="/api/v1")
app.include_router(graph_router, prefix="/api/v1")

frontend_dir = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if frontend_dir.exists():
    app.mount("/", StaticFiles(directory=str(frontend_dir), html=True), name="frontend")
