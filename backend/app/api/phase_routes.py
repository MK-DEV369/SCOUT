import re
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.db.models import EventRecord, RiskRecord, Supplier
from app.db.session import get_db
from app.ingestion.scheduler import run_ingestion_job
from app.nlp.pipeline import build_structured_events
from app.risk.pipeline import score_events, estimate_path_weight_relational
from app.nlp.embeddings import embed_text
from app.db.models import EventEmbedding, OnboardingEmbedding
from app.ml.router import generate_mitigation

router = APIRouter(tags=["phase3-6"])

ALERT_ORDER = {"Low": 1, "Medium": 2, "High": 3, "Critical": 4}

LOCATION_COORDS = {
    "india": {"lat": 20.5937, "lng": 78.9629},
    "china": {"lat": 35.8617, "lng": 104.1954},
    "united states": {"lat": 37.0902, "lng": -95.7129},
    "usa": {"lat": 37.0902, "lng": -95.7129},
    "germany": {"lat": 51.1657, "lng": 10.4515},
    "singapore": {"lat": 1.3521, "lng": 103.8198},
    "shanghai": {"lat": 31.2304, "lng": 121.4737},
    "hamburg": {"lat": 53.5511, "lng": 9.9937},
    "rotterdam": {"lat": 51.9244, "lng": 4.4777},
    "long beach": {"lat": 33.7701, "lng": -118.1937},
    "los angeles": {"lat": 34.0522, "lng": -118.2437},
}


class OnboardingRequest(BaseModel):
    company_domain: str = ""
    supplier_regions: list[str] = Field(default_factory=list)
    critical_commodities: list[str] = Field(default_factory=list)
    supplier_names: list[str] = Field(default_factory=list)
    supplier_countries: list[str] = Field(default_factory=list)
    organization_type: str = ""
    experience_risk_appetite: str = "Balanced"


def _normalize_terms(values: list[str]) -> list[str]:
    terms: list[str] = []

    for value in values:
        for chunk in re.split(r"[,;\n]+", value or ""):
            normalized = chunk.strip()

            if normalized and normalized.lower() not in {
                term.lower() for term in terms
            }:
                terms.append(normalized)

    return terms


def _risk_threshold_for_appetite(appetite: str) -> str:
    mapping = {
        "conservative": "Low",
        "balanced": "Medium",
        "aggressive": "High",
    }

    return mapping.get(appetite.strip().lower(), "Medium") if appetite else "Medium"


def _text_blob(event: EventRecord, supplier: Supplier | None) -> str:
    entities = event.entities_json if isinstance(event.entities_json, dict) else {}

    parts: list[str] = [
        event.source or "",
        event.category or "",
        event.summary or "",
        event.location or "",
        supplier.name if supplier else "",
        supplier.country if supplier and supplier.country else "",
    ]

    for key in ("companies", "countries", "ports", "commodities"):
        values = entities.get(key, [])

        if isinstance(values, list):
            parts.extend(str(value) for value in values)

    return " ".join(parts).lower()


def _matches_terms(blob: str, terms: list[str]) -> bool:
    if not terms:
        return True

    return any(term.lower() in blob for term in terms)


def _profile_relevance(
    event: EventRecord,
    supplier: Supplier | None,
    payload: OnboardingRequest,
) -> float:

    blob = _text_blob(event, supplier)

    entity_terms = []
    entities = event.entities_json if isinstance(event.entities_json, dict) else {}

    for key in ("countries", "commodities", "companies", "ports"):
        values = entities.get(key, [])

        if isinstance(values, list):
            entity_terms.extend(str(value).lower() for value in values)

    domain_terms = [
        term.lower()
        for term in re.split(r"[,;\n\-/]+", payload.company_domain or "")
        if term.strip()
    ]

    organization_terms = [
        term.lower()
        for term in re.split(r"[,;\n\-/]+", payload.organization_type or "")
        if term.strip()
    ]

    supplier_regions = _normalize_terms(payload.supplier_regions)
    critical_commodities = _normalize_terms(payload.critical_commodities)
    supplier_names = _normalize_terms(payload.supplier_names)

    criteria = [
        (bool(domain_terms), 0.3),
        (bool(supplier_regions), 0.25),
        (bool(critical_commodities), 0.25),
        (bool(supplier_names), 0.15),
        (bool(organization_terms), 0.05),
    ]

    active_weight = sum(weight for is_active, weight in criteria if is_active)

    if not active_weight:
        return 1.0

    matched_weight = 0.0

    if domain_terms and _matches_terms(blob, domain_terms):
        matched_weight += 0.3

    if supplier_regions and _matches_terms(blob, supplier_regions + entity_terms):
        matched_weight += 0.25

    if critical_commodities and _matches_terms(
        blob,
        critical_commodities + entity_terms,
    ):
        matched_weight += 0.25

    if supplier_names and _matches_terms(blob, supplier_names):
        matched_weight += 0.15

    if organization_terms and _matches_terms(blob, organization_terms):
        matched_weight += 0.05

    return matched_weight / active_weight if active_weight else 0.0

