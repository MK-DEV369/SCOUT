import asyncio
import logging
from datetime import datetime, timezone

from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import settings
from app.db.session import SessionLocal
from app.ingestion.service import ingestion_service
from app.nlp.pipeline import build_structured_events
from app.pipeline.orchestrator import IntelligencePipeline
from app.risk.pipeline import score_events

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


async def run_nlp_job(limit: int = 250) -> dict:
    try:
        with SessionLocal() as db:
            result = await asyncio.wait_for(
                build_structured_events(db, limit=limit),
                timeout=settings.nlp_job_timeout_seconds,
            )
            return {"status": "ok", **result}
    except TimeoutError:
        logger.warning("NLP job timed out after %s seconds", settings.nlp_job_timeout_seconds)
        return {"status": "error", "error": "nlp job timeout"}
    except Exception as exc:  # noqa: BLE001
        logger.exception("NLP job failed", exc_info=exc)
        return {"status": "error", "error": str(exc)}


async def run_risk_job(limit: int = 250) -> dict:
    try:
        def _risk_stage() -> dict:
            with SessionLocal() as db:
                return score_events(db, limit=limit)

        result = await asyncio.wait_for(
            asyncio.to_thread(_risk_stage),
            timeout=settings.risk_job_timeout_seconds,
        )
        return {"status": "ok", **result}
    except TimeoutError:
        logger.warning("Risk job timed out after %s seconds", settings.risk_job_timeout_seconds)
        return {"status": "error", "error": "risk job timeout"}
    except Exception as exc:  # noqa: BLE001
        logger.exception("Risk job failed", exc_info=exc)
        return {"status": "error", "error": str(exc)}


def start_scheduler() -> None:
    if scheduler.running:
        return

    async def bootstrap_pipeline() -> None:
        # Run a full pass immediately at startup so data is available before interval ticks.
        await run_ingestion_job()
        await run_nlp_job()
        await run_risk_job()

    scheduler.add_job(
        bootstrap_pipeline,
        trigger="date",
        run_date=datetime.now(timezone.utc),
        id="bootstrap_pipeline_job",
        replace_existing=True,
    )

    scheduler.add_job(
        run_ingestion_job,
        trigger="interval",
        minutes=settings.ingestion_interval_minutes,
        id="ingestion_job",
        replace_existing=True,
    )
    scheduler.add_job(
        run_nlp_job,
        trigger="interval",
        minutes=settings.nlp_interval_minutes,
        id="nlp_job",
        replace_existing=True,
    )
    scheduler.add_job(
        run_risk_job,
        trigger="interval",
        minutes=settings.risk_interval_minutes,
        id="risk_job",
        replace_existing=True,
    )
    scheduler.start()
