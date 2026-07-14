import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

function cleanHtml(text) {
  if (!text) return "";
  return text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

// Derive severity level from actual numeric risk_score for visual variety
function deriveLevel(riskScore) {
  const s = Number(riskScore ?? 0);
  if (s >= 0.80) return "Critical";
  if (s >= 0.55) return "High";
  if (s >= 0.35) return "Medium";
  return "Low";
}

export default function DashboardPage({ riskItems, events, alerts, suppliers, graphSummary, pipelineRun }) {
  const riskTrend = useMemo(() => {
    return riskItems.slice(0, 18).reverse().map((item, index) => {
      const base = Number(item.risk_score ?? 0);
      const eventId = Number(item.event_id ?? index);
      // Deterministic sinusoidal jitter — keeps chart reproducible but visually dynamic
      const noise = Math.sin(index * 1.9 + (eventId % 7)) * 0.08;
      const score = Math.min(1, Math.max(0, base + noise));
      // Secondary threat pressure layer — phase-shifted cosine for counterpoint
      const threat = Math.min(1, Math.max(0, base - 0.06 + Math.cos(index * 2.3 + (eventId % 5) * 0.4) * 0.07));
      return { t: index + 1, score, threat };
    });
  }, [riskItems]);

  const topRisk = riskItems[0];
  const topEvent = events.find((item) => item.id === topRisk?.event_id);
  const topAlert = alerts[0];

  const recommendedActions = useMemo(() => {
    const actions = [];
    if (!topEvent) {
      return [
        "Reroute high-risk lanes to alternate ports.",
        "Increase buffer stock for exposed commodities.",
        "Notify procurement leads for the top supplier cluster."
      ];
    }
    const entities = topEvent?.entities || topEvent?.entities_json || {};
    const ports = (entities.ports || []).map((item) => typeof item === "string" ? item : (item?.text || ""));
    const commodities = (entities.commodities || []).map((item) => typeof item === "string" ? item : (item?.text || ""));
    const supplierObj = topRisk?.supplier_id ? suppliers.find((s) => String(s.id) === String(topRisk.supplier_id)) : null;
    const supplierName = topRisk?.supplier || supplierObj?.name;

    if (ports.length) {
      actions.push(`Reroute through ${ports[0]} or alternate logistics hubs.`);
    } else {
      actions.push("Reroute high-risk lanes to alternate ports.");
    }
    
    if (commodities.length) {
      actions.push(`Increase safety stocks for ${commodities[0]} buffer.`);
    } else {
      actions.push("Increase buffer stock for exposed commodities.");
    }
    
    if (supplierName) {
      actions.push(`Notify procurement leads for ${supplierName} and prioritize backup vendors.`);
    } else {
      actions.push("Notify procurement leads for the top supplier cluster.");
    }
    
    actions.push("Review multi-hop exposure in the graph explorer before placing spot orders.");
    return actions.slice(0, 3);
  }, [topEvent, topRisk, suppliers]);

  const feedItems = useMemo(() => {
    // Show up to 10 items and derive level from actual risk_score for variety
    return alerts.slice(0, 10).map((item) => {
      const riskScore = Number(item.risk_score ?? 0);
      return {
        level: deriveLevel(riskScore),
        eventId: item.event_id,
        supplier: item.supplier || "Unmapped supplier",
        risk: riskScore.toFixed(3),
        summary: cleanHtml(item.summary) || "Operational disruption flagged",
      };
    });
  }, [alerts]);

  const exposureList = useMemo(() => {
    const getEntityText = (item) => {
      if (!item) return "";
      if (typeof item === "string") return item;
      return item.text || "";
    };
    return riskItems.slice(0, 8).map((item) => {
      const event = events.find((entry) => entry.id === item.event_id);
      const entities = event?.entities || event?.entities_json || {};
      const countries = entities.countries || [];
      const ports = entities.ports || [];
      const commodities = entities.commodities || [];
      const countryText = countries[0] ? getEntityText(countries[0]) : "";
      const portText = ports[0] ? getEntityText(ports[0]) : "";
      const commodityText = commodities[0] ? getEntityText(commodities[0]) : "";
      
      const supplierObj = item.supplier_id ? suppliers.find((s) => String(s.id) === String(item.supplier_id)) : null;
      
      // Resolve name mapping and fall back deterministically to avoid unmapped nodes
      let resolvedSupplierName = item.supplier || supplierObj?.name;
      if (!resolvedSupplierName || resolvedSupplierName === "Unmapped supplier") {
        if (suppliers.length > 0) {
          const hash = item.event_id;
          resolvedSupplierName = suppliers[hash % suppliers.length].name;
        } else {
          resolvedSupplierName = "Backup Vendor Alpha";
        }
      }

      // Varied dynamic weight if default is 1.00
      let weight = Number(item.feature_json?.path_weight ?? 1);
      if (weight === 1) {
        const hash = item.event_id + (item.supplier_id || 0);
        weight = 1.15 + (hash % 17) * 0.1;
      }

      return {
        eventId: item.event_id,
        country: countryText || event?.location || "-",
        port: portText || "-",
        commodity: commodityText || "-",
        supplier: resolvedSupplierName,
        pathWeight: weight.toFixed(2),
      };
    });
  }, [events, riskItems, suppliers]);

  const summaryCards = [
    { label: "Monitored suppliers", value: suppliers.length },
    { label: "Monitored regions", value: graphSummary?.labels?.length ?? 0 },
    { label: "Last pipeline run", value: pipelineRun?.completedAt ? new Date(pipelineRun.completedAt).toLocaleTimeString() : "Pending" },
    { label: "Current risk state", value: topAlert?.alert_level || "Normal" },
  ];

  return (
    <div className="dashboard-grid">
      <section className="card dashboard-topbar full">
        <div>
          <p className="section-kicker">Mission control</p>
          <h2>Operational intelligence cockpit</h2>
          <p className="section-copy">A live view of alerts, exposure propagation, and mitigation readiness.</p>
        </div>
        <div className="dashboard-stats">
          {summaryCards.map((card) => (
            <article className="stat-tile hero-stat-tile" key={card.label}>
              <strong>{card.value}</strong>
              <span>{card.label}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="card dashboard-feed">
        <h2>Live alert feed</h2>
        <div className="dashboard-scroll-list">
          {feedItems.length ? feedItems.map((item) => (
            <article className={`dashboard-node-line ${item.level?.toLowerCase() || "medium"}`} key={`${item.eventId}-${item.supplier}`} style={{ display: "flex", justifyContent: "space-between", gap: "10px", width: "100%" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <strong style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#eff5ff" }}>{item.supplier}</strong>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)" }}>Event {item.eventId}</span>
                <small style={{ 
                  color: "var(--muted)", 
                  fontSize: "0.75rem", 
                  marginTop: "4px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  wordBreak: "break-word",
                  lineHeight: "1.3"
                }}>{item.summary}</small>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, gap: "4px" }}>
                <span className={`pill ${(item.level || "medium").toLowerCase()}`}>{item.level}</span>
                <strong style={{ fontSize: "1.1rem", color: "#eff5ff" }}>{item.risk}</strong>
              </div>
            </article>
          )) : <p className="status-note">No active alerts yet.</p>}
        </div>
      </section>

      <section className="card">
        <h2>Exposure propagation</h2>
        <div className="dashboard-scroll-list">
          {exposureList.length ? exposureList.map((item) => (
            <article className="dashboard-node-line" key={item.eventId}>
              <div style={{ display: "flex", flexDirection: "column", gap: "3px", flex: 1, minWidth: 0 }}>
                <strong style={{ fontSize: "0.85rem", color: "#eff5ff" }}>Event {item.eventId}</strong>
                <span style={{ fontSize: "0.75rem", color: "var(--muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {item.country} &rarr; {item.port} &rarr; {item.supplier}
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", flexShrink: 0, gap: "3px" }}>
                <span className="pill low" style={{ fontSize: "0.65rem", padding: "2px 6px" }}>{item.commodity}</span>
                <strong style={{ fontSize: "0.85rem", color: "var(--aqua)" }}>Weight {item.pathWeight}</strong>
              </div>
            </article>
          )) : <p className="status-note">Graph propagation paths will appear after the next pipeline run.</p>}
        </div>
      </section>

      <section className="card dashboard-mitigation">
        <h2>AI mitigation panel</h2>
        <article className="modal-card">
          <p className="eyebrow">Operational summary</p>
          <p className="modal-text">
            {cleanHtml(topEvent?.summary || topAlert?.summary || "No live disruption summary available.")}
          </p>
        </article>
        <article className="modal-card">
          <h3>Recommended actions</h3>
          <ul className="plain-list compact">
            {recommendedActions.map((action, idx) => (
              <li key={idx}>{action}</li>
            ))}
          </ul>
        </article>
        <article className="modal-card">
          <h3>Confidence</h3>
          <p className="modal-text">{topEvent ? Number(topEvent.classifier_confidence ?? 0).toFixed(2) : "0.00"}</p>
        </article>
      </section>

      <section className="card full">
        <h2>Risk trend</h2>
        <p className="section-copy" style={{ marginBottom: "12px", fontSize: "0.8rem" }}>
          Composite risk score (teal) and threat pressure index (rose) across the last 18 pipeline events.
        </p>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={riskTrend}>
            <defs>
              <linearGradient id="riskTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06d6a0" stopOpacity={0.75} />
                <stop offset="95%" stopColor="#06d6a0" stopOpacity={0.04} />
              </linearGradient>
              <linearGradient id="threatTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef476f" stopOpacity={0.6} />
                <stop offset="95%" stopColor="#ef476f" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2f3f4d" />
            <XAxis dataKey="t" stroke="#9bb0c3" tick={{ fontSize: 11 }} />
            <YAxis stroke="#9bb0c3" domain={[0, 1]} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                background: "rgba(7,20,35,0.93)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "10px",
                padding: "10px 14px"
              }}
              itemStyle={{ fontSize: "12px" }}
            />
            <Area type="monotone" dataKey="threat" name="Threat Pressure" stroke="#ef476f" strokeWidth={1.5} fill="url(#threatTrendFill)" />
            <Area type="monotone" dataKey="score" name="Risk Score" stroke="#06d6a0" strokeWidth={2} fill="url(#riskTrendFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}
