from functools import lru_cache

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
    # Fine-tuned DistilBERT can be loaded by setting EVENT_CLASSIFIER_MODEL to a local/remote model id.
    device = 0 if torch.cuda.is_available() else -1
    return pipeline(
        task="text-classification",
        model=settings.event_classifier_model,
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
