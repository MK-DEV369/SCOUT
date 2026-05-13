from typing import Any

from app.ingestion.schema import NormalizedRecord


def build_graph_payload(records: list[NormalizedRecord]) -> dict[str, Any]:
    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []

    for record in records:
        event_node_id = record.event_key or f"{record.source}:{record.source_id or record.timestamp.isoformat()}"
        nodes.append(
            {
                "id": event_node_id,
                "label": "Event",
                "properties": {
                    "source": record.source,
                    "source_id": record.source_id,
                    "timestamp": record.timestamp.isoformat(),
                    "text": record.text,
                    "location": record.location,
                    "category": record.category,
                    "risk_score": record.risk_score,
                },
            }
        )

        for entity_name in record.entities:
            entity_name = str(entity_name).strip()
            if not entity_name:
                continue
            entity_node_id = f"entity:{entity_name.lower()}"
            nodes.append(
                {
                    "id": entity_node_id,
                    "label": "Entity",
                    "properties": {"name": entity_name},
                }
            )
            edges.append(
                {
                    "from": event_node_id,
                    "to": entity_node_id,
                    "type": "MENTIONS",
                }
            )

        if record.relationships:
            for relationship in record.relationships:
                if not isinstance(relationship, dict):
                    continue
                target = str(relationship.get("target") or "").strip()
                rel_type = str(relationship.get("type") or "RELATED_TO").strip()
                if not target:
                    continue
                target_node_id = f"related:{target.lower()}"
                nodes.append(
                    {
                        "id": target_node_id,
                        "label": "Related",
                        "properties": {"name": target},
                    }
                )
                edges.append(
                    {
                        "from": event_node_id,
                        "to": target_node_id,
                        "type": rel_type,
                    }
                )

    return {"nodes": nodes, "edges": edges}
