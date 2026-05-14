from datetime import datetime, timezone
import logging
from typing import List

import numpy as np
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler

from app.db.session import SessionLocal
from app.db.models import EventRecord, EventEmbedding
from app.nlp.embeddings import embed_text

logger = logging.getLogger(__name__)

try:
    import hdbscan  # type: ignore
except Exception:  # noqa: BLE001
    hdbscan = None


def _recency_weight(timestamp: datetime) -> float:
    now = datetime.now(timezone.utc)
    age_days = max((now - timestamp.astimezone(timezone.utc)).total_seconds() / 86400.0, 0.0)
    return float(np.exp(-age_days / 14.0))


def _event_text(record: EventRecord) -> str:
    if isinstance(record.summary, str) and record.summary.strip():
        return record.summary.strip()
    metadata_summary = record.metadata_json.get("semantic_text") if isinstance(record.metadata_json, dict) else None
    if isinstance(metadata_summary, str) and metadata_summary.strip():
        return metadata_summary.strip()
    category = record.category.strip() if isinstance(record.category, str) else ""
    return " ".join(part for part in [category, record.source] if part).strip()


def compute_and_store_embeddings(limit: int = 500) -> int:
    """Compute embeddings for recent events and store/update EventEmbedding rows."""
    stored = 0
    with SessionLocal() as db:
        records = db.query(EventRecord).order_by(EventRecord.timestamp.desc()).limit(limit).all()
        logger.info("Computing embeddings for %s recent events", len(records))
        for rec in records:
            content = _event_text(rec)
            if not content:
                logger.info("Skipping event %s because no text was available for embedding", rec.id)
                continue

            emb = embed_text(content)
            if not emb:
                logger.info("Skipping event %s because embedding generation returned no vector", rec.id)
                continue

            logger.info("Embedding size for event %s: %s", rec.id, len(emb))
            existing = db.query(EventEmbedding).filter(EventEmbedding.event_id == rec.id).first()
            if existing:
                existing.embedding = {"vector": emb}
                logger.debug("Updated existing embedding for event_id=%s", rec.id)
            else:
                ee = EventEmbedding(event_id=rec.id, embedding={"vector": emb})
                db.add(ee)
                logger.debug("Created new embedding row for event_id=%s", rec.id)
            stored += 1
        db.commit()
    logger.info("Embedding computation complete stored=%s", stored)
    return stored


def run_cluster_analysis(min_cluster_size: int = 3) -> int:
    """Run density-based clustering on stored embeddings and update cluster_id on EventEmbedding."""
    with SessionLocal() as db:
        rows = db.query(EventEmbedding).join(EventRecord, EventRecord.id == EventEmbedding.event_id).all()
        vectors = []
        ids = []
        logger.info("Loaded %s embeddings for clustering", len(rows))
        for r in rows:
            vec = r.embedding.get("vector") if isinstance(r.embedding, dict) else None
            if not isinstance(vec, list) or not vec:
                continue

            try:
                numeric_vec = [float(value) for value in vec]
            except (TypeError, ValueError):
                logger.info("Skipping embedding %s because the vector was not numeric", r.id)
                continue

            event = db.query(EventRecord).filter(EventRecord.id == r.event_id).first()
            if not event:
                continue
            recency = _recency_weight(event.timestamp)
            weighted_vector = [value * (0.75 + 0.25 * recency) for value in numeric_vec]
            weighted_vector.append(recency)
            vectors.append(weighted_vector)
            ids.append(r.id)

        if not vectors:
            logger.info("No valid vectors available for clustering")
            return 0

        if len(vectors) < 2:
            logger.info("Not enough embeddings to cluster: %s", len(vectors))
            return 0

        effective_min_cluster_size = max(2, min(int(min_cluster_size), len(vectors)))
        logger.info("Clustering %s vectors with min_cluster_size=%s", len(vectors), effective_min_cluster_size)

        X = StandardScaler().fit_transform(np.array(vectors))
        if hdbscan is not None:
            clusterer = hdbscan.HDBSCAN(min_cluster_size=effective_min_cluster_size, metric="euclidean")
            labels = clusterer.fit_predict(X)
        else:
            # Conservative fallback when HDBSCAN is unavailable.
            clusterer = DBSCAN(eps=0.75, min_samples=effective_min_cluster_size, metric="euclidean")
            labels = clusterer.fit_predict(X)

        logger.info("Clustering finished with %s labels", len(labels))

        for idx, label in zip(ids, labels):
            cluster_id = None if int(label) < 0 else f"cluster_{int(label)}"
            db.query(EventEmbedding).filter(EventEmbedding.id == idx).update({"cluster_id": cluster_id})
            logger.debug("Assigned cluster_id=%s to embedding_id=%s", cluster_id, idx)
        db.commit()
        return int(len(labels))
