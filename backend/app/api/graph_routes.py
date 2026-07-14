from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.orm import Session

from app.db.models import EventRecord, RiskRecord, Supplier
from app.db.session import get_db

router = APIRouter(tags=["graph"])


@router.get("/impact/{event_id}")
def get_impact(event_id: int, manufacturer_id: str = Query(...), limit: int = 25, db: Session = Depends(get_db)) -> dict:
    rows = db.execute(
        select(RiskRecord, EventRecord, Supplier)
        .join(EventRecord, EventRecord.id == RiskRecord.event_id)
        .outerjoin(Supplier, Supplier.id == RiskRecord.supplier_id)
        .where(RiskRecord.event_id == event_id)
        .order_by(RiskRecord.risk_score.desc())
        .limit(limit)
    ).all()

    payload: list[dict] = []
    for risk, event, supplier in rows:
        features = risk.feature_json or {}
        entities = event.entities_json or {}
        path_types = ["AFFECTS_COUNTRY"]
        countries = entities.get("countries", [])
        if countries:
            path_types.append("EXPOSES")

        payload.append(
            {
                "event_id": event.id,
                "event_type": event.category,
                "supplier_id": supplier.id if supplier else None,
                "supplier": supplier.name if supplier else "unmapped_supplier",
                "risk": float(risk.risk_score),
                "path_weight": float(features.get("path_weight", 1.0)),
                "path": path_types,
                "explanation": " -> ".join(path_types) if path_types else "No exposure path found",
            }
        )

    if not payload:
        payload.append(
            {
                "event_id": event_id,
                "event_type": "unknown",
                "supplier_id": None,
                "supplier": "unmapped_supplier",
                "risk": None,
                "path_weight": 0.0,
                "path": [],
                "explanation": "No exposure path found",
            }
        )

    return {"enabled": True, "items": payload}


@router.get("/supplier-risk/{supplier_id}")
def get_supplier_risk(supplier_id: int, limit: int = 10, db: Session = Depends(get_db)) -> dict:
    supplier = db.execute(
        select(Supplier).where(Supplier.id == supplier_id)
    ).scalar_one_or_none()

    if not supplier:
        return {"enabled": True, "summary": {}, "events": []}

    rows = db.execute(
        select(RiskRecord, EventRecord)
        .join(EventRecord, EventRecord.id == RiskRecord.event_id)
        .where(RiskRecord.supplier_id == supplier_id)
        .order_by(RiskRecord.risk_score.desc())
        .limit(limit)
    ).all()

    events = []
    exposure_scores = []
    for risk, event in rows:
        features = risk.feature_json or {}
        exposure_scores.append(float(risk.risk_score))
        events.append({
            "event_id": event.id,
            "event_type": event.category,
            "headline": event.summary[:240],
            "composite_risk_score": float(risk.risk_score),
            "risk_exposure_score": float(risk.risk_score),
            "path_weight": float(features.get("path_weight", 1.0)),
        })

    summary = {
        "supplier_id": supplier.id,
        "supplier_name": supplier.name,
        "country": supplier.country,
        "criticality": float(supplier.importance),
        "exposure_count": len(events),
        "max_exposure": max(exposure_scores) if exposure_scores else 0.0,
        "avg_exposure": sum(exposure_scores) / len(exposure_scores) if exposure_scores else 0.0,
    }

    return {
        "enabled": True,
        "summary": summary,
        "events": events,
    }


@router.get("/graph-summary")
def graph_summary(db: Session = Depends(get_db)) -> dict:
    event_count = db.execute(select(func.count(EventRecord.id))).scalar() or 0
    supplier_count = db.execute(select(func.count(Supplier.id))).scalar() or 0

    countries = set()
    suppliers = db.execute(select(Supplier.country)).scalars().all()
    for c in suppliers:
        if c:
            countries.add(c)

    events = db.execute(select(EventRecord.location)).scalars().all()
    for c in events:
        if c:
            countries.add(c)

    node_count = event_count + supplier_count + len(countries)
    relationship_count = db.execute(select(func.count(RiskRecord.id))).scalar() or 0

    labels = [
        {"label": "RiskEvent", "count": event_count},
        {"label": "Supplier", "count": supplier_count},
        {"label": "Country", "count": len(countries)},
    ]

    relationship_types = [
        {"type": "EXPOSES", "count": relationship_count},
        {"type": "LOCATED_IN", "count": supplier_count},
    ]

    return {
        "enabled": True,
        "node_count": node_count,
        "relationship_count": relationship_count,
        "labels": labels,
        "relationship_types": relationship_types,
    }


@router.post("/sync")
def sync_graph(clear_existing: bool = False, limit: int = 1000, db: Session = Depends(get_db)) -> dict:
    return {
        "enabled": True,
        "synced": 0,
        "message": "Relational backend automatically synced.",
    }
