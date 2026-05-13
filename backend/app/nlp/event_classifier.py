from functools import lru_cache
from pathlib import Path
import re

import torch
from transformers import pipeline

from app.core.config import settings

EVENT_LABELS = [
    "conflict",
    "sanctions",
    "logistics_delay",
    "labor_disruption",
    "commodity_spike",
    "weather",
    "cyberattack",
    "political_instability",
    "infrastructure_failure",
    "economic_stress",
]

KEYWORDS = {
    "conflict": ["war", "conflict", "military", "attack", "shelling", "crossfire"],
    "sanctions": ["sanction", "embargo", "export ban", "trade restriction"],
    "logistics_delay": ["port", "shipment delay", "congestion", "freight", "backlog", "delay"],
    "labor_disruption": ["strike", "walkout", "union", "picket", "labor action"],
    "commodity_spike": ["oil spike", "price spike", "commodity surge", "crude", "lng", "wheat", "copper"],
    "weather": ["flood", "storm", "hurricane", "drought", "wildfire", "typhoon", "heatwave"],
    "cyberattack": ["ransomware", "cyberattack", "malware", "breach", "hack"],
    "political_instability": ["protest", "election", "coup", "unrest", "riot"],
    "infrastructure_failure": ["bridge collapse", "pipeline leak", "power outage", "derailment", "collapse"],
    "economic_stress": ["inflation", "recession", "gdp", "interest rate", "debt", "cpi"],
}

LABEL_ALIASES = {
    "geopolitical": "conflict",
    "logistics": "logistics_delay",
    "environmental": "weather",
    "economic": "economic_stress",
}

SOURCE_MIN_CONFIDENCE = {
    "acled": 0.6,
    "gdelt": 0.75,
    "newsapi": 0.8,
    "google_news": 0.8,
}

CATEGORY_DIMENSIONS = {
    "conflict": ["supplier", "transport", "geopolitical"],
    "sanctions": ["supplier", "commodity", "trade"],
    "logistics_delay": ["transport", "supplier"],
    "labor_disruption": ["supplier", "transport"],
    "commodity_spike": ["commodity", "supplier"],
    "weather": ["transport", "supplier"],
    "cyberattack": ["supplier", "infrastructure"],
    "political_instability": ["supplier", "geopolitical"],
    "infrastructure_failure": ["transport", "infrastructure"],
    "economic_stress": ["commodity", "supplier", "macro"],
}

CATEGORY_SUBTYPE = {
    "conflict": "armed_conflict",
    "sanctions": "sanctions",
    "logistics_delay": "shipping_delay",
    "labor_disruption": "labor_strike",
    "commodity_spike": "commodity_spike",
    "weather": "weather_event",
    "cyberattack": "ransomware",
    "political_instability": "political_instability",
    "infrastructure_failure": "infrastructure_failure",
    "economic_stress": "macro_stress",
}

CATEGORY_RULES = {
    "conflict": {
        "armed conflict": 1.2,
        "crossfire": 1.1,
        "shelling": 1.1,
        "missile": 1.2,
        "attack": 0.9,
        "war": 1.0,
        "military": 0.8,
    },
    "sanctions": {
        "sanction": 1.2,
        "embargo": 1.2,
        "export ban": 1.15,
        "trade restriction": 1.1,
    },
    "logistics_delay": {
        "port congestion": 1.25,
        "congestion": 0.95,
        "delay": 0.7,
        "shipment delay": 1.15,
        "backlog": 1.0,
        "shipment": 0.6,
        "freight": 0.65,
    },
    "labor_disruption": {
        "strike": 1.2,
        "walkout": 1.1,
        "union": 0.9,
        "labor action": 1.15,
        "picket": 0.95,
    },
    "commodity_spike": {
        "price spike": 1.2,
        "commodity surge": 1.15,
        "oil spike": 1.2,
        "crude": 0.9,
        "lng": 0.95,
        "wheat": 0.85,
        "copper": 0.85,
    },
    "weather": {
        "flood": 1.15,
        "storm": 1.0,
        "hurricane": 1.2,
        "drought": 1.1,
        "wildfire": 1.15,
        "typhoon": 1.15,
        "heatwave": 0.95,
    },
    "cyberattack": {
        "ransomware": 1.25,
        "cyberattack": 1.25,
        "malware": 1.05,
        "breach": 0.9,
        "hack": 0.85,
    },
    "political_instability": {
        "protest": 1.0,
        "election": 0.8,
        "coup": 1.2,
        "unrest": 1.1,
        "riot": 1.1,
    },
    "infrastructure_failure": {
        "bridge collapse": 1.25,
        "pipeline leak": 1.15,
        "power outage": 1.1,
        "derailment": 1.15,
        "collapse": 0.95,
    },
    "economic_stress": {
        "inflation": 1.15,
        "recession": 1.15,
        "gdp": 0.75,
        "interest rate": 1.0,
        "debt": 0.85,
        "cpi": 0.95,
    },
}


