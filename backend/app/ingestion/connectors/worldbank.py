from datetime import datetime, timezone

import httpx

from app.core.config import settings
from app.ingestion.connectors.base import SourceConnector, SOURCE_CREDIBILITY
from app.ingestion.schema import NormalizedRecord


class WorldBankConnector(SourceConnector):
    name = "worldbank"

    INDICATOR_CATEGORIES = {
        "CM.MKT.CRUD.WTI": "energy",
        "CM.MKT.NGAS.US": "energy",
        "CM.MKT.COAL.AUS": "energy",
        "CM.MKT.WHEA.US": "food",
        "CM.MKT.MAIZ.CB": "food",
        "CM.MKT.RICE.05": "food",
        "NE.EXP.GNFS.ZS": "trade",
        "NE.IMP.GNFS.ZS": "trade",
        "FP.CPI.TOTL.ZG": "economic_stress",
        "NY.GDP.MKTP.KD.ZG": "economic_stress",
    }

    @staticmethod
    def _indicator_label(indicator: str) -> str:
        labels = {
            "CM.MKT.CRUD.WTI": "crude oil",
            "CM.MKT.NGAS.US": "natural gas",
            "CM.MKT.COAL.AUS": "coal",
            "CM.MKT.WHEA.US": "wheat",
            "CM.MKT.MAIZ.CB": "maize",
            "CM.MKT.RICE.05": "rice",
            "NE.EXP.GNFS.ZS": "exports",
            "NE.IMP.GNFS.ZS": "imports",
            "FP.CPI.TOTL.ZG": "inflation",
            "NY.GDP.MKTP.KD.ZG": "GDP growth",
        }
        return labels.get(indicator, indicator)

    def _infer_category(self, indicator: str) -> str:
        return self.INDICATOR_CATEGORIES.get(indicator, "macro")

    @staticmethod
    def _infer_trend(latest: float, previous: float | None) -> str:
        if previous is None:
            return "stable"
        if latest > previous:
            return "rising"
        if latest < previous:
            return "falling"
        return "stable"

    @staticmethod
    def _infer_severity(latest: float, previous: float | None) -> str:
        if previous is None:
            return "medium"

        baseline = abs(previous) if previous != 0 else 1.0
        change_pct = abs(latest - previous) / baseline
        if change_pct >= 0.05:
            return "high"
        if change_pct >= 0.02:
            return "medium"
        return "low"

    def _build_semantic_text(
        self,
        *,
        indicator: str,
        value: float,
        date: str,
        category: str,
        trend: str,
    ) -> str:
        label = self._indicator_label(indicator)

        if indicator == "FP.CPI.TOTL.ZG":
            return f"Global inflation pressure is {trend} at {value}% in {date}, signaling rising economic stress."

        if indicator == "NY.GDP.MKTP.KD.ZG":
            return f"Global GDP growth is {trend} at {value}% in {date}, indicating broader economic momentum."

        if category == "energy":
            return f"Global {label} prices are {trend} at {value} in {date}, affecting freight and production costs."

        if category == "food":
            return f"Global {label} prices are {trend} at {value} in {date}, increasing food supply pressure."

        if category == "trade":
            return f"Global trade indicator {label} is {trend} at {value} in {date}, reflecting cross-border demand conditions."

        return f"Economic indicator {label} recorded {value} in {date}, indicating macroeconomic pressure."

    async def fetch(self) -> list[NormalizedRecord]:
        indicators = [
            "CM.MKT.CRUD.WTI",
            "CM.MKT.NGAS.US",
            "CM.MKT.COAL.AUS",
            "CM.MKT.WHEA.US",
            "CM.MKT.MAIZ.CB",
            "CM.MKT.RICE.05",
            "NE.EXP.GNFS.ZS",
            "NE.IMP.GNFS.ZS",
            "FP.CPI.TOTL.ZG",
            "NY.GDP.MKTP.KD.ZG",
        ]
        records: list[NormalizedRecord] = []

        async with httpx.AsyncClient(timeout=20) as client:
            for indicator in indicators:
                url = f"{settings.world_bank_base_url}/country/WLD/indicator/{indicator}"
                response = await client.get(url, params={"format": "json", "per_page": 5})
                response.raise_for_status()
                payload = response.json()
                points = payload[1] if isinstance(payload, list) and len(payload) > 1 else []

                latest_point = points[0] if points else None
                previous_point = points[1] if len(points) > 1 else None
                latest_value_raw = latest_point.get("value") if latest_point else None
                previous_value_raw = previous_point.get("value") if previous_point else None
                if latest_value_raw in (None, "."):
                    continue

                try:
                    latest_value = float(latest_value_raw)
                except (TypeError, ValueError):
                    continue

                previous_value = None
                if previous_value_raw not in (None, "."):
                    try:
                        previous_value = float(previous_value_raw)
                    except (TypeError, ValueError):
                        previous_value = None

                latest_date = latest_point.get("date") if latest_point else None
                if not latest_date:
                    continue

                category = self._infer_category(indicator)
                trend = self._infer_trend(latest_value, previous_value)
                severity = self._infer_severity(latest_value, previous_value)

                try:
                    timestamp = datetime(int(latest_date), 1, 1, tzinfo=timezone.utc)
                except ValueError:
                    timestamp = datetime.now(timezone.utc)

                records.append(
                    NormalizedRecord.with_defaults(
                        source=self.name,
                        source_id=f"{indicator}:{latest_date}",
                        text=self._build_semantic_text(
                            indicator=indicator,
                            value=latest_value,
                            date=latest_date,
                            category=category,
                            trend=trend,
                        ),
                        timestamp=timestamp,
                        location="Global",
                        country="Global",
                        region="Global",
                        category=category,
                        event_key=f"worldbank:{indicator}:{latest_date}",
                        source_credibility=SOURCE_CREDIBILITY.get(self.name, 0.95),
                        source_url=f"{settings.world_bank_base_url}/country/WLD/indicator/{indicator}",
                        source_outlet="World Bank",
                        metadata={
                            "indicator": indicator,
                            "indicator_label": self._indicator_label(indicator),
                            "value": latest_value,
                            "date": latest_date,
                            "category": category,
                            "trend": trend,
                            "severity": severity,
                            "source_kind": "worldbank_indicator",
                        },
                    )
                )

        return records
