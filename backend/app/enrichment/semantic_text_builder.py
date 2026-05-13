from typing import Any


def _pick(metadata: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = metadata.get(key)
        if value is not None and str(value).strip():
            return str(value).strip()
    return ""


def build_semantic_text(metadata: dict[str, Any], fallback_text: str = "") -> str:
    event_type = _pick(metadata, "event_type", "sub_event_type", "disorder_type")
    country = _pick(metadata, "country", "admin1", "region", "location")
    actor = _pick(metadata, "actor1", "actor")
    fatalities = _pick(metadata, "fatalities", "fatality_count")
    notes = _pick(metadata, "notes", "description")
    series_id = _pick(metadata, "series_id")
    value = _pick(metadata, "value")
    date = _pick(metadata, "date")

    parts: list[str] = []
    if actor:
        parts.append(actor)
    if event_type:
        parts.append(f"involved in {event_type}")
    if country:
        parts.append(f"in {country}")
    if fatalities:
        parts.append(f"causing {fatalities} fatalities")

    sentence = " ".join(parts).strip()

    if not sentence and series_id and value:
        sentence = f"Macroeconomic signal {series_id} has value {value}"
        if date:
            sentence += f" at {date}"

    if notes:
        sentence = f"{sentence}. {notes}" if sentence else notes

    if not sentence:
        sentence = (fallback_text or "").strip()

    return sentence.strip()
