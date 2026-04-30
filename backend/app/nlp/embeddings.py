from functools import lru_cache
from typing import List

import torch
from sentence_transformers import SentenceTransformer

from app.core.config import settings


@lru_cache(maxsize=1)
def get_embedding_model() -> SentenceTransformer:
    """Load and cache the SentenceTransformer model.

    Uses `settings.embedding_model` if present; defaults to all-mpnet-base-v2.
    """
    model_id = getattr(settings, "embedding_model", "sentence-transformers/all-mpnet-base-v2")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    return SentenceTransformer(model_id, device=device)


def embed_text(text: str) -> List[float]:
    """Return a single embedding vector for the provided text as a list of floats."""
    model = get_embedding_model()
    if not text:
        return []
    # keep a sane max length (characters) to avoid very long inputs
    snippet = text[:2000]
    emb = model.encode(snippet, convert_to_numpy=True)
    try:
        return emb.tolist()
    except Exception:
        return [float(x) for x in emb]
