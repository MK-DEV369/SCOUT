"""FRED ingestion for the project.

This connector uses only the FRED v2 `fred/series/observations` endpoint to
retrieve a small set of macroeconomic series used by the risk pipeline.
"""

from datetime import datetime, timezone

import httpx

from app.core.config import settings
from app.ingestion.connectors.base import SourceConnector, SOURCE_CREDIBILITY
from app.ingestion.schema import NormalizedRecord

class FREDConnector(SourceConnector):
    name = "fred"
    series_ids = ("CPIAUCSL", "UNRATE", "FEDFUNDS")

    @staticmethod
    def _indicator_type(series_id: str) -> str:
        mapping = {
            "CPIAUCSL": "inflation",
            "UNRATE": "unemployment",
            "FEDFUNDS": "interest_rate",
        }
        return mapping.get(series_id, "economic_indicator")

    def _build_semantic_text(self, *, series_id: str, value: str, date: str) -> str:
        try:
            numeric_value = float(value)
        except Exception:
            numeric_value = value

        if series_id == "CPIAUCSL":
            return (
                f"US inflation index reached {numeric_value} on {date}, "
                "indicating inflationary economic pressure."
            )

        if series_id == "UNRATE":
            return (
                f"US unemployment rate recorded {numeric_value}% on {date}, "
                "reflecting labor market conditions."
            )

        if series_id == "FEDFUNDS":
            return (
                f"US Federal Reserve interest rate reached {numeric_value}% on {date}, "
                "impacting borrowing costs and economic activity."
            )

        return f"Economic indicator {series_id} recorded value {numeric_value} on {date}."

    async def _fetch_observations(
        self,
        client: httpx.AsyncClient,
        series_id: str,
    ) -> list[NormalizedRecord]:
        response = await client.get(
            "https://api.stlouisfed.org/fred/series/observations",
            params={
                "series_id": series_id,
                "api_key": settings.fred_api_key,
                "file_type": "json",
                "limit": 10,
                "sort_order": "desc",
            },
        )
        response.raise_for_status()
        payload = response.json()

        records: list[NormalizedRecord] = []
        for obs in payload.get("observations", []):
            value = obs.get("value")
            date = obs.get("date")
            if not date or value in (None, "."):
                continue

            try:
                timestamp = datetime.strptime(date, "%Y-%m-%d").replace(tzinfo=timezone.utc)
            except ValueError:
                timestamp = datetime.now(timezone.utc)

            indicator_type = self._indicator_type(series_id)
            records.append(
                NormalizedRecord.with_defaults(
                    source=self.name,
                    source_id=f"{series_id}:{date}",
                    text=self._build_semantic_text(series_id=series_id, value=value, date=date),
                    timestamp=timestamp,
                    location="US",
                    country="US",
                    region="North America",
                    category="economic",
                    event_key=f"fred:{series_id}:{date}",
                    source_credibility=SOURCE_CREDIBILITY.get(self.name, 0.95),
                    source_url="https://fred.stlouisfed.org",
                    source_outlet="Federal Reserve Economic Data (FRED)",
                    metadata={
                        "series_id": series_id,
                        "value": value,
                        "date": date,
                        "indicator_type": indicator_type,
                        "source_kind": "macroeconomic_context",
                    },
                )
            )

        return records

    async def fetch(self) -> list[NormalizedRecord]:
        if not settings.fred_api_key:
            raise RuntimeError("FRED_API_KEY is not configured")

        records: list[NormalizedRecord] = []

        async with httpx.AsyncClient(timeout=20) as client:
            for series_id in self.series_ids:
                records.extend(await self._fetch_observations(client, series_id))

        return records
