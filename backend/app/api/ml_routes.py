from fastapi import APIRouter
import torch

from app.ml.models import (
    DISTILBERT_MODEL_ID,
    MISTRAL_MODEL_ID,
    get_distilbert_bundle,
    get_mistral_bundle,
    get_runtime_device,
    gpu_available,
)

router = APIRouter(prefix="/ml", tags=["ml"])


@router.get("/status")
def ml_status() -> dict[str, str]:
    return {
        "distilbert_model": DISTILBERT_MODEL_ID,
        "mistral_model": MISTRAL_MODEL_ID,
        "runtime_device": get_runtime_device(),
        "cuda_available": str(gpu_available()),
        "cuda_version": str(torch.version.cuda),
    }


@router.post("/load")
def load_models() -> dict[str, str]:
    distilbert_result = {"model": DISTILBERT_MODEL_ID, "loaded": False, "device": get_runtime_device()}
    mistral_result = {"model": MISTRAL_MODEL_ID, "loaded": False, "device": get_runtime_device()}

    try:
        distilbert = get_distilbert_bundle()
        distilbert_result.update({"model": distilbert["model_id"], "loaded": True, "device": distilbert["device"]})
    except Exception as exc:  # noqa: BLE001
        distilbert_result["error"] = str(exc)

    try:
        mistral = get_mistral_bundle()
        mistral_result.update({"model": mistral["model_id"], "loaded": True, "device": mistral["device"]})
    except Exception as exc:  # noqa: BLE001
        mistral_result["error"] = str(exc)

    return {
        "distilbert": distilbert_result,
        "mistral": mistral_result,
    }
