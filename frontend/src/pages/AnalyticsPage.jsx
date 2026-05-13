import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Area,
  AreaChart,
} from "recharts";

export default function AnalyticsPage({ events, riskItems, graphSummary }) {
  const [windowSize, setWindowSize] = useState(7);

  const filteredEvents = useMemo(() => events.slice(-windowSize * 5), [events, windowSize]);

  const eventTypeCounts = filteredEvents.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});
  const eventData = Object.entries(eventTypeCounts).map(([name, value]) => ({ name, value }));

  const sourceAgg = filteredEvents.reduce((acc, item) => {
    const key = item.source;
    if (!acc[key]) acc[key] = { source: key, events: 0, avgRisk: 0, totalRisk: 0 };
    acc[key].events += 1;
    const linked = riskItems.find((r) => r.event_id === item.id);
    if (linked) {
      acc[key].totalRisk += linked.risk_score;
    }
    return acc;
  }, {});

  const sourceData = Object.values(sourceAgg).map((row) => ({
    source: row.source,
    events: row.events,
    avgRisk: row.events ? Number((row.totalRisk / row.events).toFixed(3)) : 0,
  }));

  const trendSeries = filteredEvents.map((item, index) => ({
    index: index + 1,
    risk: Number(riskItems.find((row) => row.event_id === item.id)?.risk_score || 0),
  }));

  const clusterSummary = [
    { name: "geopolitical", value: eventTypeCounts.conflict || eventTypeCounts.geopolitical || 0 },
    { name: "logistics", value: eventTypeCounts.logistics_delay || eventTypeCounts.logistics || 0 },
    { name: "commodity", value: eventTypeCounts.commodity_spike || 0 },
  ];

  return (
    <div className="grid analytics-grid">
      <section className="card full analytics-header">
        <div>
          <p className="section-kicker">Deep intelligence analytics</p>
          <h2>Trend detection and cluster analysis</h2>
          <p className="section-copy">Temporal views and distribution panels for operational intelligence review.</p>
        </div>
        <div className="analytics-window-picker">
          {[1, 7, 30].map((item) => (
            <button key={item} type="button" className={`chip ${windowSize === item ? "active" : ""}`} onClick={() => setWindowSize(item)}>
              Last {item}d
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Event Class Distribution</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={eventData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2f3f4d" />
            <XAxis dataKey="name" stroke="#9bb0c3" />
            <YAxis stroke="#9bb0c3" />
            <Tooltip />
            <Bar dataKey="value" fill="#ffd166" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="card">
        <h2>Source vs Risk</h2>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={sourceData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2f3f4d" />
            <XAxis dataKey="source" stroke="#9bb0c3" />
            <YAxis stroke="#9bb0c3" />
            <Tooltip />
            <Legend />
            <Bar dataKey="events" fill="#118ab2" />
            <Bar dataKey="avgRisk" fill="#ef476f" />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="card">
        <h2>Trend detection</h2>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={trendSeries}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2f3f4d" />
            <XAxis dataKey="index" stroke="#9bb0c3" />
            <YAxis stroke="#9bb0c3" domain={[0, 1]} />
            <Tooltip />
            <Area type="monotone" dataKey="risk" stroke="#ef476f" fill="#ef476f33" />
          </AreaChart>
        </ResponsiveContainer>
      </section>

      <section className="card">
        <h2>Cluster overview</h2>
        <div className="cluster-stack">
          {clusterSummary.map((item) => (
            <article className="cluster-tile" key={item.name}>
              <strong>{item.value}</strong>
              <span>{item.name}</span>
            </article>
          ))}
          <article className="cluster-tile">
            <strong>{graphSummary?.relationship_count ?? 0}</strong>
            <span>Graph edges</span>
          </article>
        </div>
      </section>
    </div>
  );
}