@router.post("/pipeline/onboard")
async def run_onboarded_pipeline(payload: OnboardingRequest, limit: int = 100, db: Session = Depends(get_db)) -> dict:
    # Build session metadata
    session_id = f"onboard-{uuid4().hex[:16]}"
    session_data = {
        "session_id": session_id,
        "company_domain": payload.company_domain.strip(),
        "supplier_regions": _normalize_terms(payload.supplier_regions),
        "critical_commodities": _normalize_terms(payload.critical_commodities),
        "supplier_names": _normalize_terms(payload.supplier_names),
        "organization_type": payload.organization_type.strip(),
        "experience_risk_appetite": payload.experience_risk_appetite.strip(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    # Automatically register/upsert onboarding suppliers and countries in PostgreSQL
    supplier_names_norm = _normalize_terms(payload.supplier_names)
    supplier_countries_norm = _normalize_terms(payload.supplier_countries)
    for i, name in enumerate(supplier_names_norm):
        if not name:
            continue
        country = supplier_countries_norm[i] if i < len(supplier_countries_norm) else None
        existing_sup = db.execute(
            select(Supplier).where(Supplier.name == name)
        ).scalar_one_or_none()
        if existing_sup:
            if country:
                existing_sup.country = country
        else:
            new_sup = Supplier(
                name=name,
                country=country,
                importance=0.8 if i == 0 else 0.6
            )
            db.add(new_sup)
    try:
        db.commit()
    except Exception:
        db.rollback()

    # Compute a semantic embedding for the onboarding profile and persist it
    profile_text = " ".join(
        [
            payload.company_domain or "",
            " ".join(session_data["supplier_regions"]),
            " ".join(session_data["critical_commodities"]),
            " ".join(session_data["supplier_names"]),
            payload.organization_type or "",
        ]
    )
    profile_embedding = embed_text(profile_text or "onboarding profile")
    try:
        db.add(
            OnboardingEmbedding(
                session_id=session_id,
                organization_type=payload.organization_type.strip() or None,
                commodities={"values": session_data["critical_commodities"]},
                regions={"values": session_data["supplier_regions"]},
                suppliers={"values": session_data["supplier_names"]},
                risk_appetite=payload.experience_risk_appetite.strip(),
                embedding={"vector": profile_embedding},
            )
        )
        db.commit()
    except Exception:
        db.rollback()

    # Determine which alert levels to include based on appetite
    min_level = _risk_threshold_for_appetite(payload.experience_risk_appetite)
    threshold = ALERT_ORDER.get(min_level, ALERT_ORDER["Medium"])
    allowed_levels = [k for k, v in ALERT_ORDER.items() if v >= threshold]

    # Fetch candidate events that have embeddings and are at-or-above the alert threshold.
    candidates = db.execute(
        select(RiskRecord, EventRecord, Supplier, EventEmbedding)
        .join(EventRecord, EventRecord.id == RiskRecord.event_id)
        .join(EventEmbedding, EventEmbedding.event_id == EventRecord.id)
        .outerjoin(Supplier, Supplier.id == RiskRecord.supplier_id)
        .where(RiskRecord.alert_level.in_(allowed_levels))
        .limit(1000)
    ).all()

    # helper: cosine similarity
    def _cosine(a: list[float], b: list[float]) -> float:
        if not a or not b:
            return 0.0
        sa = sum(x * x for x in a) ** 0.5
        sb = sum(x * x for x in b) ** 0.5
        if sa == 0 or sb == 0:
            return 0.0
        return sum(x * y for x, y in zip(a, b)) / (sa * sb)

    # Feature weights (supplier region, commodity, supplier name, event category, graph)
    weights = {
        "supplier_region": 0.30,
        "commodity": 0.25,
        "supplier_name": 0.20,
        "event_category": 0.15,
        "graph_proximity": 0.10,
    }

    scored: list[tuple[RiskRecord, EventRecord, Supplier | None, float, float]] = []
    for risk, event, supplier, embedding_row in candidates:
        # semantic similarity
        event_vec = (embedding_row.embedding or {}).get("vector") if embedding_row else None
        semantic = _cosine(profile_embedding, event_vec or [])

        # feature matches (binary/normalized)
        blob = _text_blob(event, supplier)
        supplier_region_score = 1.0 if any(r.lower() in ((supplier.country or "") if supplier else "").lower() or r.lower() in blob for r in session_data["supplier_regions"]) else 0.0
        commodity_score = 1.0 if any(c.lower() in blob for c in session_data["critical_commodities"]) else 0.0
        supplier_name_score = 1.0 if supplier and any(s.lower() in (supplier.name or "").lower() for s in session_data["supplier_names"]) else 0.0
        event_category_score = 1.0 if any(cat.lower() in (event.category or "").lower() for cat in session_data["critical_commodities"]) else 0.0

        # graph proximity via relational estimate_path_weight (normalized)
        try:
            path_weight = estimate_path_weight_relational(event, supplier)
            graph_score = min(1.0, float(path_weight) / 2.0)
        except Exception:
            graph_score = 0.0

        feature_score = (
            weights["supplier_region"] * supplier_region_score
            + weights["commodity"] * commodity_score
            + weights["supplier_name"] * supplier_name_score
            + weights["event_category"] * event_category_score
            + weights["graph_proximity"] * graph_score
        )

        # combine semantic and feature scores
        combined = 0.6 * semantic + 0.4 * feature_score

        scored.append((risk, event, supplier, float(combined), float(semantic)))

    # Filter and pick top-K (with Search Relaxation if no strict matches are found)
    filtered_scored = [s for s in scored if s[3] >= 0.35]
    if not filtered_scored:
        # Relax threshold to 0.15
        filtered_scored = [s for s in scored if s[3] >= 0.15]
    if not filtered_scored:
        # Final fallback to return all candidate events sorted by combined score
        filtered_scored = scored

    filtered_scored.sort(key=lambda x: x[3], reverse=True)
    top = filtered_scored[:limit]

    events = [_serialize_event(event) for _, event, _, _, _ in top]
    risk_items = [_serialize_risk(risk, event, supplier) for risk, event, supplier, _, _ in top]
    alerts = [_serialize_alert(risk, event, supplier) for risk, event, supplier, _, _ in top]

    # Keep onboarding request retrieval-only. Graph upserts are handled by background jobs.

    # Generate mitigation summary via LLM (async)
    mitigation_result = {}
    try:
        text_for_mitigation = "\n\n".join([e.get("summary", "") for e in events])[:4000]
        mitigation_result = await generate_mitigation(text_for_mitigation, {"organization": payload.company_domain or payload.organization_type})
    except Exception:
        mitigation_result = {"summary": "", "confidence": 0.0}

    return {
        "filters": session_data,
        "counts": {"events": len(events), "risk_items": len(risk_items), "alerts": len(alerts)},
        "events": events,
        "riskItems": risk_items,
        "alerts": alerts,
        "mitigation": mitigation_result,
    }

def _serialize_event(event: EventRecord) -> dict:
    return {
        "id": event.id,
        "event_id": event.id,
        "unified_record_id": event.unified_record_id,
        "source": event.source,
        "timestamp": event.timestamp.isoformat(),
        "category": event.category,
        "summary": event.summary,
        "location": event.location,
        "severity": event.severity,
        "entities": event.entities_json,
    }


def _serialize_risk(
    risk: RiskRecord,
    event: EventRecord,
    supplier: Supplier | None,
) -> dict:

    return {
        "risk_id": risk.id,
        "event_id": event.id,
        "supplier": supplier.name if supplier else None,
        "risk_score": risk.risk_score,
        "alert_level": risk.alert_level,
        "features": risk.feature_json,
        "explanation": _build_explanation(event, supplier),
    }


def _serialize_alert(
    risk: RiskRecord,
    event: EventRecord,
    supplier: Supplier | None,
) -> dict:

    return {
        "id": risk.id,
        "event_id": event.id,
        "risk_score": risk.risk_score,
        "alert_level": risk.alert_level,
        "summary": event.summary,
        "supplier": supplier.name if supplier else None,
        "explanation": _build_explanation(event, supplier),
        "timestamp": event.timestamp.isoformat(),
        "source": event.source,
        "location": event.location,
        "entities": event.entities_json,
        "features": risk.feature_json,
    }


def _build_explanation(event: EventRecord, supplier: Supplier | None) -> str:
    supplier_name = supplier.name if supplier else "monitored supplier set"

    countries = []

    if isinstance(event.entities_json, dict):
        raw_countries = event.entities_json.get("countries", [])

        countries = raw_countries if isinstance(raw_countries, list) else []

    first_country = countries[0] if countries else None

    where = event.location or first_country or "upstream lane"

    return (
        f"{event.category} disruption in {where} "
        f"can impact {supplier_name} via dependency links"
    )


DYNAMIC_COORDS = {}

def _load_dynamic_coords():
    global DYNAMIC_COORDS
    if DYNAMIC_COORDS:
        return
    try:
        import pandas as pd
        from pathlib import Path
        csv_path = Path(__file__).resolve().parents[3] / "data" / "worldbank" / "SPI_data.csv"
        if csv_path.exists():
            df = pd.read_csv(csv_path)
            df = df.dropna(subset=['country', 'latitude', 'longitude'])
            df_coords = df[['country', 'iso3c', 'latitude', 'longitude']].drop_duplicates()
            for _, row in df_coords.iterrows():
                country = str(row['country']).strip().lower()
                iso3c = str(row['iso3c']).strip().lower()
                lat = float(row['latitude'])
                lng = float(row['longitude'])
                DYNAMIC_COORDS[country] = {"lat": lat, "lng": lng}
                DYNAMIC_COORDS[iso3c] = {"lat": lat, "lng": lng}
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Could not load dynamic coordinates from SPI_data.csv: %s", e)


def _coords_for_event(event: EventRecord) -> dict[str, float | None]:
    _load_dynamic_coords()
    candidates = [
        event.location,
        *(
            event.entities_json.get("ports", [])[:1]
            if isinstance(event.entities_json, dict)
            else []
        ),
        *(
            event.entities_json.get("countries", [])[:1]
            if isinstance(event.entities_json, dict)
            else []
        ),
    ]

    for value in candidates:
        if not value:
            continue

        val_lower = str(value).lower()
        if val_lower in DYNAMIC_COORDS:
            return DYNAMIC_COORDS[val_lower]

        coord = LOCATION_COORDS.get(val_lower)

        if coord:
            return coord

    return {"lat": None, "lng": None}


@router.post("/ingest")
async def ingest_now() -> dict:
    return await run_ingestion_job()


@router.post("/events")
def process_events(limit: int = 100, db: Session = Depends(get_db)) -> dict:
    return build_structured_events(db, limit=limit)


@router.get("/events")
def list_events(source: str | None = None, limit: int = 100, db: Session = Depends(get_db)) -> dict:
    stmt = select(EventRecord)
    if source:
        stmt = stmt.where(EventRecord.source == source)
    rows = db.execute(
        stmt.order_by(desc(EventRecord.timestamp))
        .limit(limit)
    ).scalars().all()

    return {
        "items": [
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
    }


@router.post("/risk")
def run_risk(limit: int = 100, db: Session = Depends(get_db)) -> dict:
    return score_events(db, limit=limit)


@router.get("/risk")
def list_risk(source: str | None = None, limit: int = 100, db: Session = Depends(get_db)) -> dict:
    stmt = select(RiskRecord).join(EventRecord, EventRecord.id == RiskRecord.event_id)
    if source:
        stmt = stmt.where(EventRecord.source == source)
    rows = db.execute(
        stmt.order_by(desc(RiskRecord.risk_score))
        .limit(limit)
    ).scalars().all()

    return {
        "items": [
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
    }


@router.get("/alerts")
def list_alerts(
    min_level: str = "Medium",
    source: str | None = None,
    limit: int = 100,
    db: Session = Depends(get_db),
) -> dict:

    threshold = ALERT_ORDER.get(min_level, 2)

    stmt = select(RiskRecord, EventRecord, Supplier).join(EventRecord, EventRecord.id == RiskRecord.event_id).outerjoin(Supplier, Supplier.id == RiskRecord.supplier_id)
    if source:
        stmt = stmt.where(EventRecord.source == source)
    rows = db.execute(
        stmt.order_by(desc(RiskRecord.risk_score))
        .limit(limit)
    ).all()

    filtered = [
        row
        for row in rows
        if ALERT_ORDER.get(row[0].alert_level, 0) >= threshold
    ]

    return {
        "items": [
            {
                "risk_id": risk.id,
                "event_id": event.id,
                "event": event.summary,
                "supplier": supplier.name if supplier else None,
                "risk_score": risk.risk_score,
                "alert_level": risk.alert_level,
                "features": risk.feature_json,
                "explanation": _build_explanation(event, supplier),
            }
            for risk, event, supplier in filtered
        ]
    }


@router.get("/top-risks")
def top_risks(
    limit: int = 20,
    min_level: str = "Medium",
    source: str | None = None,
    db: Session = Depends(get_db),
) -> dict:

    threshold = ALERT_ORDER.get(min_level, 2)

    stmt = select(RiskRecord, EventRecord, Supplier).join(EventRecord, EventRecord.id == RiskRecord.event_id).outerjoin(Supplier, Supplier.id == RiskRecord.supplier_id)
    if source:
        stmt = stmt.where(EventRecord.source == source)
    rows = db.execute(
        stmt.order_by(desc(RiskRecord.risk_score))
        .limit(limit)
    ).all()

    items = []

    for risk, event, supplier in rows:
        if ALERT_ORDER.get(risk.alert_level, 0) < threshold:
            continue

        items.append(
            {
                "risk_id": risk.id,
                "event_id": event.id,
                "level": risk.alert_level,
                "risk_score": risk.risk_score,
                "supplier": supplier.name if supplier else None,
                "category": event.category,
                "timestamp": event.timestamp.isoformat(),
                "explanation": _build_explanation(event, supplier),
            }
        )

    return {"items": items}


@router.get("/events/trends")
def event_trends(source: str | None = None, db: Session = Depends(get_db)) -> dict:
    now_utc = datetime.now(timezone.utc)

    today_start = now_utc.replace(
        hour=0,
        minute=0,
        second=0,
        microsecond=0,
    )

    tomorrow_start = today_start + timedelta(days=1)
    yesterday_start = today_start - timedelta(days=1)

    today_stmt = select(func.count()).select_from(EventRecord).where(EventRecord.timestamp >= today_start).where(EventRecord.timestamp < tomorrow_start)
    if source:
        today_stmt = today_stmt.where(EventRecord.source == source)
    today_count = int(db.execute(today_stmt).scalar() or 0)

    day_bucket = func.date_trunc("day", EventRecord.timestamp)

    prior_stmt = select(day_bucket, func.count()).select_from(EventRecord).group_by(day_bucket)
    if source:
        prior_stmt = prior_stmt.where(EventRecord.source == source)
    prior_rows = db.execute(
        prior_stmt.order_by(desc(day_bucket))
        .offset(1)
        .limit(7)
    ).all()

    prior_avg = (
        sum(int(row[1]) for row in prior_rows) / len(prior_rows)
        if prior_rows
        else 0.0
    )

    trend = "stable"

    if prior_avg > 0 and today_count > prior_avg * 1.5:
        trend = "spike"

    elif prior_avg > 0 and today_count < prior_avg * 0.7:
        trend = "drop"

    yesterday_stmt = select(func.count()).select_from(EventRecord).where(EventRecord.timestamp >= yesterday_start).where(EventRecord.timestamp < today_start)
    if source:
        yesterday_stmt = yesterday_stmt.where(EventRecord.source == source)
    yesterday_count = int(db.execute(yesterday_stmt).scalar() or 0)

    return {
        "today_event_count": today_count,
        "yesterday_event_count": yesterday_count,
        "prior_7_day_average": round(prior_avg, 2),
        "trend": trend,
    }


@router.get("/risk-map")
def risk_map(
    limit: int = 100,
    min_level: str = "Medium",
    source: str | None = None,
    db: Session = Depends(get_db),
) -> dict:

    threshold = ALERT_ORDER.get(min_level, 2)

    stmt = select(RiskRecord, EventRecord).join(EventRecord, EventRecord.id == RiskRecord.event_id)
    if source:
        stmt = stmt.where(EventRecord.source == source)
    rows = db.execute(
        stmt.order_by(desc(RiskRecord.risk_score))
        .limit(limit)
    ).all()

    points = []

    for risk, event in rows:
        if ALERT_ORDER.get(risk.alert_level, 0) < threshold:
            continue

        coords = _coords_for_event(event)

        points.append(
            {
                "event_id": event.id,
                "risk_id": risk.id,
                "risk": risk.risk_score,
                "level": risk.alert_level,
                "location": event.location,
                "lat": coords["lat"],
                "lng": coords["lng"],
            }
        )

    return {"items": points}


@router.post("/suppliers")
def upsert_supplier(
    name: str,
    country: str | None = None,
    importance: float = 0.5,
    db: Session = Depends(get_db),
) -> dict:

    existing = db.execute(
        select(Supplier).where(Supplier.name == name)
    ).scalar_one_or_none()

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
    rows = db.execute(
        select(Supplier)
        .order_by(Supplier.importance.desc())
        .limit(limit)
    ).scalars().all()

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