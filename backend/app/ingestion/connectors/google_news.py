from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from xml.etree import ElementTree

import httpx

from app.core.config import settings
from app.ingestion.connectors.base import SourceConnector, SOURCE_CREDIBILITY
from app.ingestion.schema import NormalizedRecord


import re

def clean_html(text: str) -> str:
    if not text:
        return ""
    # Strip HTML tags
    cleaned = re.sub(r"<[^>]*>", "", text)
    # Normalize whitespaces
    cleaned = re.sub(r"\s+", " ", cleaned)
    return cleaned.strip()


class GoogleNewsConnector(SourceConnector):
    name = "google_news"

    async def fetch(self) -> list[NormalizedRecord]:
        if not settings.enable_google_news:
            return []

        params = {
            "q": settings.google_news_query,
            "hl": settings.google_news_language,
            "gl": settings.google_news_country,
            "ceid": f"{settings.google_news_country}:{settings.google_news_language.split('-')[0]}",
        }

        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get("https://news.google.com/rss/search", params=params)
            response.raise_for_status()
            xml_payload = response.text

        root = ElementTree.fromstring(xml_payload)
        records: list[NormalizedRecord] = []

        for item in root.findall("./channel/item"):
            title = clean_html(item.findtext("title") or "")
            description = clean_html(item.findtext("description") or "")
            link = (item.findtext("link") or "").strip()
            source = (item.findtext("source") or "").strip() or None

            text = " ".join(part for part in [title, description] if part).strip()
            if not text:
                continue

            timestamp = datetime.now(timezone.utc)
            pub_date = item.findtext("pubDate")
            if pub_date:
                try:
                    timestamp = parsedate_to_datetime(pub_date).astimezone(timezone.utc)
                except (TypeError, ValueError):
                    pass

            records.append(
                NormalizedRecord.with_defaults(
                    source=self.name,
                    source_id=link or None,
                    text=text,
                    timestamp=timestamp,
                    location=source,
                    metadata={
                        "link": link or None,
                        "source": source,
                        "url": link,
                        "source_name": source or "Google News",
                        "credibility": SOURCE_CREDIBILITY.get(self.name, 0.60),
                    },
                )
            )

        return records