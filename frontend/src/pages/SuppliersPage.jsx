import { useMemo, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

export default function SuppliersPage({ suppliers, events, riskItems, onSave }) {
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [importance, setImportance] = useState(0.5);

  const supplierRows = useMemo(() => {
    return suppliers.map((supplier) => {
      const linked = riskItems.filter((item) => String(item.supplier_id) === String(supplier.id));
      return {
        ...supplier,
        exposureScore: linked.length ? Number((linked.reduce((acc, item) => acc + (item.risk_score || 0), 0) / linked.length).toFixed(3)) : 0,
        disruptions: linked.length,
        commodities: Array.from(
          new Set(
            linked.flatMap((item) => {
              const event = events.find((entry) => entry.id === item.event_id);
              const commodities = event?.entities_json?.commodities || [];
              return commodities.map((entry) => entry.text);
            })
          )
        ),
      };
    });
  }, [suppliers, events, riskItems]);

  const timeline = useMemo(() => {
    return riskItems.slice(0, 12).reverse().map((item, index) => ({
      t: index + 1,
      risk: Number(item.risk_score ?? 0),
    }));
  }, [riskItems]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    await onSave({ name, country, importance: Number(importance) });
    setName("");
    setCountry("");
    setImportance(0.5);
  }

  return (
    <div className="grid two">
      <section className="card">
        <p className="section-kicker">Supplier intelligence center</p>
        <h2>Register a supplier</h2>
        <form onSubmit={handleSubmit} className="form">
          <label>
            Supplier Name
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
          <label>
            Country
            <input value={country} onChange={(e) => setCountry(e.target.value)} />
          </label>
          <label>
            Importance (0-1)
            <input
              value={importance}
              type="number"
              min="0"
              max="1"
              step="0.1"
              onChange={(e) => setImportance(e.target.value)}
            />
          </label>
          <button className="cta" type="submit">Save Supplier</button>
        </form>
      </section>

      <section className="card">
        <h2>Supplier exposure</h2>
        <div className="supplier-cards">
          {supplierRows.map((supplier) => (
            <article className="supplier-card" key={supplier.id}>
              <header>
                <div>
                  <h3>{supplier.name}</h3>
                  <p>{supplier.country || "Unknown"}</p>
                </div>
                <span className="pill high">Criticality {Number(supplier.importance).toFixed(2)}</span>
              </header>
              <div className="supplier-card__metrics">
                <div><span>Exposure</span><strong>{supplier.exposureScore}</strong></div>
                <div><span>Disruptions</span><strong>{supplier.disruptions}</strong></div>
              </div>
              <div className="chip-row">
                {supplier.commodities.length ? supplier.commodities.map((commodity) => <span className="chip" key={commodity}>{commodity}</span>) : <span className="chip">No commodity links</span>}
              </div>
            </article>
          ))}
        </div>

        <div className="timeline-panel">
          <h3>Supplier risk timeline</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={timeline}>
              <defs>
                <linearGradient id="supplierTimeline" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#118ab2" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#118ab2" stopOpacity={0.08} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2f3f4d" />
              <XAxis dataKey="t" stroke="#9bb0c3" />
              <YAxis stroke="#9bb0c3" domain={[0, 1]} />
              <Tooltip />
              <Area type="monotone" dataKey="risk" stroke="#118ab2" fill="url(#supplierTimeline)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </div>
  );
}
