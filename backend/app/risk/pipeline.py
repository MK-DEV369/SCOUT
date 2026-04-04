from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db.models import EventRecord, RiskRecord, Supplier
from app.graph.neo4j_client import graph_service
from app.risk.engine import compute_risk_score


def _supplier_for_event(db: Session, event: EventRecord) -> Supplier | None:
    company_names = event.entities_json.get("companies", [])
    if company_names:
        company = company_names[0]
        supplier = db.execute(select(Supplier).where(Supplier.name == company)).scalar_one_or_none()
        if supplier:
            return supplier
    return None


def score_events(db: Session, limit: int = 100) -> dict[str, int]:
    scored_ids = {row[0] for row in db.execute(select(RiskRecord.event_id)).all()}
    events = db.execute(select(EventRecord).order_by(desc(EventRecord.timestamp)).limit(limit)).scalars().all()

    created = 0
    skipped = 0

    for event in events:
        if event.id in scored_ids:
            skipped += 1
            continue

        supplier = _supplier_for_event(db, event)

        relevance = 0.8 if event.location else 0.5
        supplier_importance = supplier.importance if supplier else 0.5

        risk = compute_risk_score(
            category=event.category,
            timestamp=event.timestamp,
            source=event.source,
            relevance=relevance,
            supplier_importance=supplier_importance,
            severity_override=event.severity,
        )

        item = RiskRecord(
            event_id=event.id,
            supplier_id=supplier.id if supplier else None,
            risk_score=float(risk["risk_score"]),
            alert_level=str(risk["alert_level"]),
            feature_json={
                "severity": risk["severity"],
                "recency": risk["recency"],
                "credibility": risk["credibility"],
                "relevance": risk["relevance"],
                "supplier_importance": risk["supplier_importance"],
            },
        )
        db.add(item)
        created += 1

        countries = event.entities_json.get("countries", [])
        commodities = event.entities_json.get("commodities", [])
        graph_service.upsert_event_path(
            event_id=event.id,
            event_category=event.category,
            country=countries[0] if countries else event.location,
            supplier_name=supplier.name if supplier else (event.entities_json.get("companies", [None])[0]),
            manufacturer_name="SCOUT Manufacturer",
            commodity=commodities[0] if commodities else None,
        )

    db.commit()
    return {"created": created, "skipped": skipped}
