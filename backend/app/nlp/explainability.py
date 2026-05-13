"""
Explainability module for generating explanation data for NLP outputs.
Provides functions to explain entity extraction, classification, and summarization decisions.
"""

from typing import List, Dict, Any
from backend.app.api.schemas import (
    EntityExplanation,
    ClassificationExplanation,
    TopAlternative,
    EventExplainability
)


def generate_event_explanation(event_record) -> dict:
    """
    Generate explainability data for an event record.
    
    Args:
        event_record: Database event record with NLP outputs and confidence scores
        
    Returns:
        Dictionary containing complete explainability data for frontend
    """
    
    # Parse stored entities
    entities_data = event_record.entities_json or []
    entities_explanation = [
        EntityExplanation(
            entity_text=ent['text'],
            entity_type=ent['type'],
            confidence=ent.get('confidence', 0.8),
            source_method=ent.get('source', 'spacy_ner'),
            position_in_text=ent.get('position', 0)
        )
        for ent in entities_data
    ]
    
    # Explain classification decision
    alternatives = event_record.classifier_alternatives or []
    triggering_keywords = extract_keywords_for_category(
        event_record.text,
        event_record.category
    )
    
    # Parse alternatives into proper format
    top_alternatives = [
        TopAlternative(label=alt.get('label', alt), score=alt.get('score', 0.0))
        for alt in alternatives
    ]
    
    classification_exp = ClassificationExplanation(
        predicted_category=event_record.category,
        confidence=event_record.classifier_confidence,
        prediction_method=event_record.classifier_method or "distilbert",
        top_3_alternatives=top_alternatives,
        triggering_keywords=triggering_keywords
    )
    
    # Combine into complete explainability payload
    explainability = EventExplainability(
        entities=entities_explanation,
        entity_extraction_confidence=event_record.entity_extraction_confidence or 0.85,
        classification=classification_exp,
        summarizer_method=event_record.summarizer_method or "mistral",
        summarizer_confidence=event_record.summarizer_confidence or 0.80,
        source_url=event_record.source_url or "",
        source_outlet=event_record.source_outlet or "",
        source_credibility=event_record.source_credibility or 0.75
    )
    
    return explainability.model_dump()


def extract_keywords_for_category(text: str, category: str) -> List[str]:
    """
    Extract keywords that triggered this category classification.
    
    Args:
        text: Event description text
        category: Predicted event category
        
    Returns:
        List of up to 3 keywords that influenced the classification
    """
    
    keywords_by_category = {
        "Geopolitical": ["war", "sanction", "conflict", "military", "embargo", "tension", "coup", "attack"],
        "Logistics": ["port", "strike", "delay", "shipment", "congestion", "freight", "cargo", "vessel"],
        "Environmental": ["flood", "storm", "hurricane", "drought", "wildfire", "earthquake", "cyclone"],
        "Economic": ["inflation", "price", "interest", "gdp", "recession", "tariff", "market", "trade"],
        "Social": ["protest", "riot", "demonstration", "unrest", "civil", "labor", "strike"],
        "Pandemic": ["outbreak", "epidemic", "disease", "virus", "infection", "pandemic", "health"],
    }
    
    text_lower = text.lower()
    keywords = keywords_by_category.get(category, [])
    
    # Find keywords present in text
    found = [kw for kw in keywords if kw in text_lower]
    
    # Return top 3 keywords
    return found[:3]
