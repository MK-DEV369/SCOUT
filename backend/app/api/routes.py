from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import desc, select, text
from sqlalchemy.orm import Session

from app.db.models import UnifiedRecord, EventRecord
from app.db.session import engine, get_db
from app.ingestion.service import ingestion_service
from app.ingestion.scheduler import run_ingestion_job
from app.nlp.explainability import generate_event_explanation

router = APIRouter()


@router.get("/health")
def health() -> dict:
    db_status = "disconnected"
    db_error = None
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        db_status = "connected"
    except Exception as exc:  # noqa: BLE001
        db_error = str(exc)

    ingestion_ready = db_status == "connected"

    return {
        "status": "ok" if db_status == "connected" else "degraded",
        "db": db_status,
        "neo4j": "removed",
        "ingestion": "ready" if ingestion_ready else "not_ready",
        "errors": {
            "db": db_error,
            "neo4j": None,
        },
    }


@router.post("/ingestion/run")
async def run_ingestion() -> dict:
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


@router.get("/events/{event_id}/explain")
def get_event_explanation(event_id: int, db: Session = Depends(get_db)) -> dict:
    """Get detailed explainability for why this event was classified/extracted."""
    event = db.query(EventRecord).filter(EventRecord.id == event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail=f"Event {event_id} not found")
    
    explanation = generate_event_explanation(event)
    return explanation
