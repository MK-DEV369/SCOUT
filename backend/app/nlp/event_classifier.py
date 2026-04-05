from functools import lru_cache
from pathlib import Path

import torch
from transformers import pipeline

from app.core.config import settings

EVENT_LABELS = ["Geopolitical", "Logistics", "Environmental", "Economic"]

KEYWORDS = {
    "Geopolitical": ["war", "sanction", "conflict", "military", "embargo"],
    "Logistics": ["port strike", "delay", "shipment", "congestion", "freight"],
    "Environmental": ["flood", "storm", "hurricane", "drought", "wildfire"],
    "Economic": ["inflation", "price spike", "interest rate", "gdp", "recession"],
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


def classify_event(text: str) -> tuple[str, float]:
    text_lower = text.lower()
    for label, words in KEYWORDS.items():
        if any(word in text_lower for word in words):
            return label, 0.75

    clf = get_classifier()
    result = clf(text[:1024])[0]
    score = float(result.get("score", 0.5))

    # Fallback mapping when generic sentiment model is used before custom fine-tune artifacts exist.
    mapped = "Economic" if result.get("label") == "NEGATIVE" else "Logistics"
    return mapped, score
