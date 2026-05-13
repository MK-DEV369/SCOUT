import logging
from collections.abc import Awaitable, Callable
from typing import Any

from sqlalchemy.orm import Session

from app.enrichment.record_enricher import enrich_records
from app.ingestion.schema import NormalizedRecord

logger = logging.getLogger(__name__)

CollectStage = Callable[[], Awaitable[tuple[list[NormalizedRecord], dict[str, int], list[dict[str, str]]]]]
PersistStage = Callable[[Session, list[NormalizedRecord]], dict[str, int]]
OptionalStage = Callable[[Session, list[NormalizedRecord]], dict[str, Any]]


class IntelligencePipeline:
    def __init__(
        self,
        *,
        collect_stage: CollectStage,
        persist_stage: PersistStage,
        session_factory: Callable[[], Session],
        nlp_stage: OptionalStage | None = None,
        graph_stage: OptionalStage | None = None,
        risk_stage: OptionalStage | None = None,
    ) -> None:
        self.collect_stage = collect_stage
        self.persist_stage = persist_stage
        self.session_factory = session_factory
        self.nlp_stage = nlp_stage
        self.graph_stage = graph_stage
        self.risk_stage = risk_stage

    @staticmethod
    def _run_optional_stage(name: str, stage: OptionalStage | None, db: Session, records: list[NormalizedRecord]) -> dict[str, Any]:
        if stage is None:
            return {"status": "skipped", "reason": f"{name} stage not configured"}
        try:
            result = stage(db, records) or {}
            return {"status": "ok", **result}
        except Exception as exc:  # noqa: BLE001
            logger.exception("%s stage failed", name, exc_info=exc)
            return {"status": "error", "error": str(exc)}

    async def run(self) -> dict[str, Any]:
        records, source_counts, errors = await self.collect_stage()
        normalized_records = list(records)
        enriched_records = enrich_records(normalized_records)

        with self.session_factory() as db:
            persist_result = self.persist_stage(db, enriched_records)
            nlp_result = self._run_optional_stage("nlp", self.nlp_stage, db, enriched_records)
            graph_result = self._run_optional_stage("graph", self.graph_stage, db, enriched_records)
            risk_result = self._run_optional_stage("risk", self.risk_stage, db, enriched_records)

        status = "ok" if not errors else "partial_failure"
        return {
            "status": status,
            "fetched_total": len(records),
            "normalized_total": len(normalized_records),
            "enriched_total": len(enriched_records),
            "inserted": persist_result.get("inserted", 0),
            "duplicates": persist_result.get("duplicates", 0),
            "error_count": len(errors),
            "source_counts": source_counts,
            "errors": errors,
            "stages": {
                "collect": {"status": "ok", "records": len(records)},
                "normalize": {"status": "ok", "records": len(normalized_records)},
                "enrich": {"status": "ok", "records": len(enriched_records)},
                "persist": {"status": "ok", **persist_result},
                "nlp": nlp_result,
                "graph": graph_result,
                "risk": risk_result,
            },
        }