@lru_cache(maxsize=1)
def get_classifier():
    # Prefer a local fine-tuned DistilBERT artifact if one has been trained and saved.
    local_artifact = Path(__file__).resolve().parents[1] / "training" / "artifacts" / "event_classifier"
    model_id = str(local_artifact) if local_artifact.exists() else settings.event_classifier_model
    device = 0 if torch.cuda.is_available() else -1
    return pipeline(
        task="text-classification",
        model=model_id,
        truncation=True,
        device=device,
    )


def get_classifier_info() -> dict[str, str]:
    """Return basic classifier metadata: model id and device."""
    local_artifact = Path(__file__).resolve().parents[1] / "training" / "artifacts" / "event_classifier"
    model_id = str(local_artifact) if local_artifact.exists() else settings.event_classifier_model
    device = "cuda" if torch.cuda.is_available() else "cpu"
    return {"model_id": model_id, "device": device}


def _normalize_label(label: str) -> str:
    normalized = label.strip().lower().replace(" ", "_")
    return LABEL_ALIASES.get(normalized, normalized)


def _source_floor(source: str | None) -> float:
    if not source:
        return 0.7
    return SOURCE_MIN_CONFIDENCE.get(source.lower(), 0.7)


def _score_categories(text_lower: str) -> tuple[dict[str, float], list[str]]:
    scores: dict[str, float] = {label: 0.0 for label in EVENT_LABELS}
    triggered: list[str] = []

    for category, rules in CATEGORY_RULES.items():
        category_score = 0.0
        for pattern, weight in rules.items():
            if re.search(rf"\b{re.escape(pattern)}\b", text_lower):
                category_score += weight
                triggered.append(pattern)
        scores[category] = category_score

    unique_triggered = list(dict.fromkeys(triggered))
    return scores, unique_triggered


def _infer_criticality(score: float, source: str | None) -> str:
    floor = _source_floor(source)
    adjusted = score if score >= floor else score * 0.9
    if adjusted >= 1.8:
        return "critical"
    if adjusted >= 1.2:
        return "high"
    if adjusted >= 0.8:
        return "medium"
    return "low"


def _model_supports_custom_labels(model_id: str) -> bool:
    return "event_classifier" in model_id or model_id.startswith("local")


def classify_event(text: str, source: str | None = None) -> dict[str, object]:
    text_lower = text.lower()

    category_scores, triggered = _score_categories(text_lower)
    primary_category = max(category_scores, key=category_scores.get)
    primary_score = category_scores[primary_category]

    source_floor = _source_floor(source)
    ranked = sorted(category_scores.items(), key=lambda item: item[1], reverse=True)
    secondary_categories = [label for label, score in ranked[1:4] if score >= max(source_floor * 0.7, 0.45)]
    secondary_categories = [label for label in secondary_categories if label != primary_category]

    if primary_score <= 0:
        primary_category = "economic_stress"
        primary_score = 0.35

    keywords_triggered = triggered or [primary_category.replace("_", " ")]
    subtype = CATEGORY_SUBTYPE.get(primary_category, primary_category)
    risk_dimension = CATEGORY_DIMENSIONS.get(primary_category, ["supplier"])
    criticality = _infer_criticality(primary_score, source)

    result: dict[str, object] = {
        "primary_category": primary_category,
        "secondary_categories": secondary_categories,
        "confidence": round(min(max(primary_score, 0.0), 1.0), 4),
        "severity": round(min(max(primary_score, 0.0), 1.0), 4),
        "keywords_triggered": keywords_triggered,
        "subtype": subtype,
        "risk_dimension": risk_dimension,
        "criticality": criticality,
        "strategy": "heuristic",
        "model_id": "heuristic",
    }

    local_artifact = Path(__file__).resolve().parents[1] / "training" / "artifacts" / "event_classifier"
    if local_artifact.exists():
        clf = get_classifier()
        model_result = clf(text[:1024])[0]
        model_score = float(model_result.get("score", 0.5))
        model_label = _normalize_label(str(model_result.get("label", "economic_stress")))
        if _model_supports_custom_labels(get_classifier_info()["model_id"]):
            if model_label in category_scores and model_score >= source_floor:
                primary_category = model_label
                result["primary_category"] = primary_category
                result["confidence"] = round(min(max(max(primary_score, model_score), 0.0), 1.0), 4)
                result["severity"] = result["confidence"]
                result["subtype"] = CATEGORY_SUBTYPE.get(primary_category, primary_category)
                result["risk_dimension"] = CATEGORY_DIMENSIONS.get(primary_category, ["supplier"])
                result["criticality"] = _infer_criticality(float(result["confidence"]), source)
                result["strategy"] = "hybrid"
                result["model_id"] = get_classifier_info()["model_id"]

                ranked = sorted(category_scores.items(), key=lambda item: item[1], reverse=True)
                secondary_categories = [label for label, score in ranked[1:4] if score >= max(source_floor * 0.7, 0.45)]
                secondary_categories = [label for label in secondary_categories if label != primary_category]
                result["secondary_categories"] = secondary_categories

    return result
