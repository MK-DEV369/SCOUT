from abc import ABC, abstractmethod

from app.ingestion.schema import NormalizedRecord


class SourceConnector(ABC):
    name: str
    supports_streaming: bool = False
    supports_batch: bool = True
    source_type: str = "structured"

    @abstractmethod
    async def fetch(self) -> list[NormalizedRecord]:
        raise NotImplementedError
