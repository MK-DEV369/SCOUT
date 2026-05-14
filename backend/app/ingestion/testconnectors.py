import asyncio
import logging
from pathlib import Path

from app.ingestion.connectors.acled import ACLEDConnector
from app.ingestion.connectors.fred import FREDConnector
from app.ingestion.connectors.freightos import FreightosConnector
from app.ingestion.connectors.gdelt import GDELTConnector
from app.ingestion.connectors.google_news import GoogleNewsConnector
from app.ingestion.connectors.newsapi import NewsAPIConnector
from app.ingestion.connectors.worldbank import WorldBankConnector


LOG_FILE_PATH = Path(__file__).resolve().parents[2] / "connector-test.log"

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_FILE_PATH, encoding="utf-8"),
        logging.StreamHandler(),
    ],
)

logger = logging.getLogger(__name__)


async def test_connector(connector):
    logger.info("===== TESTING %s =====", connector.name.upper())

    try:
        records = await connector.fetch()

        logger.info("SUCCESS: %s records", len(records))

        if records:
            sample = records[0]
            logger.info("Sample: %s", sample.model_dump())

    except Exception as e:
        logger.exception("FAILED: %s", e)


async def main():
    logger.info("Starting connector test run. Log file: %s", LOG_FILE_PATH)
    connectors = [
        ACLEDConnector(),
        GDELTConnector(),
        NewsAPIConnector(),
        GoogleNewsConnector(),
        WorldBankConnector(),
        FREDConnector(),
        FreightosConnector(),
    ]

    for connector in connectors:
        await test_connector(connector)


if __name__ == "__main__":
    asyncio.run(main())