from difflib import SequenceMatcher
from functools import lru_cache
import re

import spacy
from spacy.language import Language

from app.core.config import settings
from app.nlp.schemas import EntityWithConfidence, ExtractedEntities

COUNTRY_SET = {
    "germany",
    "france",
    "india",
    "china",
    "usa",
    "united states",
    "uk",
    "japan",
    "brazil",
    "singapore",
}

PORT_SET = {
    "hamburg",
    "rotterdam",
    "shanghai",
    "singapore port",
    "los angeles port",
    "long beach",
    "felixstowe",
}

COMMODITY_SET = {
    "crude oil",
    "wheat",
    "maize",
    "corn",
    "lithium",
    "copper",
    "steel",
    "lng",
}

MANUFACTURER_HINTS = {
    "manufacturer",
    "factory",
    "plant",
    "assembly",
    "production",
    "producer",
    "supplier",
}

TRANSPORT_MODE_SET = {
    "air",
    "sea",
    "rail",
    "road",
    "ocean",
    "truck",
    "ship",
    "vessel",
    "container",
}

CONFLICT_ACTOR_SET = {
    "military",
    "rebels",
    "government",
    "protesters",
    "police",
    "army",
    "militia",
}


@lru_cache(maxsize=1)
def get_nlp() -> Language:
    try:
        return spacy.load(settings.spacy_model)
    except Exception:  # noqa: BLE001
        return spacy.blank("en")


def _normalize(values: list[EntityWithConfidence]) -> list[EntityWithConfidence]:
    seen = set()
    out = []
    for value in values:
        item = value.text.strip()
        if not item:
            continue
        key = item.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(value)
    return out


def _similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def _best_match(value: str, candidates: set[str], min_ratio: float = 0.7) -> tuple[str, float]:
    value_clean = value.strip().lower()
    best_candidate = ""
    best_score = 0.0
    for candidate in candidates:
        score = _similarity(value_clean, candidate.lower())
        if score > best_score:
            best_score = score
            best_candidate = candidate
    if best_score >= min_ratio:
        return best_candidate, best_score
    return "", 0.0


def _text_fuzzy_confidence(text: str, candidate: str, min_ratio: float = 0.75) -> float:
    tokens = text.split()
    candidate_tokens = candidate.split()
    if not candidate_tokens:
        return 0.0

    best_score = 0.0
    window_size = len(candidate_tokens)
    for i in range(len(tokens) - window_size + 1):
        segment = " ".join(tokens[i : i + window_size])
        score = _similarity(segment.lower(), candidate.lower())
        best_score = max(best_score, score)
    return best_score if best_score >= min_ratio else 0.0


def extract_entities(text: str) -> ExtractedEntities:
    doc = get_nlp()(text)

    companies = []
    manufacturers = []
    countries = []
    ports = []
    commodities = []
    transport_modes = []
    conflict_actors = []

    for ent in doc.ents:
        if ent.label_ == "ORG":
            companies.append(EntityWithConfidence(text=ent.text, confidence=1.0))

            if any(hint in ent.text.lower() for hint in MANUFACTURER_HINTS):
                manufacturers.append(EntityWithConfidence(text=ent.text, confidence=0.85))

        if ent.label_ in {"GPE", "LOC"}:
            country_match, country_score = _best_match(ent.text, COUNTRY_SET, min_ratio=0.75)
            if country_score > 0:
                countries.append(EntityWithConfidence(text=country_match.title(), confidence=country_score))

            port_match, port_score = _best_match(ent.text, PORT_SET, min_ratio=0.7)
            if port_score > 0:
                ports.append(EntityWithConfidence(text=port_match.title(), confidence=port_score))

    text_lower = text.lower()
    for name in COUNTRY_SET:
        if re.search(rf"\\b{re.escape(name)}\\b", text_lower):
            countries.append(EntityWithConfidence(text=name.title(), confidence=1.0))
        else:
            fuzzy_score = _text_fuzzy_confidence(text_lower, name, min_ratio=0.85)
            if fuzzy_score > 0:
                countries.append(EntityWithConfidence(text=name.title(), confidence=fuzzy_score))

    for name in PORT_SET:
        if re.search(rf"\b{re.escape(name)}\b", text_lower):
            ports.append(EntityWithConfidence(text=name.title(), confidence=1.0))
        else:
            fuzzy_score = _text_fuzzy_confidence(text_lower, name, min_ratio=0.8)
            if fuzzy_score > 0:
                ports.append(EntityWithConfidence(text=name.title(), confidence=fuzzy_score))

    for name in COMMODITY_SET:
        if re.search(rf"\b{re.escape(name)}\b", text_lower):
            commodities.append(EntityWithConfidence(text=name.title(), confidence=1.0))
        else:
            fuzzy_score = _text_fuzzy_confidence(text_lower, name, min_ratio=0.78)
            if fuzzy_score > 0:
                commodities.append(EntityWithConfidence(text=name.title(), confidence=fuzzy_score))

    for name in TRANSPORT_MODE_SET:
        if re.search(rf"\b{re.escape(name)}\b", text_lower):
            transport_modes.append(EntityWithConfidence(text=name.title(), confidence=1.0))

    for name in CONFLICT_ACTOR_SET:
        if re.search(rf"\b{re.escape(name)}\b", text_lower):
            conflict_actors.append(EntityWithConfidence(text=name.title(), confidence=1.0))

    return ExtractedEntities(
        companies=_normalize(companies),
        manufacturers=_normalize(manufacturers),
        countries=_normalize(countries),
        ports=_normalize(ports),
        commodities=_normalize(commodities),
        transport_modes=_normalize(transport_modes),
        conflict_actors=_normalize(conflict_actors),
    )
