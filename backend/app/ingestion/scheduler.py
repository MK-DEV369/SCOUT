import asyncio
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import settings
from app.db.session import SessionLocal
from app.ingestion.service import ingestion_service
from app.pipeline.orchestrator import IntelligencePipeline

scheduler = AsyncIOScheduler()
logger = logging.getLogger(__name__)

pipeline = IntelligencePipeline(
    collect_stage=ingestion_service.collect_with_stats,
    persist_stage=ingestion_service.save,
    session_factory=SessionLocal,
)


async def run_ingestion_job() -> dict:
    try:
        result = await asyncio.wait_for(
            pipeline.run(),
            timeout=settings.ingestion_job_timeout_seconds,
        )
    except TimeoutError:
        logger.warning("Ingestion collect timed out after %s seconds", settings.ingestion_job_timeout_seconds)
        return {
            "status": "error",
            "fetched_total": 0,
            "inserted": 0,
            "duplicates": 0,
            "error_count": 1,
            "source_counts": {},
            "errors": [{"source": "scheduler", "error": "ingestion job timeout"}],
        }

    except Exception as exc:  # noqa: BLE001
        logger.exception("DB session failed during ingestion job", exc_info=exc)
        return {
            "status": "error",
            "fetched_total": 0,
            "inserted": 0,
            "duplicates": 0,
            "error_count": 1,
            "source_counts": {},
            "errors": [{"source": "pipeline", "error": str(exc)}],
            "db_error": str(exc),
        }

    return result


def start_scheduler() -> None:
    if scheduler.running:
        return

    scheduler.add_job(
        run_ingestion_job,
        trigger="interval",
        minutes=settings.ingestion_interval_minutes,
        id="ingestion_job",
        replace_existing=True,
    )
    scheduler.start()
