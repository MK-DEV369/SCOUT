from __future__ import annotations

import csv
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from zipfile import ZipFile

from app.ingestion.schema import NormalizedRecord


KEYWORDS = (
    "supply chain",
    "shipping",
    "port",
    "commodity",
    "semiconductor",
    "logistics",
    "trade",
    "freight",
    "tariff",
)


@dataclass(slots=True)
class GDELTSnapshot:
    export_zip: Path | None = None
    mentions_zip: Path | None = None
    gkg_zip: Path | None = None


class GDELTParser:
    def __init__(self, raw_dir: Path) -> None:
        self.raw_dir = raw_dir

    @staticmethod
    def _matches(text: str) -> bool:
        lowered = text.lower()
        return any(keyword in lowered for keyword in KEYWORDS)

    @staticmethod
    def _semantic_text(row: dict[str, str], gkg_row: dict[str, str] | None = None) -> str:
        themes = (gkg_row or {}).get("V2Themes", "") or (gkg_row or {}).get("themes", "")
        organizations = (gkg_row or {}).get("V2Organizations", "") or (gkg_row or {}).get("organizations", "")
        locations = (gkg_row or {}).get("V2Locations", "") or (gkg_row or {}).get("locations", "")
        tone = (gkg_row or {}).get("V2Tone", "") or (gkg_row or {}).get("tone", "")
        title = row.get("SOURCEURL") or row.get("sourceurl") or row.get("V2SOURCEURL") or ""
        snippet = row.get("V2ENHANCED" ) or row.get("v2enhanced") or row.get("V2TEXT") or row.get("V2DOCUMENTIDENTIFIER") or ""

        parts: list[str] = []
        if themes:
            parts.append(f"Themes indicate {themes}")
        if organizations:
            parts.append(f"Organizations involved: {organizations}")
        if locations:
            parts.append(f"Locations: {locations}")
        if tone:
            parts.append(f"Sentiment/tone: {tone}")
        if title:
            parts.append(f"Source: {title}")
        if snippet:
            parts.append(str(snippet))
        return ". ".join(part for part in parts if part).strip()

    @staticmethod
    def _row_to_dict(headers: list[str], row: list[str]) -> dict[str, str]:
        return {headers[idx]: value for idx, value in enumerate(row) if idx < len(headers)}

    def _stream_zip_csv(self, zip_path: Path) -> tuple[list[str], list[dict[str, str]]]:
        headers: list[str] = []
        rows: list[dict[str, str]] = []
        with ZipFile(zip_path) as archive:
            csv_names = [name for name in archive.namelist() if name.lower().endswith(".csv")]
            if not csv_names:
                return headers, rows
            with archive.open(csv_names[0]) as handle:
                text_stream = (line.decode("utf-8", errors="ignore") for line in handle)
                reader = csv.reader(text_stream)
                try:
                    headers = [column.strip() for column in next(reader)]
                except StopIteration:
                    return headers, rows
                for raw_row in reader:
                    row = self._row_to_dict(headers, raw_row)
                    if row:
                        rows.append(row)
        return headers, rows

    def _build_record(self, *, source: str, source_id: str, text: str, timestamp: str, metadata: dict[str, Any]) -> NormalizedRecord:
        return NormalizedRecord.with_defaults(
            source=source,
            source_id=source_id,
            text=text,
            timestamp=timestamp,
            location=metadata.get("location") or metadata.get("sourcecountry") or metadata.get("country"),
            country=metadata.get("country") or metadata.get("sourcecountry"),
            region=metadata.get("region") or metadata.get("adm1code") or metadata.get("admin1"),
            category="geopolitical",
            event_key=source_id,
            metadata=metadata,
        )

    def parse(self, snapshot: GDELTSnapshot) -> list[NormalizedRecord]:
        records: list[NormalizedRecord] = []

        export_rows: list[dict[str, str]] = []
        gkg_rows: list[dict[str, str]] = []

        if snapshot.export_zip and snapshot.export_zip.exists():
            _, export_rows = self._stream_zip_csv(snapshot.export_zip)
        if snapshot.gkg_zip and snapshot.gkg_zip.exists():
            _, gkg_rows = self._stream_zip_csv(snapshot.gkg_zip)

        gkg_by_id = {
            (row.get("GLOBALEVENTID") or row.get("globaleventid") or row.get("EventID") or "").strip(): row
            for row in gkg_rows
            if (row.get("GLOBALEVENTID") or row.get("globaleventid") or row.get("EventID") or "").strip()
        }

        for row in export_rows:
            article_text = " ".join(
                [
                    row.get("V2Tone", ""),
                    row.get("Actor1Name", ""),
                    row.get("Actor2Name", ""),
                    row.get("ActionGeo_FullName", ""),
                    row.get("SOURCEURL", ""),
                ]
            ).strip()
            if not article_text or not self._matches(article_text):
                continue

            source_id = row.get("GLOBALEVENTID") or row.get("GlobalEventID") or row.get("eventid") or row.get("SOURCEURL") or "gdelt"
            timestamp = row.get("Day") or row.get("SQLDATE") or row.get("DATE") or ""
            gkg_row = gkg_by_id.get(str(source_id).strip())
            semantic_text = self._semantic_text(row, gkg_row)
            if not semantic_text:
                semantic_text = article_text

            metadata = {
                "source_file": snapshot.export_zip.name if snapshot.export_zip else None,
                "source_type": "gdelt_export",
                "themes": (gkg_row or {}).get("V2Themes") if gkg_row else None,
                "organizations": (gkg_row or {}).get("V2Organizations") if gkg_row else None,
                "locations": (gkg_row or {}).get("V2Locations") if gkg_row else None,
                "tone": (gkg_row or {}).get("V2Tone") if gkg_row else None,
                "actor1": row.get("Actor1Name"),
                "actor2": row.get("Actor2Name"),
                "eventcode": row.get("EventCode"),
                "goldstein": row.get("GoldsteinScale"),
                "source_url": row.get("SOURCEURL"),
            }

            records.append(
                self._build_record(
                    source="gdelt",
                    source_id=str(source_id),
                    text=semantic_text,
                    timestamp=timestamp,
                    metadata=metadata,
                )
            )

        return records
