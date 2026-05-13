import { useMemo, useState } from "react";

import { api } from "../api";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

function StatCard({ label, value, tone = "aqua" }) {
  return (
    <article className={`stat-tile graph-stat graph-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

export default function GraphPage({ graphSummary, riskItems, events }) {
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [manufacturerId, setManufacturerId] = useState("default_manufacturer");
  const [impactItems, setImpactItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const summary = graphSummary || {};
  const labels = summary.labels || [];
  const relationshipTypes = summary.relationship_types || [];

  const exposureSeries = useMemo(() => {
    return riskItems.slice(0, 12).map((item) => ({
      event: String(item.event_id),
      risk: Number(item.risk_score ?? 0),
      alert: item.alert_level,
    }));
  }, [riskItems]);

  async function handleImpactSubmit(e) {
    e.preventDefault();
    if (!eventId || !manufacturerId.trim()) return;

    setLoading(true);
    setError("");
    try {
      const response = await api.graphImpact({ eventId, manufacturerId, limit: 20 });
      setImpactItems(response.items || []);
    } catch (requestError) {
      setImpactItems([]);
      setError(requestError.message || "Unable to load impact path");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid graph-grid">
      <section className="card full graph-hero">
        <p className="section-kicker">Graph Intelligence</p>
        <h2 className="section-title">Exposure propagation, not just event lists</h2>
        <p className="section-copy">
          SCOUT now exposes risk flow across suppliers, countries, ports, and commodities so you can
          inspect how disruption actually spreads through the network.
        </p>
        <div className="graph-stat-grid">
          <StatCard label="Nodes" value={summary.node_count ?? 0} />
          <StatCard label="Relationships" value={summary.relationship_count ?? 0} tone="blue" />
          <StatCard label="Labels" value={labels.length} tone="amber" />
          <StatCard label="Relationship types" value={relationshipTypes.length} tone="rose" />
        </div>
      </section>

      <section className="card large">
        <h2>Risk Exposure by Event</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={exposureSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2f3f4d" />
            <XAxis dataKey="event" stroke="#9bb0c3" />
            <YAxis stroke="#9bb0c3" domain={[0, 1]} />
            <Tooltip />
            <Legend />
            <Bar dataKey="risk" fill="#06d6a0" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="card">
        <h2>Graph Health</h2>
        <div className="graph-meta-list">
          <div>
            <span>Enabled</span>
            <strong>{summary.enabled ? "Yes" : "No"}</strong>
          </div>
          <div>
            <span>Top label</span>
            <strong>{labels[0]?.label || "-"}</strong>
          </div>
          <div>
            <span>Top relationship</span>
            <strong>{relationshipTypes[0]?.type || "-"}</strong>
          </div>
        </div>
      </section>

      <section className="card full">
        <h2>Impact Explorer</h2>
        <form className="graph-form" onSubmit={handleImpactSubmit}>
          <label>
            Event Id
            <input value={eventId} onChange={(e) => setEventId(e.target.value)} placeholder="e.g. 123" />
          </label>
          <label>
            Manufacturer Id
            <input
              value={manufacturerId}
              onChange={(e) => setManufacturerId(e.target.value)}
              placeholder="default_manufacturer"
            />
          </label>
          <button className="cta" type="submit" disabled={loading}>
            {loading ? "Tracing..." : "Trace Impact"}
          </button>
        </form>
        {error ? <p className="status-note error">{error}</p> : null}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Supplier</th>
                <th>Risk</th>
                <th>Path Weight</th>
                <th>Path</th>
              </tr>
            </thead>
            <tbody>
              {impactItems.map((item) => (
                <tr key={`${item.event_id}-${item.supplier_id || "none"}`}>
                  <td>{item.supplier || "Unmapped supplier"}</td>
                  <td>{item.risk ?? "-"}</td>
                  <td>{item.path_weight ?? "-"}</td>
                  <td>{item.explanation || "-"}</td>
                </tr>
              ))}
              {!impactItems.length ? (
                <tr>
                  <td colSpan="4" className="muted-row">
                    Run a trace to inspect multi-hop exposure paths.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}