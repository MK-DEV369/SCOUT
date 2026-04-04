from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import settings
from app.db.session import SessionLocal
from app.ingestion.service import ingestion_service

scheduler = AsyncIOScheduler()


async def run_ingestion_job() -> dict[str, int]:
    records = await ingestion_service.collect()
    with SessionLocal() as db:
        return ingestion_service.save(db, records)


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
