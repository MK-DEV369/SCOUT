from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.models import RawIngestionRecord, UnifiedRecord
from app.ingestion.connectors.acled import ACLEDConnector
from app.ingestion.connectors.base import SourceConnector
from app.ingestion.connectors.fred import FREDConnector
from app.ingestion.connectors.freightos import FreightosConnector
from app.ingestion.connectors.gdelt import GDELTConnector
from app.ingestion.connectors.newsapi import NewsAPIConnector
from app.ingestion.connectors.worldbank import WorldBankConnector
from app.ingestion.dedup import compute_content_hash
from app.ingestion.schema import NormalizedRecord


class IngestionService:
    def __init__(self) -> None:
        self.connectors: list[SourceConnector] = [
            GDELTConnector(),
            NewsAPIConnector(),
            WorldBankConnector(),
            ACLEDConnector(),
            FREDConnector(),
        ]
        if settings.enable_freightos:
            self.connectors.append(FreightosConnector())

    async def collect(self) -> list[NormalizedRecord]:
        records: list[NormalizedRecord] = []
        for connector in self.connectors:
            try:
                data = await connector.fetch()
                records.extend(data)
            except Exception as exc:  # noqa: BLE001
                records.append(
                    NormalizedRecord.with_defaults(
                        source=connector.name,
                        text=f"connector_error:{connector.name}",
                        metadata={"error": str(exc)},
                        location=None,
                    )
                )
        return records

    def _exists_hash(self, db: Session, hash_value: str) -> bool:
        raw_exists = db.execute(
            select(RawIngestionRecord.id).where(RawIngestionRecord.content_hash == hash_value)
        ).first()
        if raw_exists:
            return True
        unified_exists = db.execute(
            select(UnifiedRecord.id).where(UnifiedRecord.content_hash == hash_value)
        ).first()
        return bool(unified_exists)

    def save(self, db: Session, records: Iterable[NormalizedRecord]) -> dict[str, int]:
        inserted = 0
        duplicates = 0

        for item in records:
            hash_value = compute_content_hash(item)
            if self._exists_hash(db, hash_value):
                duplicates += 1
                continue

            raw = RawIngestionRecord(
                source=item.source,
                source_id=item.source_id,
                timestamp=item.timestamp,
                text=item.text,
                location=item.location,
                metadata_json=item.metadata,
                content_hash=hash_value,
            )
            normalized = UnifiedRecord(
                source=item.source,
                timestamp=item.timestamp,
                text=item.text,
                location=item.location,
                metadata_json=item.metadata,
                content_hash=hash_value,
            )
            db.add(raw)
            db.add(normalized)
            inserted += 1

        db.commit()
        return {"inserted": inserted, "duplicates": duplicates}


ingestion_service = IngestionService()
