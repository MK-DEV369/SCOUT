from abc import ABC, abstractmethod

from app.ingestion.schema import NormalizedRecord


# Define source credibility scores (0.0-1.0)
SOURCE_CREDIBILITY = {
    "gdelt": 0.70,           # Curated event database
    "newsapi": 0.65,         # News aggregator (lower due to bias)
    "worldbank": 0.95,       # Official economic data
    "acled": 0.90,           # Curated conflict data
    "fred": 0.95,            # Official economic indicators
    "freightos": 0.80,       # Shipping data provider
    "google_news": 0.60      # News feed (varies by outlet)
}


class SourceConnector(ABC):
    name: str
    supports_streaming: bool = False
    supports_batch: bool = True
    source_type: str = "structured"

    @abstractmethod
    async def fetch(self) -> list[NormalizedRecord]:
        raise NotImplementedError
