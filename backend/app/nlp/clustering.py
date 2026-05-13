from datetime import datetime, timezone
from typing import List
import logging

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


def compute_and_store_embeddings(limit: int = 500) -> int:
    """Compute embeddings for recent events and store/update EventEmbedding rows."""
    stored = 0
    with SessionLocal() as db:
        records = db.query(EventRecord).order_by(EventRecord.timestamp.desc()).limit(limit).all()
        for rec in records:
            emb = embed_text(rec.summary or rec.text)
            if not emb:
                continue
            existing = db.query(EventEmbedding).filter(EventEmbedding.event_id == rec.id).first()
            if existing:
                existing.embedding = {"vector": emb}
            else:
                ee = EventEmbedding(event_id=rec.id, embedding={"vector": emb})
                db.add(ee)
            stored += 1
        db.commit()
    return stored


def run_cluster_analysis(min_cluster_size: int = 3) -> int:
    """Run density-based clustering on stored embeddings and update cluster_id on EventEmbedding."""
    with SessionLocal() as db:
        rows = db.query(EventEmbedding).join(EventRecord, EventRecord.id == EventEmbedding.event_id).all()
        vectors = []
        ids = []
        for r in rows:
            vec = r.embedding.get("vector") if isinstance(r.embedding, dict) else None
            if vec:
                event = db.query(EventRecord).filter(EventRecord.id == r.event_id).first()
                if not event:
                    continue
                recency = _recency_weight(event.timestamp)
                weighted_vector = [float(value) * (0.75 + 0.25 * recency) for value in vec]
                weighted_vector.append(recency)
                vectors.append(weighted_vector)
                ids.append(r.id)

        if not vectors:
            return 0

        X = StandardScaler().fit_transform(np.array(vectors))
        if hdbscan is not None:
            clusterer = hdbscan.HDBSCAN(min_cluster_size=min_cluster_size, metric="euclidean")
            labels = clusterer.fit_predict(X)
        else:
            # Conservative fallback when HDBSCAN is unavailable.
            clusterer = DBSCAN(eps=0.75, min_samples=min_cluster_size, metric="euclidean")
            labels = clusterer.fit_predict(X)

        for idx, label in zip(ids, labels):
            cluster_id = None if int(label) < 0 else f"cluster_{int(label)}"
            db.query(EventEmbedding).filter(EventEmbedding.id == idx).update({"cluster_id": cluster_id})
        db.commit()
        return int(len(labels))
