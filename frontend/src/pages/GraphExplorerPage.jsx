import { useMemo, useState, useRef, useEffect } from "react";
import CytoscapeComponent from "react-cytoscapejs";

const COLORS = {
  event: "#06d6a0",
  supplier: "#118ab2",
  country: "#ffd166",
  port: "#ef476f",
  commodity: "#f78c6b",
  manufacturer: "#8e7dff",
};

function getEntityText(item) {
  if (!item) return "";
  if (typeof item === "string") return item;
  return item.text || "";
}

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
    const entityData = event.entities || event.entities_json || {};
    addNode(eventId, event.category || "event", "event", { severity: event.severity, source: event.source, country: event.location });

    (entityData.countries || []).slice(0, 2).forEach((item) => {
      const text = getEntityText(item);
      if (!text) return;
      const id = `country-${text.toLowerCase()}`;
      addNode(id, text, "country");
      edges.push({ data: { id: `${eventId}-${id}`, source: eventId, target: id, label: "affects" } });
    });

    (entityData.ports || []).slice(0, 2).forEach((item) => {
      const text = getEntityText(item);
      if (!text) return;
      const id = `port-${text.toLowerCase()}`;
      addNode(id, text, "port");
      edges.push({ data: { id: `${eventId}-${id}`, source: eventId, target: id, label: "affects" } });
    });

    (entityData.commodities || []).slice(0, 2).forEach((item) => {
      const text = getEntityText(item);
      if (!text) return;
      const id = `commodity-${text.toLowerCase()}`;
      addNode(id, text, "commodity");
      edges.push({ data: { id: `${eventId}-${id}`, source: eventId, target: id, label: "affects" } });
    });

    (entityData.companies || []).slice(0, 2).forEach((item) => {
      const text = getEntityText(item);
      if (!text) return;
      const supplier = suppliers.find((row) => row.name?.toLowerCase() === text.toLowerCase());
      const id = supplier ? `supplier-${supplier.id}` : `supplier-${text.toLowerCase()}`;
      addNode(id, text, "supplier", { country: supplier?.country || event.location || "USA", importance: supplier?.importance });
      edges.push({ data: { id: `${eventId}-${id}`, source: eventId, target: id, label: "exposes" } });
    });

    (entityData.manufacturers || []).slice(0, 2).forEach((item) => {
      const text = getEntityText(item);
      if (!text) return;
      const id = `manufacturer-${text.toLowerCase()}`;
      addNode(id, text, "manufacturer");
      edges.push({ data: { id: `${eventId}-${id}`, source: eventId, target: id, label: "impacts" } });
    });
  });

  return [...nodes, ...edges];
}

