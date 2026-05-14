from sqlalchemy import select
from sqlalchemy.orm import Session
import logging

from app.db.models import EventEmbedding, EventRecord, UnifiedRecord
from app.nlp.embeddings import embed_text
from app.nlp.entity_extractor import extract_entities
from app.nlp.event_classifier import classify_event
from app.nlp.schemas import ExtractedEntities
from app.nlp.summarizer import summarize_as_bullets
from app.nlp.clustering import run_cluster_analysis


logger = logging.getLogger(__name__)


TEXT_SOURCES = {
    "gdelt",
    "google_news",
    "newsapi",
    "acled",
}

STRUCTURED_SOURCES = {
    "fred",
    "worldbank",
    "freightos",
}

ENTITY_CONFIDENCE_THRESHOLDS = {
    "acled": 0.6,
    "gdelt": 0.75,
    "newsapi": 0.8,
    "google_news": 0.8,
}

CATEGORY_BY_SOURCE = {
    "fred": "economic",
    "worldbank": "economic",
    "freightos": "logistics",
}

CATEGORY_NORMALIZATION = {
    "geopolitical": "conflict",
    "logistics": "logistics_delay",
    "environmental": "weather",
    "economic": "economic",
}


def filter_entities_by_confidence(entities: ExtractedEntities, min_confidence: float = 0.7) -> ExtractedEntities:
    """Filter entities to only include those with confidence >= min_confidence."""
    return ExtractedEntities(
        companies=[e for e in entities.companies if e.confidence >= min_confidence],
        manufacturers=[e for e in entities.manufacturers if e.confidence >= min_confidence],
        countries=[e for e in entities.countries if e.confidence >= min_confidence],
        ports=[e for e in entities.ports if e.confidence >= min_confidence],
        commodities=[e for e in entities.commodities if e.confidence >= min_confidence],
        transport_modes=[e for e in entities.transport_modes if e.confidence >= min_confidence],
        conflict_actors=[e for e in entities.conflict_actors if e.confidence >= min_confidence],
    )


def _entity_threshold(source: str) -> float:
    return ENTITY_CONFIDENCE_THRESHOLDS.get(source.lower(), 0.7)


def _normalize_category(category: str | None, source: str) -> str:
    if source.lower() in CATEGORY_BY_SOURCE:
        return CATEGORY_BY_SOURCE[source.lower()]
    if not category:
        return "other"
    return CATEGORY_NORMALIZATION.get(category.lower(), category.lower())


def _event_summary(record: UnifiedRecord) -> str:
    metadata_summary = record.metadata_json.get("semantic_text")
    if isinstance(metadata_summary, str) and metadata_summary.strip():
        return metadata_summary.strip()
    return record.text


async def build_structured_events(
    db: Session,
    limit: int = 100,
    entity_confidence_threshold: float = 0.7,
    cluster_min_size: int = 3,
) -> dict[str, int]:
    logger.info(
        "Starting structured event build limit=%s entity_confidence_threshold=%s cluster_min_size=%s",
        limit,
        entity_confidence_threshold,
        cluster_min_size,
    )
    processed_ids = {
        row[0]
        for row in db.execute(select(EventRecord.unified_record_id)).all()
    }
    candidates = db.execute(
        select(UnifiedRecord).order_by(UnifiedRecord.timestamp.desc()).limit(limit)
    ).scalars().all()
    created = 0
    skipped = 0
    for record in candidates:
        if record.id in processed_ids:
            skipped += 1
            logger.debug("Skipping unified_record_id=%s because it is already processed", record.id)
            continue

        source = record.source.lower()
        summary_confidence = None
        classifier_model = None
        classifier_confidence = None
        classification_payload: dict[str, object] | None = None

        if source in TEXT_SOURCES:
            threshold = _entity_threshold(source)
            logger.debug("Processing text source=%s unified_record_id=%s threshold=%s", source, record.id, threshold)
            entities = extract_entities(record.text)
            entities = filter_entities_by_confidence(entities, min_confidence=threshold)
            classification_payload = classify_event(record.text, source=source)
            category = _normalize_category(str(classification_payload.get("primary_category")), source)
            classifier_confidence = float(classification_payload.get("confidence", 0.5) or 0.5)
            classifier_model = str(classification_payload.get("model_id", "heuristic"))
            summary, summary_confidence = await summarize_as_bullets(
                record.text,
                context={
                    "source": record.source,
                    "location": record.location,
                    "source_url": record.source_url,
                    "source_credibility": record.source_credibility,
                    "metadata": record.metadata_json,
                },
            )
            logger.debug(
                "Built text event unified_record_id=%s category=%s confidence=%s classifier_model=%s summary_confidence=%s",
                record.id,
                category,
                classifier_confidence,
                classifier_model,
                summary_confidence,
            )
        else:
            logger.debug("Processing structured source=%s unified_record_id=%s", source, record.id)
            entities = ExtractedEntities()
            category = _normalize_category(record.metadata_json.get("category"), source)
            classifier_confidence = float(record.metadata_json.get("confidence", 0.5) or 0.5)
            summary = _event_summary(record)

        embedding = embed_text(summary)
        logger.debug("Embedding generated for unified_record_id=%s vector_length=%s", record.id, len(embedding))
        severity = float(record.metadata_json.get("severity", 0.5) or 0.5)

        event = EventRecord(
            unified_record_id=record.id,
            source=record.source,
            timestamp=record.timestamp,
            category=category,
            summary=summary,
            summary_confidence=summary_confidence,
            location=record.location,
            source_url=record.source_url,
            source_credibility=record.source_credibility,
            severity=min(max(severity, 0.0), 1.0),
            entities_json=entities.model_dump(),
            metadata_json={**record.metadata_json, **({"classification": classification_payload} if classification_payload else {})},
            classifier_model=classifier_model,
            classifier_confidence=float(min(max(classifier_confidence, 0.0), 1.0)) if classifier_confidence is not None else None,
        )
        db.add(event)
        db.flush()
        db.add(
            EventEmbedding(
                event_id=event.id,
                embedding={"vector": embedding},
                cluster_id=None,
            )
        )
        created += 1
        logger.info("Created event_record_id=%s source=%s category=%s", event.id, event.source, event.category)
    db.commit()

    clustered = 0
    try:
        logger.info("Triggering cluster analysis after structured event build")
        clustered = run_cluster_analysis(min_cluster_size=cluster_min_size)
    except Exception:
        logger.exception("Cluster analysis failed after structured event build")
        clustered = 0

    logger.info("Structured event build completed created=%s skipped=%s clustered=%s", created, skipped, clustered)
    return {"created": created, "skipped": skipped, "clustered": clustered}
