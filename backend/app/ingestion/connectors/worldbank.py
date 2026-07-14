from datetime import datetime, timezone
import zipfile
import io
import pandas as pd
from pathlib import Path
import httpx

from app.core.config import settings
from app.ingestion.connectors.base import SourceConnector
from app.ingestion.schema import NormalizedRecord


class WorldBankConnector(SourceConnector):
    name = "worldbank"

    INDICATOR_CATEGORIES = {
        "NE.EXP.GNFS.ZS": "trade",
        "NE.IMP.GNFS.ZS": "trade",
        "FP.CPI.TOTL.ZG": "economic_stress",
        "NY.GDP.MKTP.KD.ZG": "economic_stress",
    }

    @staticmethod
    def _indicator_label(indicator: str) -> str:
        labels = {
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

        if category == "trade":
            return f"Global trade indicator {label} is {trend} at {value} in {date}, reflecting cross-border demand conditions."

        return f"Economic indicator {label} recorded {value} in {date}, indicating macroeconomic pressure."

    async def _fetch_single_indicator(
        self,
        client: httpx.AsyncClient,
        indicator: str,
        local_logger,
    ) -> list[NormalizedRecord]:
        url = f"{settings.world_bank_base_url}/country/WLD/indicator/{indicator}"
        response = await client.get(url, params={"format": "json", "per_page": 5})
        response.raise_for_status()
        payload = response.json()

        points = payload[1] if isinstance(payload, list) and len(payload) > 1 else []
        records: list[NormalizedRecord] = []

        # Find the first data point with a valid value
        latest_point = None
        previous_point = None
        for idx, pt in enumerate(points):
            val = pt.get("value")
            if val not in (None, "."):
                latest_point = pt
                if idx + 1 < len(points):
                    previous_point = points[idx + 1]
                break

        if not latest_point:
            return records

        latest_value_raw = latest_point.get("value")
        previous_value_raw = previous_point.get("value") if previous_point else None

        try:
            latest_value = float(latest_value_raw)
        except (TypeError, ValueError):
            return records

        previous_value = None
        if previous_value_raw not in (None, "."):
            try:
                previous_value = float(previous_value_raw)
            except (TypeError, ValueError):
                previous_value = None

        latest_date = latest_point.get("date")
        if not latest_date:
            return records

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

    def _fetch_local_records(self, local_logger) -> list[NormalizedRecord]:
        records: list[NormalizedRecord] = []
        try:
            wb_dir = Path(__file__).resolve().parents[3] / "data" / "worldbank"
            spi_path = wb_dir / "SPI_data.csv"
            
            country_map = {}
            code_map = {}
            
            if spi_path.exists():
                df_spi = pd.read_csv(spi_path)
                df_spi = df_spi.dropna(subset=['country'])
                df_spi = df_spi.sort_values('date')
                for _, row in df_spi.iterrows():
                    c_name = str(row['country']).strip()
                    c_code = str(row['iso3c']).strip()
                    lat = float(row['latitude']) if not pd.isna(row['latitude']) else None
                    lng = float(row['longitude']) if not pd.isna(row['longitude']) else None
                    pop = float(row['population']) if not pd.isna(row['population']) else None
                    reg = str(row['region']).strip() if not pd.isna(row['region']) else "Global"
                    
                    info = {
                        "country": c_name,
                        "code": c_code,
                        "lat": lat,
                        "lng": lng,
                        "population": pop,
                        "region": reg
                    }
                    country_map[c_name.lower()] = info
                    code_map[c_code.lower()] = info

            # GDP forecasts
            gep_zip = wb_dir / "GEP_CSV.zip"
            if gep_zip.exists():
                with zipfile.ZipFile(gep_zip) as z:
                    for name in z.namelist():
                        if name.endswith(".csv") and "GEPCSV" in name:
                            with z.open(name) as f:
                                df_gep = pd.read_csv(io.TextIOWrapper(f, encoding="utf-8"))
                                df_gdp = df_gep[df_gep['Indicator Code'] == 'NYGDPMKTPKDZ']
                                for _, row in df_gdp.iterrows():
                                    country_name = row.get('Country Name')
                                    country_code = row.get('Country Code')
                                    for year in ['2023', '2024', '2025', '2026']:
                                        val_raw = row.get(year)
                                        if val_raw is not None and not pd.isna(val_raw):
                                            try:
                                                val = float(val_raw)
                                            except (TypeError, ValueError):
                                                continue
                                            meta = code_map.get(str(country_code).lower()) or country_map.get(str(country_name).lower())
                                            lat = meta['lat'] if meta else None
                                            lng = meta['lng'] if meta else None
                                            pop = meta['population'] if meta else None
                                            region = meta['region'] if meta else "Global"
                                            
                                            text = f"GDP growth forecast for {country_name} in {year} is estimated at {val:.2f}% (local forecast index)."
                                            records.append(
                                                NormalizedRecord.with_defaults(
                                                    source=self.name,
                                                    source_id=f"worldbank_local:GDP_forecast:{country_code}:{year}",
                                                    text=text,
                                                    timestamp=datetime(int(year), 1, 1, tzinfo=timezone.utc),
                                                    location=country_name,
                                                    country=country_name,
                                                    region=region,
                                                    category="economic_stress",
                                                    event_key=f"worldbank_local:GDP_forecast:{country_code}:{year}",
                                                    metadata={
                                                        "indicator": "NYGDPMKTPKDZ",
                                                        "indicator_label": "GDP growth forecast",
                                                        "value": val,
                                                        "date": year,
                                                        "country": country_name,
                                                        "country_code": country_code,
                                                        "latitude": lat,
                                                        "longitude": lng,
                                                        "population": pop,
                                                        "source_kind": "worldbank_local_indicator",
                                                    }
                                                )
                                            )

            # Inflation and Unemployment
            gem_zip = wb_dir / "GemDataEXTR.zip"
            if gem_zip.exists():
                with zipfile.ZipFile(gem_zip) as z:
                    file_configs = [
                        {
                            "filename": "CPI Price, % y-o-y, nominal, seas. adj..xlsx",
                            "indicator": "CPI.PRICE.YOY.LOCAL",
                            "label": "Inflation rate (CPI % y-o-y)",
                            "prefix": "CPI_inflation",
                            "desc": "Inflation rate"
                        },
                        {
                            "filename": "Unemployment Rate, seas. adj..xlsx",
                            "indicator": "UNEMPLOYMENT.RATE.LOCAL",
                            "label": "Unemployment rate",
                            "prefix": "unemployment_rate",
                            "desc": "Unemployment rate"
                        }
                    ]
                    for config in file_configs:
                        fname = config["filename"]
                        if fname in z.namelist():
                            with z.open(fname) as f:
                                df_xl = pd.read_excel(io.BytesIO(f.read()))
                                df_xl = df_xl.rename(columns={df_xl.columns[0]: 'Year'})
                                df_xl = df_xl[df_xl['Year'].isin([2023, 2024, 2025, 2026])]
                                for _, row in df_xl.iterrows():
                                    try:
                                        year = int(row['Year'])
                                    except (TypeError, ValueError):
                                        continue
                                    for col in df_xl.columns[1:]:
                                        val_raw = row[col]
                                        if val_raw is not None and not pd.isna(val_raw):
                                            try:
                                                val = float(val_raw)
                                            except (TypeError, ValueError):
                                                continue
                                            country_name = str(col)
                                            meta = country_map.get(country_name.lower())
                                            lat = meta['lat'] if meta else None
                                            lng = meta['lng'] if meta else None
                                            pop = meta['population'] if meta else None
                                            region = meta['region'] if meta else "Global"
                                            code = meta['code'] if meta else None
                                            
                                            text = f"{config['desc']} in {country_name} for {year} is recorded at {val:.2f}% (local high-frequency index)."
                                            records.append(
                                                NormalizedRecord.with_defaults(
                                                    source=self.name,
                                                    source_id=f"worldbank_local:{config['prefix']}:{code or country_name}:{year}",
                                                    text=text,
                                                    timestamp=datetime(year, 1, 1, tzinfo=timezone.utc),
                                                    location=country_name,
                                                    country=country_name,
                                                    region=region,
                                                    category="economic_stress",
                                                    event_key=f"worldbank_local:{config['prefix']}:{code or country_name}:{year}",
                                                    metadata={
                                                        "indicator": config["indicator"],
                                                        "indicator_label": config["label"],
                                                        "value": val,
                                                        "date": str(year),
                                                        "country": country_name,
                                                        "country_code": code,
                                                        "latitude": lat,
                                                        "longitude": lng,
                                                        "population": pop,
                                                        "source_kind": "worldbank_local_indicator",
                                                    }
                                                )
                                            )
        except Exception as e:
            local_logger.exception("Failed to parse local World Bank datasets: %s", e)
        return records

    async def fetch(self) -> list[NormalizedRecord]:
        indicators = [
            "NE.EXP.GNFS.ZS",
            "NE.IMP.GNFS.ZS",
            "FP.CPI.TOTL.ZG",
            "NY.GDP.MKTP.KD.ZG",
        ]
        import logging
        import asyncio
        local_logger = logging.getLogger(__name__)
        records: list[NormalizedRecord] = []

        async with httpx.AsyncClient(timeout=60) as client:
            tasks = [
                self._fetch_single_indicator(client, indicator, local_logger)
                for indicator in indicators
            ]
            results = await asyncio.gather(*tasks)
            for res in results:
                records.extend(res)

        local_records = self._fetch_local_records(local_logger)
        records.extend(local_records)

        return records
