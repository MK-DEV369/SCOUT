import { useMemo, useState } from "react";
import CytoscapeComponent from "react-cytoscapejs";

const COLORS = {
  event: "#06d6a0",
  supplier: "#118ab2",
  country: "#ffd166",
  port: "#ef476f",
  commodity: "#f78c6b",
  manufacturer: "#8e7dff",
};

function buildElements(events, suppliers) {
  const nodes = [];
  const edges = [];
  const seen = new Set();

  const addNode = (id, label, type, extra = {}) => {
    if (seen.has(id)) return;
    seen.add(id);
    nodes.push({ data: { id, label, type, ...extra } });
  };

  events.slice(0, 40).forEach((event) => {
    const eventId = `event-${event.id}`;
    const entityData = event.entities_json || {};
    addNode(eventId, event.category || "event", "event", { severity: event.severity, source: event.source });

    (entityData.countries || []).slice(0, 2).forEach((item) => {
      const id = `country-${item.text.toLowerCase()}`;
      addNode(id, item.text, "country");
      edges.push({ data: { id: `${eventId}-${id}`, source: eventId, target: id, label: "affects" } });
    });

    (entityData.ports || []).slice(0, 2).forEach((item) => {
      const id = `port-${item.text.toLowerCase()}`;
      addNode(id, item.text, "port");
      edges.push({ data: { id: `${eventId}-${id}`, source: eventId, target: id, label: "affects" } });
    });

    (entityData.commodities || []).slice(0, 2).forEach((item) => {
      const id = `commodity-${item.text.toLowerCase()}`;
      addNode(id, item.text, "commodity");
      edges.push({ data: { id: `${eventId}-${id}`, source: eventId, target: id, label: "affects" } });
    });

    (entityData.companies || []).slice(0, 2).forEach((item) => {
      const supplier = suppliers.find((row) => row.name?.toLowerCase() === item.text.toLowerCase());
      const id = supplier ? `supplier-${supplier.id}` : `supplier-${item.text.toLowerCase()}`;
      addNode(id, item.text, "supplier", { country: supplier?.country, importance: supplier?.importance });
      edges.push({ data: { id: `${eventId}-${id}`, source: eventId, target: id, label: "exposes" } });
    });

    (entityData.manufacturers || []).slice(0, 2).forEach((item) => {
      const id = `manufacturer-${item.text.toLowerCase()}`;
      addNode(id, item.text, "manufacturer");
      edges.push({ data: { id: `${eventId}-${id}`, source: eventId, target: id, label: "impacts" } });
    });
  });

  return [...nodes, ...edges];
}

