import { useMemo } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export default function DashboardPage({ riskItems, events, alerts, suppliers, graphSummary, pipelineRun }) {
  const riskTrend = useMemo(
    () =>
      riskItems.slice(0, 18).reverse().map((item, index) => ({
        t: index + 1,
        score: Number(item.risk_score ?? 0),
      })),
    [riskItems]
  );

  const topRisk = riskItems[0];
  const topEvent = events.find((item) => item.id === topRisk?.event_id);
  const topAlert = alerts[0];

  const feedItems = useMemo(() => {
    return alerts.slice(0, 6).map((item) => ({
      level: item.alert_level,
      eventId: item.event_id,
      supplier: item.supplier || "Unmapped supplier",
      risk: Number(item.risk_score ?? 0).toFixed(3),
      summary: item.summary || "Operational disruption flagged",
    }));
  }, [alerts]);

  const exposureList = useMemo(() => {
    return riskItems.slice(0, 5).map((item) => {
      const event = events.find((entry) => entry.id === item.event_id);
      const countries = event?.entities_json?.countries || [];
      const ports = event?.entities_json?.ports || [];
      const commodities = event?.entities_json?.commodities || [];
      return {
        eventId: item.event_id,
        country: countries[0]?.text || event?.location || "-",
        port: ports[0]?.text || "-",
        commodity: commodities[0]?.text || "-",
        supplier: item.supplier_name || "Unmapped supplier",
        pathWeight: Number(item.feature_json?.path_weight ?? 1).toFixed(2),
      };
    });
  }, [events, riskItems]);

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
        {feedItems.length ? feedItems.map((item) => (
          <article className={`dashboard-node-line ${item.level?.toLowerCase() || "medium"}`} key={`${item.eventId}-${item.supplier}`}>
            <div>
              <strong>{item.supplier}</strong>
              <span>Event {item.eventId}</span>
              <small>{item.summary}</small>
            </div>
            <div>
              <span className={`pill ${(item.level || "medium").toLowerCase()}`}>{item.level}</span>
              <strong>{item.risk}</strong>
            </div>
          </article>
        )) : <p className="status-note">No active alerts yet.</p>}
      </section>

      <section className="card">
        <h2>Exposure propagation</h2>
        <div className="dashboard-node-map">
          {exposureList.length ? exposureList.map((item) => (
            <article className="dashboard-node-line" key={item.eventId}>
              <div>
                <strong>Event {item.eventId}</strong>
                <span>{item.country} → {item.port} → {item.supplier}</span>
              </div>
              <div>
                <span>{item.commodity}</span>
                <strong>Weight {item.pathWeight}</strong>
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
            {(topEvent?.summary || topAlert?.summary || "No live disruption summary available.")}
          </p>
        </article>
        <article className="modal-card">
          <h3>Recommended actions</h3>
          <ul className="plain-list compact">
            <li>Reroute high-risk lanes to alternate ports.</li>
            <li>Increase buffer stock for exposed commodities.</li>
            <li>Notify procurement leads for the top supplier cluster.</li>
          </ul>
        </article>
        <article className="modal-card">
          <h3>Confidence</h3>
          <p className="modal-text">{topRisk ? Number(topRisk.classifier_confidence ?? 0).toFixed(2) : "0.00"}</p>
        </article>
      </section>

      <section className="card full">
        <h2>Risk trend</h2>
        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={riskTrend}>
            <defs>
              <linearGradient id="riskTrendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06d6a0" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#06d6a0" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2f3f4d" />
            <XAxis dataKey="t" stroke="#9bb0c3" />
            <YAxis stroke="#9bb0c3" domain={[0, 1]} />
            <Tooltip />
            <Area type="monotone" dataKey="score" stroke="#06d6a0" fill="url(#riskTrendFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </section>
    </div>
  );
}
