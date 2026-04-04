from fastapi import APIRouter, Depends
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db.models import EventRecord, RiskRecord, Supplier
from app.db.session import get_db
from app.ingestion.scheduler import run_ingestion_job
from app.nlp.pipeline import build_structured_events
from app.risk.pipeline import score_events

router = APIRouter(tags=["phase3-6"])


@router.post("/ingest")
async def ingest_now() -> dict:
    return await run_ingestion_job()


@router.post("/events")
def process_events(limit: int = 100, db: Session = Depends(get_db)) -> dict:
    return build_structured_events(db, limit=limit)


@router.get("/events")
def list_events(limit: int = 100, db: Session = Depends(get_db)) -> dict:
    rows = db.execute(select(EventRecord).order_by(desc(EventRecord.timestamp)).limit(limit)).scalars().all()
    items = [
        {
            "id": row.id,
            "unified_record_id": row.unified_record_id,
            "source": row.source,
            "timestamp": row.timestamp.isoformat(),
            "category": row.category,
            "summary": row.summary,
            "location": row.location,
            "severity": row.severity,
            "entities": row.entities_json,
        }
        for row in rows
    ]
    return {"items": items}


@router.post("/risk")
def run_risk(limit: int = 100, db: Session = Depends(get_db)) -> dict:
    return score_events(db, limit=limit)


@router.get("/risk")
def list_risk(limit: int = 100, db: Session = Depends(get_db)) -> dict:
    rows = db.execute(select(RiskRecord).order_by(desc(RiskRecord.risk_score)).limit(limit)).scalars().all()
    items = [
        {
            "id": row.id,
            "event_id": row.event_id,
            "supplier_id": row.supplier_id,
            "risk_score": row.risk_score,
            "alert_level": row.alert_level,
            "features": row.feature_json,
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]
    return {"items": items}


@router.get("/alerts")
def list_alerts(min_level: str = "Medium", limit: int = 100, db: Session = Depends(get_db)) -> dict:
    order = {"Low": 1, "Medium": 2, "High": 3, "Critical": 4}
    threshold = order.get(min_level, 2)

    rows = db.execute(select(RiskRecord).order_by(desc(RiskRecord.risk_score)).limit(limit)).scalars().all()
    filtered = [r for r in rows if order.get(r.alert_level, 0) >= threshold]

    return {
        "items": [
            {
                "risk_id": row.id,
                "event_id": row.event_id,
                "risk_score": row.risk_score,
                "alert_level": row.alert_level,
                "features": row.feature_json,
            }
            for row in filtered
        ]
    }


@router.post("/suppliers")
def upsert_supplier(
    name: str,
    country: str | None = None,
    importance: float = 0.5,
    db: Session = Depends(get_db),
) -> dict:
    existing = db.execute(select(Supplier).where(Supplier.name == name)).scalar_one_or_none()
    if existing:
        existing.country = country
        existing.importance = max(0.0, min(1.0, importance))
        db.commit()
        db.refresh(existing)
        return {
            "id": existing.id,
            "name": existing.name,
            "country": existing.country,
            "importance": existing.importance,
        }

    supplier = Supplier(
        name=name,
        country=country,
        importance=max(0.0, min(1.0, importance)),
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    return {
        "id": supplier.id,
        "name": supplier.name,
        "country": supplier.country,
        "importance": supplier.importance,
    }


@router.get("/suppliers")
def list_suppliers(limit: int = 200, db: Session = Depends(get_db)) -> dict:
    rows = db.execute(select(Supplier).order_by(Supplier.importance.desc()).limit(limit)).scalars().all()
    return {
        "items": [
            {
                "id": row.id,
                "name": row.name,
                "country": row.country,
                "importance": row.importance,
            }
            for row in rows
        ]
    }
