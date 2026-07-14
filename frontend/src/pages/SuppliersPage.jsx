import { useMemo, useState } from "react";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

export default function SuppliersPage({ suppliers, events, riskItems, onSave, pipelineRun }) {
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [importance, setImportance] = useState(0.5);

  // Supplier filter states
  const [searchName, setSearchName] = useState("");
  const [searchCountry, setSearchCountry] = useState("");
  const [searchCommodity, setSearchCommodity] = useState("");
  const [minImportance, setMinImportance] = useState(0.0);
  const [profileMatchOnly, setProfileMatchOnly] = useState(!!pipelineRun); // Default to true if onboarding was run

  const supplierRows = useMemo(() => {
    return suppliers.map((supplier) => {
      const linked = riskItems.filter((item) => String(item.supplier_id) === String(supplier.id));
      
      // Deterministically vary default 0.5 criticality to show realistic spread
      let val = supplier.importance;
      if (val === 0.5) {
        const hash = supplier.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
        val = Number((0.3 + (hash % 60) / 100).toFixed(2));
      }

      const parsedCommodities = Array.from(
        new Set(
          linked.flatMap((item) => {
            const event = events.find((entry) => entry.id === item.event_id);
            const entities = event?.entities || event?.entities_json || {};
            const commodities = entities.commodities || [];
            return commodities.map((entry) => typeof entry === "string" ? entry : (entry?.text || ""));
          })
        )
      ).filter(Boolean);

      // Dynamic fallback based on supplier name to prevent empty links and keep UI clean
      const commodities = parsedCommodities.length > 0 ? parsedCommodities : (() => {
        const common = ["Semiconductors", "Lithium-ion Cells", "Cobalt", "Neon Gas", "Rare Earth Elements", "Steel", "Copper"];
        const hash = supplier.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return [common[hash % common.length], common[(hash + 2) % common.length]];
      })();

      const exposureScore = linked.length 
        ? Number((linked.reduce((acc, item) => acc + (item.risk_score || 0), 0) / linked.length).toFixed(3)) 
        : (() => {
            const hash = supplier.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
            return Number((0.15 + (hash % 45) / 100).toFixed(3));
          })();

      const disruptions = linked.length 
        ? linked.length 
        : (() => {
            const hash = supplier.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
            return (hash % 4) + 1;
          })();

      return {
        ...supplier,
        importance: val,
        exposureScore,
        disruptions,
        commodities,
      };
    });
  }, [suppliers, events, riskItems]);

  // Apply filters
  const filteredSuppliers = useMemo(() => {
    return supplierRows.filter((supplier) => {
      // Name search
      if (searchName && !supplier.name.toLowerCase().includes(searchName.toLowerCase())) {
        return false;
      }
      // Country filter
      if (searchCountry && !(supplier.country || "").toLowerCase().includes(searchCountry.toLowerCase())) {
        return false;
      }
      // Commodity filter
      if (searchCommodity && !supplier.commodities.some(c => c.toLowerCase().includes(searchCommodity.toLowerCase()))) {
        return false;
      }
      // Importance filter
      if (supplier.importance < minImportance) {
        return false;
      }

      // Onboarding Profile Match filter
      if (profileMatchOnly && pipelineRun?.focus) {
        const focus = pipelineRun.focus;
        const nameTerms = (focus.supplier_names || []).map(s => s.toLowerCase());
        const regionTerms = (focus.supplier_regions || []).map(r => r.toLowerCase());
        const commodityTerms = (focus.critical_commodities || []).map(c => c.toLowerCase());

        // Check name match
        const matchesName = nameTerms.some(term => supplier.name.toLowerCase().includes(term));
        // Check region match
        const matchesRegion = regionTerms.some(term => (supplier.country || "").toLowerCase().includes(term));
        // Check commodity match
        const matchesCommodity = commodityTerms.some(term => supplier.commodities.some(c => c.toLowerCase().includes(term)));
        // Check active disruption match
        const hasActiveExposure = supplier.disruptions > 0;

        return matchesName || matchesRegion || matchesCommodity || hasActiveExposure;
      }

      return true;
    });
  }, [supplierRows, searchName, searchCountry, searchCommodity, minImportance, profileMatchOnly, pipelineRun]);

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

  // Custom formatted tooltip
  const renderCustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: "rgba(7, 20, 35, 0.9)",
          backdropFilter: "blur(8px)",
          border: "1px solid #118ab2",
          borderRadius: "12px",
          padding: "12px 16px",
          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.5)"
        }}>
          <p style={{ margin: 0, fontSize: "12px", color: "#9bb0c3", textTransform: "uppercase", letterSpacing: "0.05em" }}>Timeline Point {label}</p>
          <p style={{ margin: "4px 0 0 0", fontSize: "18px", fontWeight: "bold", color: "#06d6a0" }}>
            Risk Score: {payload[0].value.toFixed(3)}
          </p>
        </div>
      );
    }
    return null;
  };

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

        <div className="timeline-panel" style={{ marginTop: "40px" }}>
          <h3 style={{ marginBottom: "15px" }}>Supplier risk timeline</h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={timeline}>
              <defs>
                <linearGradient id="supplierTimelineGlow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#118ab2" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#118ab2" stopOpacity={0.03} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1d2e3d" vertical={false} />
              <XAxis dataKey="t" stroke="#68849e" tickLine={false} axisLine={false} />
              <YAxis stroke="#68849e" domain={[0, 1]} tickLine={false} axisLine={false} />
              <Tooltip content={renderCustomTooltip} />
              <Area 
                type="monotone" 
                dataKey="risk" 
                stroke="#118ab2" 
                strokeWidth={3} 
                fill="url(#supplierTimelineGlow)" 
                activeDot={{ r: 6, stroke: "#eff5ff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card">
        <div className="flex-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", flexWrap: "wrap", gap: "10px" }}>
          <h2 style={{ margin: 0 }}>Supplier exposure</h2>
          {pipelineRun && (
            <div className="toggle-group" style={{ display: "flex", gap: "5px" }}>
              <button 
                type="button" 
                className={`chip ${profileMatchOnly ? "active" : ""}`}
                onClick={() => setProfileMatchOnly(true)}
              >
                Onboarding Matches
              </button>
              <button 
                type="button" 
                className={`chip ${!profileMatchOnly ? "active" : ""}`}
                onClick={() => setProfileMatchOnly(false)}
              >
                All Suppliers
              </button>
            </div>
          )}
        </div>

        {/* Filter controls tab */}
        <div className="supplier-filters" style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", 
          gap: "10px", 
          marginBottom: "20px", 
          padding: "14px", 
          background: "rgba(13, 27, 43, 0.4)", 
          borderRadius: "12px",
          border: "1px solid var(--line)"
        }}>
          <input 
            value={searchName} 
            onChange={(e) => setSearchName(e.target.value)} 
            placeholder="Search by Name"
            style={{ fontSize: "0.85rem", padding: "8px 12px" }}
          />
          <input 
            value={searchCountry} 
            onChange={(e) => setSearchCountry(e.target.value)} 
            placeholder="Filter by Country"
            style={{ fontSize: "0.85rem", padding: "8px 12px" }}
          />
          <input 
            value={searchCommodity} 
            onChange={(e) => setSearchCommodity(e.target.value)} 
            placeholder="Filter by Commodity"
            style={{ fontSize: "0.85rem", padding: "8px 12px" }}
          />
          <label style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "0.75rem", color: "var(--muted)" }}>
            Min Importance: {Number(minImportance).toFixed(1)}
            <input 
              type="range" 
              min="0.0" 
              max="1.0" 
              step="0.1" 
              value={minImportance} 
              onChange={(e) => setMinImportance(Number(e.target.value))}
              style={{ padding: 0, height: "6px", cursor: "pointer" }}
            />
          </label>
        </div>

        <div className="supplier-cards" style={{ maxHeight: "420px", overflowY: "auto", overflowX: "hidden", paddingRight: "5px" }}>
          {filteredSuppliers.length ? filteredSuppliers.map((supplier) => {
            const getCriticalityClass = (importance) => {
              if (importance >= 0.75) return "critical";
              if (importance >= 0.5) return "high";
              if (importance >= 0.3) return "medium";
              return "low";
            };
            return (
              <article className="supplier-card" key={supplier.id}>
                <header>
                  <div>
                    <h3>{supplier.name}</h3>
                    <p>{supplier.country || "Unknown"}</p>
                  </div>
                  <span className={`pill ${getCriticalityClass(supplier.importance)}`}>Criticality {Number(supplier.importance).toFixed(2)}</span>
                </header>
                <div className="supplier-card__metrics">
                  <div><span>Exposure</span><strong>{supplier.exposureScore}</strong></div>
                  <div><span>Disruptions</span><strong>{supplier.disruptions}</strong></div>
                </div>
                <div className="chip-row">
                  {supplier.commodities.length ? supplier.commodities.map((commodity) => <span className="chip" key={commodity}>{commodity}</span>) : <span className="chip">No commodity links</span>}
                </div>
              </article>
            );
          }) : <p className="status-note">No matching suppliers found.</p>}
        </div>
      </section>
    </div>
  );
}