export default function GraphExplorerPage({ events, suppliers, graphSummary }) {
  const [selected, setSelected] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const cyRef = useRef(null);

  const handleDownloadImage = () => {
    if (!cyRef.current) return;
    const png64 = cyRef.current.png({ full: true, scale: 2, bg: "#08111f" });
    const a = document.createElement("a");
    a.href = png64;
    a.download = "scout_risk_propagation_graph.png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const filteredEvents = useMemo(() => {
    if (categoryFilter === "all") return events;
    return events.filter((item) => (item.category || "").toLowerCase().includes(categoryFilter));
  }, [events, categoryFilter]);

  const elements = useMemo(() => buildElements(filteredEvents, suppliers), [filteredEvents, suppliers]);

  useEffect(() => {
    if (cyRef.current) {
      cyRef.current.layout({ name: "cose", animate: false, idealEdgeLength: 90, nodeRepulsion: 9000 }).run();
    }
  }, [elements]);

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
        <div className="graph-filters" style={{ width: "100%", display: "flex", gap: "10px", alignItems: "center" }}>
          {["all", "conflict", "logistics", "economic", "weather"].map((item) => (
            <button key={item} type="button" className={`chip ${categoryFilter === item ? "active" : ""}`} onClick={() => setCategoryFilter(item)}>
              {item}
            </button>
          ))}
          <button type="button" className="chip" style={{ borderColor: "var(--aqua)", color: "var(--aqua)", marginLeft: "auto" }} onClick={handleDownloadImage}>
            Export PNG
          </button>
        </div>
      </section>

      <section className="card large graph-stage">
        <CytoscapeComponent
          elements={elements}
          stylesheet={styles}
          className="cytoscape-canvas"
          layout={{ name: "cose", animate: false, idealEdgeLength: 90, nodeRepulsion: 9000 }}
          cy={(cy) => {
            cyRef.current = cy;
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
        <div className="graph-meta-list" style={{ display: "grid", gap: "14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span>Total Nodes</span>
              <strong style={{ fontSize: "1.6rem", color: "#eff5ff" }}>
                {graphSummary?.node_count ?? elements.filter((item) => item.data?.id).length}
              </strong>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end" }}>
              {(graphSummary?.labels || []).map((l) => (
                <span key={l.label} style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "6px", color: "#98b0c3", textTransform: "none", letterSpacing: "normal" }}>
                  <span className="dot" style={{ 
                    width: "6px", 
                    height: "6px", 
                    borderRadius: "50%", 
                    background: l.label === "RiskEvent" ? "var(--aqua)" : l.label === "Supplier" ? "var(--blue)" : "var(--amber)" 
                  }} />
                  {l.label}: <strong style={{ color: "#eff5ff", display: "inline" }}>{l.count}</strong>
                </span>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <span>Total Edges</span>
              <strong style={{ fontSize: "1.6rem", color: "#eff5ff" }}>
                {graphSummary?.relationship_count ?? elements.filter((item) => item.data?.source).length}
              </strong>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end" }}>
              {(graphSummary?.relationship_types || []).map((r) => (
                <span key={r.type} style={{ fontSize: "0.75rem", display: "inline-flex", alignItems: "center", gap: "6px", color: "#98b0c3", textTransform: "none", letterSpacing: "normal" }}>
                  <span className="dot" style={{ 
                    width: "6px", 
                    height: "6px", 
                    borderRadius: "50%", 
                    background: "var(--rose)" 
                  }} />
                  {r.type}: <strong style={{ color: "#eff5ff", display: "inline" }}>{r.count}</strong>
                </span>
              ))}
            </div>
          </div>

          <div>
            <span>Graph Connectivity</span>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
              <span className="dot" style={{ 
                width: "8px", 
                height: "8px", 
                borderRadius: "50%", 
                background: graphSummary?.enabled ? "var(--aqua)" : "var(--rose)",
                boxShadow: graphSummary?.enabled ? "0 0 8px var(--aqua)" : "none"
              }} />
              <strong style={{ fontSize: "0.85rem", color: graphSummary?.enabled ? "var(--aqua)" : "var(--rose)" }}>
                {graphSummary?.enabled ? "Relational Graph Active" : "Offline"}
              </strong>
            </div>
          </div>

          <hr style={{ border: "0", borderTop: "1px solid var(--line)", margin: "16px 0 10px 0" }} />

          <div>
            <span style={{ fontSize: "0.85rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Selected Node</span>
            {selected ? (
              <div className="selected-node-card" style={{ marginTop: "10px", background: "rgba(10, 20, 30, 0.25)", border: "1px solid var(--line)", borderRadius: "12px", padding: "12px" }}>
                <p className="eyebrow" style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--muted)", margin: "0 0 4px 0" }}>{selected.type}</p>
                <h3 style={{ fontSize: "1.1rem", fontWeight: "600", color: "#eff5ff", margin: "0 0 8px 0" }}>{selected.label}</h3>
                <p style={{ margin: "4px 0", fontSize: "0.8rem", color: "#a8bdd2" }}>Source: <strong style={{ color: "#eff5ff" }}>{selected.source || "graph"}</strong></p>
                <p style={{ margin: "4px 0", fontSize: "0.8rem", color: "#a8bdd2" }}>Severity / Importance: <strong style={{ color: "#eff5ff" }}>{selected.severity ?? selected.importance ?? "-"}</strong></p>
                <p style={{ margin: "4px 0", fontSize: "0.8rem", color: "#a8bdd2" }}>Location / Domain: <strong style={{ color: "#eff5ff" }}>{selected.type === "country" ? selected.label : (selected.country || "-")}</strong></p>
              </div>
            ) : (
              <p className="status-note" style={{ marginTop: "10px", fontSize: "0.8rem", color: "var(--muted)", fontStyle: "italic" }}>Tap a node to inspect its relationships and exposure.</p>
            )}
          </div>
        </div>
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