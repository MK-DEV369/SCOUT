import hashlib
from datetime import timezone

from app.ingestion.schema import NormalizedRecord


def _metadata_value(item: NormalizedRecord, *keys: str) -> str:
    payload = item.metadata or {}
    for key in keys:
        value = payload.get(key)
        if value is not None and str(value).strip():
            return str(value).strip().lower()
    return ""


def _event_fingerprint(item: NormalizedRecord) -> str:
    if item.event_key:
        return item.event_key.strip().lower()

    parts = [
        _metadata_value(item, "event_type", "sub_event_type", "disorder_type"),
        (item.country or _metadata_value(item, "country", "admin1", "region", "location")),
        (item.region or _metadata_value(item, "region")),
        _metadata_value(item, "actor1", "actor"),
        _metadata_value(item, "fatalities", "fatality_count", "value"),
        (item.category or "").strip().lower(),
    ]
    return "|".join(parts)


def compute_content_hash(item: NormalizedRecord) -> str:
    ts = item.timestamp.astimezone(timezone.utc).isoformat()
    event_fingerprint = _event_fingerprint(item)
    stable = "|".join(
        [
            item.source.lower().strip(),
            (item.source_id or "").strip(),
            ts,
            event_fingerprint,
            (item.location or "").strip().lower(),
        ]
    )
    return hashlib.sha256(stable.encode("utf-8")).hexdigest()