export default function GraphExplorerPage({ events, suppliers, graphSummary }) {
  const [selected, setSelected] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");

  const filteredEvents = useMemo(() => {
    if (categoryFilter === "all") return events;
    return events.filter((item) => (item.category || "").toLowerCase().includes(categoryFilter));
  }, [events, categoryFilter]);

  const elements = useMemo(() => buildElements(filteredEvents, suppliers), [filteredEvents, suppliers]);

  const styles = [
    {
      selector: 'node[type = "event"]',
      style: {
        label: "data(label)",
        color: "#eff5ff",
        "text-outline-width": 2,
        "text-outline-color": "#08111f",
        "background-color": COLORS.event,
        width: 30,
        height: 30,
        "border-width": 2,
        "border-color": "#ffffff33",
        "font-size": 10,
      },
    },
    {
      selector: 'node[type = "supplier"]',
      style: {
        label: "data(label)",
        color: "#eff5ff",
        "text-outline-width": 2,
        "text-outline-color": "#08111f",
        "background-color": COLORS.supplier,
        width: 24,
        height: 24,
        "font-size": 9,
      },
    },
    {
      selector: 'node[type = "country"]',
      style: {
        label: "data(label)",
        color: "#eff5ff",
        "text-outline-width": 2,
        "text-outline-color": "#08111f",
        "background-color": COLORS.country,
        width: 22,
        height: 22,
        "font-size": 9,
      },
    },
    {
      selector: 'node[type = "port"]',
      style: {
        label: "data(label)",
        color: "#eff5ff",
        "text-outline-width": 2,
        "text-outline-color": "#08111f",
        "background-color": COLORS.port,
        width: 22,
        height: 22,
        "font-size": 9,
      },
    },
    {
      selector: 'node[type = "commodity"]',
      style: {
        label: "data(label)",
        color: "#eff5ff",
        "text-outline-width": 2,
        "text-outline-color": "#08111f",
        "background-color": COLORS.commodity,
        width: 22,
        height: 22,
        "font-size": 9,
      },
    },
    {
      selector: 'node[type = "manufacturer"]',
      style: {
        label: "data(label)",
        color: "#eff5ff",
        "text-outline-width": 2,
        "text-outline-color": "#08111f",
        "background-color": COLORS.manufacturer,
        width: 22,
        height: 22,
        "font-size": 9,
      },
    },
    {
      selector: "edge",
      style: { width: 2, "line-color": "#5d7087", "target-arrow-color": "#5d7087", "target-arrow-shape": "triangle", label: "data(label)", color: "#a8bdd2", "font-size": 8 },
    },
    { selector: ".highlighted", style: { "border-width": 3, "border-color": "#ffffff", "line-color": "#ffffff", "target-arrow-color": "#ffffff" } },
  ];

  return (
    <div className="grid graph-explorer-grid">
      <section className="card full graph-explorer-hero">
        <div>
          <p className="section-kicker">Graph explorer</p>
          <h2>Risk propagation map</h2>
          <p className="section-copy">
            Visualize event-to-country-to-supplier-to-manufacturer paths and inspect multi-hop exposure.
          </p>
        </div>
        <div className="graph-filters">
          {["all", "conflict", "logistics", "economic", "weather"].map((item) => (
            <button key={item} type="button" className={`chip ${categoryFilter === item ? "active" : ""}`} onClick={() => setCategoryFilter(item)}>
              {item}
            </button>
          ))}
        </div>
      </section>

      <section className="card large graph-stage">
        <CytoscapeComponent
          elements={elements}
          stylesheet={styles}
          className="cytoscape-canvas"
          layout={{ name: "cose", animate: false, idealEdgeLength: 90, nodeRepulsion: 9000 }}
          cy={(cy) => {
            cy.off("tap", "node");
            cy.on("tap", "node", (event) => {
              const node = event.target;
              setSelected({
                id: node.id(),
                label: node.data("label"),
                type: node.data("type"),
                source: node.data("source"),
                severity: node.data("severity"),
                country: node.data("country"),
                importance: node.data("importance"),
              });
              cy.elements().removeClass("highlighted");
              node.connectedEdges().addClass("highlighted");
              node.connectedNodes().addClass("highlighted");
              node.addClass("highlighted");
            });
          }}
        />
      </section>

      <section className="card">
        <h2>Graph summary</h2>
        <div className="graph-meta-list">
          <div><span>Nodes</span><strong>{graphSummary?.node_count ?? elements.filter((item) => item.data?.id).length}</strong></div>
          <div><span>Relationships</span><strong>{graphSummary?.relationship_count ?? elements.filter((item) => item.data?.source).length}</strong></div>
          <div><span>Labels</span><strong>{graphSummary?.labels?.length ?? 0}</strong></div>
        </div>
      </section>

      <section className="card">
        <h2>Selected node</h2>
        {selected ? (
          <div className="selected-node-card">
            <p className="eyebrow">{selected.type}</p>
            <h3>{selected.label}</h3>
            <p>Source: {selected.source || "graph"}</p>
            <p>Severity / importance: {selected.severity ?? selected.importance ?? "-"}</p>
            <p>Country: {selected.country || "-"}</p>
          </div>
        ) : (
          <p className="status-note">Tap a node to inspect its relationships and exposure.</p>
        )}
      </section>

      <section className="card full">
        <h2>Multi-hop narrative</h2>
        <div className="status-panel compact-grid">
          <p className="status-note">RiskEvent → Country → Port → Supplier → Manufacturer</p>
          <p className="status-note">Cross-source evidence can be clustered into a single disruption object.</p>
          <p className="status-note">The explorer is intentionally operational, not decorative.</p>
        </div>
      </section>
    </div>
  );
}