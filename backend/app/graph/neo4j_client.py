from neo4j import GraphDatabase

from app.core.config import settings


class GraphService:
    def __init__(self) -> None:
        self._driver = None
        if settings.neo4j_uri and settings.neo4j_user and settings.neo4j_password:
            self._driver = GraphDatabase.driver(
                settings.neo4j_uri,
                auth=(settings.neo4j_user, settings.neo4j_password),
            )

    @property
    def enabled(self) -> bool:
        return self._driver is not None

    def upsert_event_path(
        self,
        *,
        event_id: int,
        event_category: str,
        country: str | None,
        supplier_name: str | None,
        manufacturer_name: str | None,
        commodity: str | None,
    ) -> None:
        if not self._driver:
            return

        query = """
        MERGE (e:Event {id: $event_id})
        SET e.category = $event_category
        FOREACH (_ IN CASE WHEN $country IS NULL THEN [] ELSE [1] END |
            MERGE (c:Country {name: $country})
            MERGE (e)-[:AFFECTS]->(c)
        )
        FOREACH (_ IN CASE WHEN $supplier_name IS NULL THEN [] ELSE [1] END |
            MERGE (s:Supplier {name: $supplier_name})
            MERGE (s)-[:AFFECTED_BY]->(e)
            FOREACH (_2 IN CASE WHEN $country IS NULL THEN [] ELSE [1] END |
                MERGE (s)-[:LOCATED_IN]->(:Country {name: $country})
            )
        )
        FOREACH (_ IN CASE WHEN $manufacturer_name IS NULL THEN [] ELSE [1] END |
            MERGE (m:Manufacturer {name: $manufacturer_name})
            FOREACH (_2 IN CASE WHEN $supplier_name IS NULL THEN [] ELSE [1] END |
                MERGE (s2:Supplier {name: $supplier_name})
                MERGE (s2)-[:SUPPLIES]->(m)
            )
        )
        FOREACH (_ IN CASE WHEN $commodity IS NULL THEN [] ELSE [1] END |
            MERGE (co:Commodity {name: $commodity})
            MERGE (e)-[:AFFECTS]->(co)
        )
        """
        with self._driver.session() as session:
            session.run(
                query,
                event_id=event_id,
                event_category=event_category,
                country=country,
                supplier_name=supplier_name,
                manufacturer_name=manufacturer_name,
                commodity=commodity,
            )


graph_service = GraphService()
