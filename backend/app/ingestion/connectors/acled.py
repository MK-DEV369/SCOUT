from datetime import datetime, timezone

import httpx

from app.ingestion.connectors.base import SourceConnector
from app.ingestion.schema import NormalizedRecord


class ACLEDConnector(SourceConnector):
    name = "acled"

    async def fetch(self) -> list[NormalizedRecord]:
        params = {"limit": 100, "event_date_where": ">=", "event_date": "2025-01-01"}
        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get("https://api.acleddata.com/acled/read", params=params)
            if response.status_code >= 400:
                return []
            payload = response.json()

        records: list[NormalizedRecord] = []
        for event in payload.get("data", []):
            event_date = event.get("event_date")
            timestamp = datetime.now(timezone.utc)
            if event_date:
                try:
                    timestamp = datetime.strptime(event_date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
                except ValueError:
                    pass

            text = " ".join(
                [
                    event.get("event_type") or "",
                    event.get("sub_event_type") or "",
                    event.get("notes") or "",
                ]
            ).strip()
            if not text:
                continue

            records.append(
                NormalizedRecord.with_defaults(
                    source=self.name,
                    source_id=event.get("event_id_cnty"),
                    text=text,
                    timestamp=timestamp,
                    location=event.get("location") or event.get("country"),
                    metadata=event,
                )
            )
        return records
