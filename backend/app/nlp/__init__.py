"""NLP pipeline module for entity extraction, classification, summarization, and clustering."""

from app.nlp.pipeline import build_structured_events
from app.nlp.embeddings import embed_text
from app.nlp.clustering import compute_and_store_embeddings, run_cluster_analysis
from app.nlp.entity_extractor import extract_entities
from app.nlp.event_classifier import classify_event
from app.nlp.summarizer import summarize_as_bullets

__all__ = [
    "build_structured_events",
    "embed_text",
    "compute_and_store_embeddings",
    "run_cluster_analysis",
    "extract_entities",
    "classify_event",
    "summarize_as_bullets",
]
