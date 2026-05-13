from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from app.ingestion.connectors.base import SourceConnector
from app.ingestion.schema import NormalizedRecord


class ACLEDConnector(SourceConnector):
    name = "acled"
    DATA_DIR = Path("backend/data/acled")

    async def fetch(self) -> list[NormalizedRecord]:
        records: list[NormalizedRecord] = []
        excel_files = sorted(self.DATA_DIR.glob("*.xlsx"))

        for file_path in excel_files:
            try:
                df = pd.read_excel(file_path)
                df.columns = [str(c).strip().lower() for c in df.columns]

                for idx, row in df.iterrows():
                    country = self._safe_get(row, ["country", "admin1", "region", "location"])
                    event_type = self._safe_get(row, ["event_type", "sub_event_type", "disorder_type"])
                    actor1 = self._safe_get(row, ["actor1", "actor"])
                    fatalities = self._safe_get(row, ["fatalities", "fatality_count"])
                    notes = self._safe_get(row, ["notes", "description"])
                    event_date = self._safe_get(row, ["event_date", "date"])

                    timestamp = datetime.now(timezone.utc)
                    if event_date:
                        try:
                            parsed = pd.to_datetime(event_date).to_pydatetime()
                            timestamp = parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
                        except Exception:
                            pass

                    text = self._build_semantic_text(
                        actor1=actor1,
                        event_type=event_type,
                        country=country,
                        fatalities=fatalities,
                        notes=notes,
                    )
                    if not text.strip():
                        continue

                    records.append(
                        NormalizedRecord.with_defaults(
                            source=self.name,
                            source_id=f"{file_path.stem}_{idx}",
                            text=text,
                            timestamp=timestamp,
                            location=country or None,
                            metadata={
                                "source_file": file_path.name,
                                "country": country,
                                "event_type": event_type,
                                "actor1": actor1,
                                "fatalities": fatalities,
                                "notes": notes,
                            },
                        )
                    )
            except Exception as exc:
                print(f"[ACLED] Failed processing {file_path}: {exc}")

        return records

    def _safe_get(self, row: pd.Series, keys: list[str]) -> str:
        for key in keys:
            if key in row and pd.notna(row[key]):
                return str(row[key]).strip()
        return ""

    def _build_semantic_text(
        self,
        *,
        actor1: str,
        event_type: str,
        country: str,
        fatalities: str,
        notes: str,
    ) -> str:
        parts: list[str] = []
        if actor1:
            parts.append(actor1)
        if event_type:
            parts.append(f"involved in {event_type}")
        if country:
            parts.append(f"in {country}")
        if fatalities:
            parts.append(f"causing {fatalities} fatalities")

        sentence = " ".join(parts).strip()
        if notes:
            sentence = f"{sentence}. {notes}" if sentence else notes
        return sentence.strip()
