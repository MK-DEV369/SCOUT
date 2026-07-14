from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.db.models import EventRecord, RiskRecord, Supplier
from app.risk.engine import compute_risk_score


def estimate_path_weight_relational(event: EventRecord, supplier: Supplier | None) -> float:
    if not supplier:
        return 1.0

    entities = event.entities_json if isinstance(event.entities_json, dict) else {}
    countries = entities.get("countries", [])
    event_countries = []
    for c in countries:
        if isinstance(c, dict) and c.get("text"):
            event_countries.append(c.get("text").lower())
        elif isinstance(c, str):
            event_countries.append(c.lower())

    if event.location:
        event_countries.append(event.location.lower())

    supplier_country = supplier.country.lower() if supplier.country else ""
    if supplier_country and any(supplier_country in ec or ec in supplier_country for ec in event_countries):
        return 1.5

    return 1.0


def _supplier_for_event(db: Session, event: EventRecord) -> Supplier | None:
    entities = event.entities_json if isinstance(event.entities_json, dict) else {}
    company_names = entities.get("companies", [])
    if company_names:
        company_item = company_names[0]
        if isinstance(company_item, dict):
            company = company_item.get("text")
        else:
            company = company_item
        if not company:
            return None
        supplier = db.execute(select(Supplier).where(Supplier.name == company)).scalar_one_or_none()
        if supplier:
            return supplier

        countries = entities.get("countries", [])
        supplier_country = None
        if countries:
            country_item = countries[0]
            if isinstance(country_item, dict):
                supplier_country = country_item.get("text")
            else:
                supplier_country = country_item

        import random
        supplier = Supplier(
            name=company,
            country=event.location or supplier_country,
            importance=round(random.uniform(0.3, 0.9), 2),
        )
        db.add(supplier)
        db.flush()
        return supplier
    return None


def _alert_level(score: float) -> str:
    if score < 0.4:
        return "Low"
    if score < 0.6:
        return "Medium"
    if score < 0.8:
        return "High"
    return "Critical"


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

        supplier_criticality = round((supplier.importance * 1.5) + 0.5, 4) if supplier else 1.0

        path_weight = estimate_path_weight_relational(event, supplier)

        base_risk_score = float(risk["risk_score"])
        composite_risk_score = min(1.0, base_risk_score * path_weight * supplier_criticality)
        composite_alert_level = _alert_level(composite_risk_score)

        item = RiskRecord(
            event_id=event.id,
            supplier_id=supplier.id if supplier else None,
            risk_score=composite_risk_score,
            alert_level=composite_alert_level,
            feature_json={
                "base_risk_score": base_risk_score,
                "path_weight": path_weight,
                "supplier_criticality": supplier_criticality,
                "risk_exposure_score": composite_risk_score,
                "severity": risk["severity"],
                "recency": risk["recency"],
                "credibility": risk["credibility"],
                "relevance": risk["relevance"],
                "supplier_importance": risk["supplier_importance"],
            },
        )
        db.add(item)
        created += 1

    db.commit()
    return {"created": created, "skipped": skipped}
