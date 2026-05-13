from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from zipfile import ZipFile

import aiofiles
import httpx

from app.ingestion.connectors.base import SourceConnector, SOURCE_CREDIBILITY
from app.ingestion.parsers.gdelt_parser import GDELTSnapshot, GDELTParser
from app.ingestion.schema import NormalizedRecord


class GDELTConnector(SourceConnector):
    """Streaming GDELT 2.0 ZIP ingestion engine."""

    name = "gdelt"
    raw_dir = Path("backend/data/gdelt/raw")
    latest_update_url = "http://data.gdeltproject.org/gdeltv2/lastupdate.txt"

    def __init__(self) -> None:
        self.parser = GDELTParser(self.raw_dir)

    async def fetch_latest_update_urls(self) -> GDELTSnapshot:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(self.latest_update_url)
            response.raise_for_status()
            content = response.text.splitlines()

        snapshot = GDELTSnapshot()
        for line in content:
            parts = line.strip().split()
            if len(parts) < 3:
                continue
            url = parts[2]
            if url.endswith(".export.CSV.zip"):
                snapshot.export_zip = self.raw_dir / Path(url).name
            elif url.endswith(".mentions.CSV.zip"):
                snapshot.mentions_zip = self.raw_dir / Path(url).name
            elif url.endswith(".gkg.csv.zip"):
                snapshot.gkg_zip = self.raw_dir / Path(url).name
        return snapshot

    async def download_zip(self, url: str, dest: Path) -> Path:
        dest.parent.mkdir(parents=True, exist_ok=True)
        async with httpx.AsyncClient(timeout=120) as client:
            async with client.stream("GET", url) as response:
                response.raise_for_status()
                async with aiofiles.open(dest, "wb") as handle:
                    async for chunk in response.aiter_bytes():
                        await handle.write(chunk)
        return dest

    def extract_zip(self, zip_path: Path) -> list[Path]:
        extracted: list[Path] = []
        with ZipFile(zip_path) as archive:
            for member in archive.namelist():
                if not member.lower().endswith(".csv"):
                    continue
                extracted_path = zip_path.with_suffix("") / Path(member).name
                extracted_path.parent.mkdir(parents=True, exist_ok=True)
                with archive.open(member) as source, extracted_path.open("wb") as target:
                    target.write(source.read())
                extracted.append(extracted_path)
        return extracted

    async def process_export_csv(self) -> list[NormalizedRecord]:
        snapshot = await self.fetch_latest_update_urls()
        return self.parser.parse(snapshot)

    async def process_gkg_csv(self) -> list[NormalizedRecord]:
        snapshot = await self.fetch_latest_update_urls()
        return self.parser.parse(snapshot)

    def build_record(self, **kwargs: Any) -> NormalizedRecord:
        return NormalizedRecord.with_defaults(**kwargs)

    async def fetch(self) -> list[NormalizedRecord]:
        snapshot = await self.fetch_latest_update_urls()
        urls = {
            "export": f"http://data.gdeltproject.org/gdeltv2/{snapshot.export_zip.name}" if snapshot.export_zip else None,
            "mentions": f"http://data.gdeltproject.org/gdeltv2/{snapshot.mentions_zip.name}" if snapshot.mentions_zip else None,
            "gkg": f"http://data.gdeltproject.org/gdeltv2/{snapshot.gkg_zip.name}" if snapshot.gkg_zip else None,
        }

        downloaded: list[Path] = []
        try:
            for url in filter(None, urls.values()):
                dest = self.raw_dir / Path(url).name
                downloaded.append(await self.download_zip(url, dest))

            parsed_snapshot = GDELTSnapshot(
                export_zip=snapshot.export_zip if snapshot.export_zip and snapshot.export_zip.exists() else downloaded[0] if downloaded else None,
                mentions_zip=snapshot.mentions_zip if snapshot.mentions_zip and snapshot.mentions_zip.exists() else downloaded[1] if len(downloaded) > 1 else None,
                gkg_zip=snapshot.gkg_zip if snapshot.gkg_zip and snapshot.gkg_zip.exists() else downloaded[-1] if downloaded else None,
            )
            records = self.parser.parse(parsed_snapshot)
            return records
        finally:
            for path in downloaded:
                try:
                    path.unlink(missing_ok=True)
                except Exception:
                    pass
