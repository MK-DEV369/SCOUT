from fastapi import APIRouter, Depends, HTTPException
import logging
import torch
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.db.models import EventRecord, EventEmbedding

from app.ml.models import (
    DISTILBERT_MODEL_ID,
    MISTRAL_MODEL_ID,
    get_cuda_memory_info,
    get_distilbert_bundle,
    get_mistral_bundle,
    get_runtime_device,
    gpu_available,
)
from app.ml.router import choose_best_provider, get_provider_health
from app.nlp.event_classifier import get_classifier_info
from app.ml.manager import get_status
from app.nlp.clustering import compute_and_store_embeddings, run_cluster_analysis

router = APIRouter(prefix="/ml", tags=["ml"])

logger = logging.getLogger(__name__)


@router.get("/status")
def ml_status() -> dict[str, str]:
    clf_info = get_classifier_info()
    cuda_info = get_cuda_memory_info()
    return {
        "distilbert_model": DISTILBERT_MODEL_ID,
        "mistral_model": MISTRAL_MODEL_ID,
        "runtime_device": get_runtime_device(),
        "cuda_available": str(gpu_available()),
        "cuda_version": str(torch.version.cuda),
        "cuda_free_mb": str(cuda_info["free_mb"] if cuda_info else None),
        "cuda_total_mb": str(cuda_info["total_mb"] if cuda_info else None),
        "preferred_provider": choose_best_provider().value,
        "provider_health": get_provider_health(),
        "classifier_model": clf_info.get("model_id"),
        "classifier_device": clf_info.get("device"),
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


@router.get("/health")
def ml_health() -> dict:
    status = get_status()
    return {
        "classifier_loaded": status.get("classifier_loaded", False),
        "classifier_model": status.get("classifier_model"),
        "classifier_last_loaded": status.get("classifier_last_loaded"),
        "provider_status": status.get("provider_status", {}),
        "last_failure": status.get("last_failure"),
        "fallback_count": status.get("fallback_count", 0),
        "average_latency_ms": status.get("average_latency_ms", 0.0),
        "inference_count": status.get("inference_count", 0),
    }


@router.post("/cluster/run")
def cluster_run(limit: int = 500, n_clusters: int = 3, min_cluster_size: int | None = None) -> dict:
    effective_cluster_size = min_cluster_size if min_cluster_size is not None else n_clusters
    logger.info("Cluster run requested limit=%s effective_cluster_size=%s", limit, effective_cluster_size)
    stored = compute_and_store_embeddings(limit=limit)
    clustered = run_cluster_analysis(min_cluster_size=effective_cluster_size)
    logger.info("Cluster run completed embeddings_stored=%s clustered=%s", stored, clustered)
    return {"embeddings_stored": stored, "clustered": clustered}


@router.get("/events/export")
def export_events(limit: int = 1000, db: Session = Depends(get_db)) -> list[dict]:
    rows = db.query(EventRecord).order_by(EventRecord.timestamp.desc()).limit(limit).all()
    return [
        {
            "event_id": r.id,
            "summary": r.summary,
            "category": r.category,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
            "severity": r.severity,
        }
        for r in rows
    ]


@router.post("/clusters/save")
def save_clusters(payload: list[dict], db: Session = Depends(get_db)) -> dict:
    if not isinstance(payload, list):
        raise HTTPException(status_code=400, detail="payload must be a list of {event_id, cluster_id}")
    saved = 0
    for item in payload:
        event_id = item.get("event_id")
        cluster_id = item.get("cluster_id")
        if event_id is None or cluster_id is None:
            continue
        emb = db.query(EventEmbedding).filter(EventEmbedding.event_id == event_id).one_or_none()
        if emb:
            emb.cluster_id = str(cluster_id)
        else:
            db.add(EventEmbedding(event_id=event_id, embedding={}, cluster_id=str(cluster_id)))
        saved += 1
    db.commit()
    return {"saved": saved}
