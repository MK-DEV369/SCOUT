from datetime import datetime
import logging

from app.core.config import settings
from app.ml.models import get_distilbert_bundle, get_mistral_bundle
from app.nlp.event_classifier import get_classifier, get_classifier_info

logger = logging.getLogger(__name__)

_state = {
    "distilbert": None,
    "mistral": None,
    "classifier_loaded": False,
    "classifier_model": None,
    "classifier_last_loaded": None,
    "provider_status": {},
    "last_failure": None,
    "fallback_count": 0,
    "average_latency_ms": 0.0,
    "inference_count": 0,
}


def _provider_entry() -> dict:
    return {
        "healthy": False,
        "loaded": False,
        "attempts": 0,
        "success_count": 0,
        "failure_count": 0,
        "fallback_count": 0,
        "last_latency_ms": None,
        "average_latency_ms": 0.0,
        "last_error": None,
        "last_used_at": None,
    }


def _ensure_provider_entry(provider: str) -> dict:
    provider_status = _state.setdefault("provider_status", {})
    if provider not in provider_status:
        provider_status[provider] = _provider_entry()
    return provider_status[provider]


def record_inference_result(provider: str, latency_ms: float, success: bool, fallback_used: bool = False, error: str | None = None) -> None:
    entry = _ensure_provider_entry(provider)
    entry["attempts"] += 1
    entry["last_latency_ms"] = float(latency_ms)
    entry["last_used_at"] = datetime.utcnow()
    entry["average_latency_ms"] = ((entry["average_latency_ms"] * (entry["attempts"] - 1)) + float(latency_ms)) / entry["attempts"]

    if fallback_used:
        entry["fallback_count"] += 1
        _state["fallback_count"] += 1

    if success:
        entry["success_count"] += 1
        entry["healthy"] = True
        entry["loaded"] = True
        entry["last_error"] = None
    else:
        entry["failure_count"] += 1
        entry["healthy"] = False
        entry["last_error"] = error
        _state["last_failure"] = {
            "provider": provider,
            "error": error,
            "at": datetime.utcnow(),
        }

    _state["inference_count"] += 1
    previous_count = _state["inference_count"] - 1
    _state["average_latency_ms"] = ((float(_state["average_latency_ms"]) * previous_count) + float(latency_ms)) / _state["inference_count"]


def load_models() -> dict:
    """Load ML models into memory and record timestamps."""
    try:
        _state["distilbert"] = get_distilbert_bundle()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to load distilbert: %s", exc)

    if getattr(settings, "load_mistral_on_startup", False):
        try:
            _state["mistral"] = get_mistral_bundle()
        except Exception as exc:  # noqa: BLE001
            logger.exception("Failed to load mistral: %s", exc)
    else:
        _state["mistral"] = None

    try:
        # force classifier pipeline creation
        get_classifier()
        info = get_classifier_info()
        _state["classifier_loaded"] = True
        _state["classifier_model"] = info.get("model_id")
        _state["classifier_last_loaded"] = datetime.utcnow()
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to load classifier: %s", exc)
        _state["classifier_loaded"] = False

    return dict(_state)


def get_status() -> dict:
    return {
        "classifier_loaded": _state.get("classifier_loaded", False),
        "classifier_model": _state.get("classifier_model"),
        "classifier_last_loaded": _state.get("classifier_last_loaded"),
        "provider_status": _state.get("provider_status", {}),
        "last_failure": _state.get("last_failure"),
        "fallback_count": _state.get("fallback_count", 0),
        "average_latency_ms": _state.get("average_latency_ms", 0.0),
        "inference_count": _state.get("inference_count", 0),
    }
