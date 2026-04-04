from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db.models import UnifiedRecord
from app.db.session import get_db
from app.ingestion.scheduler import run_ingestion_job

router = APIRouter()


@router.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@router.post("/ingestion/run")
async def run_ingestion() -> dict[str, int]:
    return await run_ingestion_job()


@router.get("/records")
def list_records(limit: int = 100, db: Session = Depends(get_db)) -> dict[str, list[dict]]:
    query = select(UnifiedRecord).order_by(desc(UnifiedRecord.timestamp)).limit(limit)
    rows = db.execute(query).scalars().all()
    payload = [
        {
            "id": row.id,
            "source": row.source,
            "timestamp": row.timestamp.isoformat(),
            "text": row.text,
            "location": row.location,
            "metadata": row.metadata_json,
            "content_hash": row.content_hash,
        }
        for row in rows
    ]
    return {"items": payload}
