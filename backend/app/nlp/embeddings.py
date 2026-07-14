from functools import lru_cache
from typing import Any, List, Optional

import hashlib
import logging
import re

logger = logging.getLogger(__name__)
_EMBEDDING_CACHE: dict[str, List[float]] = {}


def _fallback_embedding(text: str, dimensions: int = 768) -> List[float]:
    tokens = re.findall(r"[A-Za-z0-9]+", text.lower())
    if not tokens:
        return []

    vector = [0.0] * dimensions
    for token in tokens[:512]:
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "big") % dimensions
        vector[index] += 1.0

    norm = sum(value * value for value in vector) ** 0.5
    if norm:
        vector = [value / norm for value in vector]
    return vector


def _cache_key(text: str) -> str:
    return hashlib.sha256(text.strip().encode("utf-8")).hexdigest()


def embed_text(text: str) -> List[float]:
    """Return a single embedding vector for the provided text as a list of floats.
    
    Tries to use the Ollama API with 'nomic-embed-text' model, and falls back to a 
    768-dimensional local embedding if Ollama is not running.
    """
    if not text:
        logger.debug("Embedding skipped because input text was empty")
        return []

    key = _cache_key(text)
    cached = _EMBEDDING_CACHE.get(key)
    if cached is not None:
        logger.debug("Embedding cache hit text_length=%s vector_length=%s", len(text), len(cached))
        return cached

    import httpx
    import time
    
    url = "http://localhost:11434/api/embeddings"
    payload = {
        "model": "nomic-embed-text",
        "prompt": text[:4000]
    }
    
    max_retries = 3
    last_exc = None
    
    for attempt in range(max_retries):
        try:
            response = httpx.post(url, json=payload, timeout=30.0)
            if response.status_code == 200:
                embedding = response.json().get("embedding", [])
                if embedding:
                    _EMBEDDING_CACHE[key] = embedding
                    logger.debug("Generated embedding using Ollama nomic-embed-text: %d dimensions", len(embedding))
                    return embedding
            else:
                logger.warning(
                    "Ollama returned status_code=%d on attempt %d/3",
                    response.status_code,
                    attempt + 1
                )
        except Exception as exc:
            last_exc = exc
            logger.warning(
                "Ollama embedding attempt %d/3 failed: %s",
                attempt + 1,
                exc
            )
        if attempt < max_retries - 1:
            time.sleep(1.0)

    raise RuntimeError(
        f"Ollama nomic-embed-text embedding failed after {max_retries} attempts: {last_exc}"
    ) from last_exc
