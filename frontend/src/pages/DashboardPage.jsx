import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  Treemap,
  XAxis,
  YAxis,
} from "recharts";
import {
  ComposableMap,
  Geographies,
  Geography,
  Marker,
} from "react-simple-maps";

const GEO_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";

const coordinates = {
  germany: [10.4515, 51.1657],
  france: [2.2137, 46.2276],
  india: [78.9629, 20.5937],
  china: [104.1954, 35.8617],
  usa: [-95.7129, 37.0902],
  "united states": [-95.7129, 37.0902],
  japan: [138.2529, 36.2048],
  brazil: [-51.9253, -14.235],
  singapore: [103.8198, 1.3521],
};

export default function DashboardPage({ riskItems, events }) {
  const trendData = riskItems.slice(0, 20).reverse().map((item, idx) => ({
    t: idx + 1,
    score: item.risk_score,
  }));

  const severityMap = riskItems.reduce((acc, row) => {
    acc[row.alert_level] = (acc[row.alert_level] || 0) + 1;
    return acc;
  }, {});

  const heatmapData = Object.entries(severityMap).map(([name, size]) => ({
    name,
    size,
  }));

  const locationPoints = events
    .map((e) => {
      const countries = e.entities?.countries || [];
      const key = countries[0]?.toLowerCase();
      if (!key || !coordinates[key]) return null;
      return {
        id: e.id,
        country: countries[0],
        coordinates: coordinates[key],
      };
    })
    .filter(Boolean)
    .slice(0, 25);

  return (
    <div className="grid two">
      <section className="card large">
        <h2>Risk Trends</h2>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={trendData}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#06d6a0" stopOpacity={0.8} />
                <stop offset="95%" stopColor="#06d6a0" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2f3f4d" />
            <XAxis dataKey="t" stroke="#9bb0c3" />
            <YAxis stroke="#9bb0c3" domain={[0, 1]} />
            <Tooltip />
            <Area type="monotone" dataKey="score" stroke="#06d6a0" fill="url(#trendFill)" />
          </AreaChart>
        </ResponsiveContainer>
      </section>

      <section className="card">
        <h2>Alert Severity Heatmap</h2>
        <ResponsiveContainer width="100%" height={280}>
          <Treemap data={heatmapData} dataKey="size" stroke="#0f1623" fill="#118ab2" />
        </ResponsiveContainer>
      </section>

      <section className="card full">
        <h2>Global Map (Event Countries)</h2>
        <ComposableMap projectionConfig={{ scale: 140 }}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography key={geo.rsmKey} geography={geo} style={{ default: { fill: "#1f2a38", stroke: "#2f3f4d" } }} />
              ))
            }
          </Geographies>
          {locationPoints.map((point) => (
            <Marker key={point.id} coordinates={point.coordinates}>
              <circle r={3} fill="#ef476f" />
            </Marker>
          ))}
        </ComposableMap>
      </section>
    </div>
  );
}
