from datetime import datetime, timezone
import re

import httpx

from app.core.config import settings
from app.ingestion.connectors.base import SourceConnector, SOURCE_CREDIBILITY
from app.ingestion.schema import NormalizedRecord


class NewsAPIConnector(SourceConnector):
    name = "newsapi"

    QUERIES = [
        "global supply chain disruption",
        "port congestion",
        "factory shutdown",
        "shipping delays",
        "trade sanctions",
        "semiconductor shortage",
        "commodity crisis",
        "geopolitical conflict logistics",
    ]

    TRUSTED_SOURCES = {
        "Reuters": 0.95,
        "Bloomberg": 0.94,
        "Financial Times": 0.92,
        "CNBC": 0.88,
        "Associated Press": 0.9,
    }

    HIGH_PRIORITY_TERMS = [
        "shutdown",
        "explosion",
        "sanction",
        "blockade",
        "earthquake",
        "cyberattack",
    ]

    COUNTRY_HINTS = [
        "United States",
        "USA",
        "China",
        "India",
        "Japan",
        "Taiwan",
        "South Korea",
        "Germany",
        "Singapore",
        "Vietnam",
        "Mexico",
        "Brazil",
        "Russia",
        "Ukraine",
        "Turkey",
        "France",
        "Netherlands",
        "Malaysia",
        "Thailand",
        "Canada",
        "UK",
        "United Kingdom",
    ]

    def _infer_category(self, text: str) -> str:
        lowered = text.lower()

        if any(term in lowered for term in ["port", "shipping", "freight", "logistics", "container"]):
            return "logistics"

        if any(term in lowered for term in ["war", "conflict", "attack", "sanction", "blockade"]):
            return "geopolitical"

        if any(term in lowered for term in ["inflation", "interest rate", "rate hike", "cpi", "gdp"]):
            return "economic"

        if any(term in lowered for term in ["factory", "plant", "shutdown", "production", "shortage"]):
            return "operational"

        return "general"

    def _infer_priority(self, text: str) -> str:
        lowered = text.lower()
        return "high" if any(term in lowered for term in self.HIGH_PRIORITY_TERMS) else "normal"

    def _extract_country_hint(self, text: str, source_name: str) -> str | None:
        haystack = f"{text} {source_name}"
        for country in self.COUNTRY_HINTS:
            pattern = rf"\b{re.escape(country)}\b"
            if re.search(pattern, haystack, flags=re.IGNORECASE):
                return country
        return None

    def _source_credibility(self, source_name: str) -> float:
        return self.TRUSTED_SOURCES.get(source_name, 0.6)

    async def _fetch_query(self, client: httpx.AsyncClient, query: str, page_size: int = 25) -> list[dict]:
        params = {
            "q": query,
            "language": "en",
            "pageSize": page_size,
            "sortBy": "publishedAt",
            "apiKey": settings.newsapi_key,
        }
        response = await client.get("https://newsapi.org/v2/everything", params=params)
        response.raise_for_status()
        payload = response.json()
        return payload.get("articles", [])

    async def fetch_top_headlines(self, category: str = "business", page_size: int = 20) -> list[NormalizedRecord]:
        if not settings.newsapi_key:
            raise RuntimeError("NEWSAPI_KEY is not configured")

        params = {
            "category": category,
            "language": "en",
            "pageSize": page_size,
            "apiKey": settings.newsapi_key,
        }

        async with httpx.AsyncClient(timeout=20) as client:
            response = await client.get("https://newsapi.org/v2/top-headlines", params=params)
            response.raise_for_status()
            data = response.json()

        records: list[NormalizedRecord] = []
        for article in data.get("articles", []):
            body_text = " ".join(
                [
                    article.get("title") or "",
                    article.get("description") or "",
                    article.get("content") or "",
                ]
            ).strip()
            if not body_text:
                continue

            ts_raw = article.get("publishedAt")
            timestamp = datetime.now(timezone.utc)
            if ts_raw:
                try:
                    timestamp = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
                except ValueError:
                    pass

            source_name = article.get("source", {}).get("name") or "Unknown"
            category_inferred = self._infer_category(body_text)
            credibility = self._source_credibility(source_name)
            country_hint = self._extract_country_hint(body_text, source_name)
            priority = self._infer_priority(body_text)

            records.append(
                NormalizedRecord.with_defaults(
                    source=self.name,
                    source_id=article.get("url"),
                    text=body_text,
                    timestamp=timestamp,
                    location=source_name,
                    category=category_inferred,
                    country=country_hint,
                    source_credibility=SOURCE_CREDIBILITY.get(self.name, 0.65),
                    source_url=article.get("url"),
                    source_outlet=source_name,
                    metadata={
                        "author": article.get("author"),
                        "url": article.get("url"),
                        "source_name": source_name,
                        "category": category_inferred,
                        "credibility": credibility,
                        "country_hint": country_hint,
                        "priority": priority,
                        "mode": "top_headlines",
                    },
                )
            )

        return records

    async def fetch(self) -> list[NormalizedRecord]:
        if not settings.newsapi_key:
            raise RuntimeError("NEWSAPI_KEY is not configured")

        async with httpx.AsyncClient(timeout=20) as client:
            articles: list[dict] = []
            for query in self.QUERIES:
                articles.extend(await self._fetch_query(client, query=query, page_size=15))

        records: list[NormalizedRecord] = []
        seen_urls: set[str] = set()
        for article in articles:
            body_text = " ".join(
                [
                    article.get("title") or "",
                    article.get("description") or "",
                    article.get("content") or "",
                ]
            ).strip()
            if not body_text:
                continue

            article_url = article.get("url") or ""
            if article_url and article_url in seen_urls:
                continue
            if article_url:
                seen_urls.add(article_url)

            ts_raw = article.get("publishedAt")
            timestamp = datetime.now(timezone.utc)
            if ts_raw:
                try:
                    timestamp = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
                except ValueError:
                    pass

            source_name = article.get("source", {}).get("name") or "Unknown"
            category = self._infer_category(body_text)
            credibility = self._source_credibility(source_name)
            country_hint = self._extract_country_hint(body_text, source_name)
            priority = self._infer_priority(body_text)

            records.append(
                NormalizedRecord.with_defaults(
                    source=self.name,
                    source_id=article_url,
                    text=body_text,
                    timestamp=timestamp,
                    location=source_name,
                    category=category,
                    country=country_hint,
                    source_credibility=SOURCE_CREDIBILITY.get(self.name, 0.0),
                    source_url=article_url,
                    source_outlet=source_name,
                    metadata={
                        "author": article.get("author"),
                        "url": article_url,
                        "source_name": source_name,
                        "category": category,
                        "credibility": credibility,
                        "country_hint": country_hint,
                        "priority": priority,
                        "mode": "everything",
                    },
                )
            )

        return records
