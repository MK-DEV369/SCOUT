from fastapi import APIRouter
import torch

from app.ml.models import get_distilbert_bundle, get_mistral_bundle, get_runtime_device, gpu_available

router = APIRouter(prefix="/ml", tags=["ml"])


@router.get("/status")
def ml_status() -> dict[str, str]:
    return {
        "distilbert": "configured",
        "mistral": "configured",
        "runtime_device": get_runtime_device(),
        "cuda_available": str(gpu_available()),
        "cuda_version": str(torch.version.cuda),
    }


@router.post("/load")
def load_models() -> dict[str, str]:
    distilbert = get_distilbert_bundle()
    mistral = get_mistral_bundle()
    return {
        "distilbert": distilbert["model_id"],
        "mistral": mistral["model_id"],
        "device": mistral["device"],
    }
