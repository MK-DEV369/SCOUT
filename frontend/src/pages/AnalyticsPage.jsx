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

export default function AnalyticsPage({ events, riskItems }) {
  const eventTypeCounts = events.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});
  const eventData = Object.entries(eventTypeCounts).map(([name, value]) => ({ name, value }));

  const sourceAgg = events.reduce((acc, item) => {
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

  return (
    <div className="grid two">
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
    </div>
  );
}
