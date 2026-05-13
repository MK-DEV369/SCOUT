"""
API request/response schemas and data models for SCOUT backend.
"""

from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class EntityExplanation(BaseModel):
    """Explanation data for individual entity extraction."""
    entity_text: str
    entity_type: str
    confidence: float
    source_method: str  # "spacy_ner" or "domain_dict"
    position_in_text: int


class TopAlternative(BaseModel):
    """Top alternative prediction for classification."""
    label: str
    score: float


class ClassificationExplanation(BaseModel):
    """Explanation data for event classification."""
    predicted_category: str
    confidence: float
    prediction_method: str  # "distilbert", "keyword_fallback"
    top_3_alternatives: List[TopAlternative]
    triggering_keywords: List[str]  # Keywords that influenced the decision


class EventExplainability(BaseModel):
    """Complete explainability payload for event data."""
    
    # Entity extraction explanation
    entities: List[EntityExplanation]
    entity_extraction_confidence: float
    
    # Classification explanation
    classification: ClassificationExplanation
    
    # Summarization explanation
    summarizer_method: str  # "mistral" or "extractive"
    summarizer_confidence: float
    
    # Source credibility
    source_url: str
    source_outlet: str
    source_credibility: float
