from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


class NormalizedRecord(BaseModel):
    source: str
    timestamp: datetime
    text: str = Field(min_length=1)
    location: str | None = None
    source_id: str | None = None

    country: str | None = None
    region: str | None = None
    category: str | None = None

    entities: list[str] = Field(default_factory=list)
    relationships: list[dict[str, Any]] = Field(default_factory=list)
    sentiment: str | None = None
    severity_score: float | None = None
    embedding: list[float] | None = None
    summary: str | None = None

    risk_score: float | None = None
    event_key: str | None = None

    source_credibility: float = 0.5  # 0.0-1.0, default 0.5
    source_url: str | None = None  # Direct link to original article/report
    source_outlet: str | None = None  # e.g., "BBC", "Reuters", "World Bank"

    metadata: dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def with_defaults(
        cls,
        *,
        source: str,
        text: str,
        timestamp: datetime | None = None,
        location: str | None = None,
        country: str | None = None,
        region: str | None = None,
        category: str | None = None,
        metadata: dict[str, Any] | None = None,
        source_id: str | None = None,
        event_key: str | None = None,
        entities: list[str] | None = None,
        relationships: list[dict[str, Any]] | None = None,
        sentiment: str | None = None,
        severity_score: float | None = None,
        embedding: list[float] | None = None,
        summary: str | None = None,
        risk_score: float | None = None,
        source_credibility: float | None = None,
        source_url: str | None = None,
        source_outlet: str | None = None,
    ) -> "NormalizedRecord":
        ts = timestamp or datetime.now(timezone.utc)
        return cls(
            source=source,
            timestamp=ts,
            source_id=source_id,
            text=text.strip(),
            location=location,
            country=country,
            region=region,
            category=category,
            entities=entities or [],
            relationships=relationships or [],
            sentiment=sentiment,
            severity_score=severity_score,
            embedding=embedding,
            summary=summary,
            risk_score=risk_score,
            event_key=event_key,
            source_credibility=source_credibility or 0.5,
            source_url=source_url,
            source_outlet=source_outlet,
            metadata=metadata or {},
        )
