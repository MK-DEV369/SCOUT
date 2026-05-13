from app.enrichment.semantic_text_builder import build_semantic_text
from app.ingestion.schema import NormalizedRecord


def _build_event_key(record: NormalizedRecord) -> str:
    metadata = record.metadata or {}
    components = [
        record.source.lower().strip(),
        (record.source_id or "").strip().lower(),
        str(metadata.get("event_type") or metadata.get("sub_event_type") or metadata.get("series_id") or "").strip().lower(),
        str(metadata.get("country") or metadata.get("admin1") or metadata.get("region") or record.location or "").strip().lower(),
        str(metadata.get("actor1") or metadata.get("actor") or "").strip().lower(),
        str(metadata.get("date") or record.timestamp.date().isoformat()).strip().lower(),
    ]
    return "|".join(components)


def enrich_record(record: NormalizedRecord) -> NormalizedRecord:
    metadata = record.metadata or {}
    text = record.text.strip() if record.text else ""
    semantic_text = build_semantic_text(metadata, fallback_text=text)
    category = record.category or str(metadata.get("event_type") or metadata.get("series_id") or "").strip() or None
    country = record.country or str(metadata.get("country") or metadata.get("location") or "").strip() or None
    region = record.region or str(metadata.get("region") or metadata.get("admin1") or "").strip() or None
    entities = list(record.entities)
    for key in ("country", "countries", "actor1", "actor", "event_type", "sub_event_type", "series_id"):
        value = metadata.get(key)
        if isinstance(value, list):
            entities.extend(str(item).strip() for item in value if str(item).strip())
        elif value is not None and str(value).strip():
            entities.append(str(value).strip())

    deduped_entities = list(dict.fromkeys(entity for entity in entities if entity))

    return record.model_copy(
        update={
            "text": semantic_text or text,
            "event_key": record.event_key or _build_event_key(record),
            "category": category,
            "country": country,
            "region": region,
            "entities": deduped_entities,
        }
    )


def enrich_records(records: list[NormalizedRecord]) -> list[NormalizedRecord]:
    return [enrich_record(record) for record in records]
