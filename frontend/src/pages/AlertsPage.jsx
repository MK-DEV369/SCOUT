import { useMemo, useState } from "react";

const CATEGORY_SEVERITY = {
  conflict: 0.9,
  sanctions: 0.85,
  logistics_delay: 0.78,
  labor_disruption: 0.76,
  commodity_spike: 0.72,
  weather: 0.7,
  cyberattack: 0.84,
  political_instability: 0.74,
  infrastructure_failure: 0.82,
  economic_stress: 0.66,
  // aliases
  Geopolitical: 0.9,
  Logistics: 0.78,
  Environmental: 0.7,
  Economic: 0.66,
};

const CREDIBILITY_BY_SOURCE = {
  newsapi: 0.65,
  gdelt: 0.7,
  freightos: 0.8,
  worldbank: 0.95,
  acled: 0.9,
  fred: 0.95,
};

function cleanHtml(text) {
  if (!text) return "";
  return text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

function formatPercent(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function AlertDetailModal({ alert, event, onClose }) {
  if (!alert) return null;

  const entities = event?.entities || event?.entities_json || {};
  const getSummaryPlaceholder = () => {
    const category = event?.category || "Geopolitical disruption";
    const country = event?.location || "monitored operational lanes";
    const level = alert?.alert_level || "Critical";
    return `An active ${category.replace(/_/g, " ")} alert has been recorded in ${country}. The SCOUT risk engine calculates a ${level.toLowerCase()}-level disruption weight. Procurement managers should review alternate sourcing options and trace exposure paths.`;
  };
  const summary = cleanHtml(event?.summary) || getSummaryPlaceholder();

  const getEntityText = (item) => {
    if (!item) return "";
    if (typeof item === "string") return item;
    return item.text || "";
  };

  const companiesList = (entities.companies || []).map(getEntityText).filter(Boolean);
  const countriesList = (entities.countries || []).map(getEntityText).filter(Boolean);
  const portsList = (entities.ports || []).map(getEntityText).filter(Boolean);
  const commoditiesList = (entities.commodities || []).map(getEntityText).filter(Boolean);

  const riskScore = alert.risk_score ?? 0;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel event-modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-panel__header">
          <div>
            <p className="eyebrow">Event intelligence</p>
            <h2>{event?.category || "Disruption event"}</h2>
          </div>

          <button
            type="button"
            className="sidebar-close"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="modal-columns">
          <section className="modal-card">
            <h3>Original news / event</h3>

            <p className="modal-text">{summary}</p>

            <p className="modal-meta">
              {event?.source || "Unknown source"}
            </p>
          </section>

          <section className="modal-card">
            <h3>Extracted entities</h3>

            <ul className="plain-list compact">
              <li>
                Companies: {companiesList.join(", ") || "-"}
              </li>

              <li>
                Countries: {countriesList.join(", ") || "-"}
              </li>

              <li>
                Ports: {portsList.join(", ") || "-"}
              </li>

              <li>
                Commodities: {commoditiesList.join(", ") || "-"}
              </li>
            </ul>
          </section>

          <section className="modal-card full-span">
            <h3>Risk propagation</h3>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "5px", marginBottom: "15px" }}>
              <span style={{ fontSize: "0.9rem", color: "var(--muted)" }}>
                Risk exposure score:
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ background: "rgba(255, 255, 255, 0.05)", flex: 1, height: "10px", borderRadius: "5px", overflow: "hidden", border: "1px solid var(--line)" }}>
                  <div style={{ 
                    background: riskScore >= 0.8 ? "#ef476f" : riskScore >= 0.6 ? "#ffd166" : "#06d6a0", 
                    width: `${Math.round(riskScore * 100)}%`, 
                    height: "100%", 
                    borderRadius: "5px" 
                  }} />
                </div>
                <strong style={{ fontSize: "1.1rem", color: "#eff5ff" }}>
                  {formatPercent(riskScore)}
                </strong>
              </div>
            </div>

            <p className="modal-text">
              This event may impact upstream suppliers and logistics lanes.
            </p>
          </section>

          <section className="modal-card full-span">
            <h3>Mitigation</h3>

            <ul className="plain-list compact">
              <li>Re-route exposed shipments through alternate ports.</li>

              <li>Increase safety stock on critical commodities.</li>

              <li>Prioritize high-margin or time-sensitive orders.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

export default function AlertsPage({
  alerts,
  events,
  riskItems,
}) {
  const [selected, setSelected] = useState(null);

  const [filters, setFilters] = useState({
    country: "",
    commodity: "",
    severity: "",
    eventType: "",
  });

  const rows = useMemo(() => {
    const getEntityText = (item) => {
      if (!item) return "";
      if (typeof item === "string") return item;
      return item.text || "";
    };
    return alerts.map((alert) => {
      const event = events.find(
        (item) => item.id === alert.event_id
      );

      const risk = riskItems.find(
        (item) => item.event_id === alert.event_id
      );

      const entities = event?.entities || event?.entities_json || {};
      const countries = entities.countries || [];
      const commodities = entities.commodities || [];
      const countryText = countries[0] ? getEntityText(countries[0]) : "";
      const commodityText = commodities[0] ? getEntityText(commodities[0]) : "";

      const resolvedSeverity = 
        event?.severity ||
        (event?.category ? CATEGORY_SEVERITY[event.category] : null) ||
        (risk?.severity) ||
        0.5;

      const resolvedConfidence =
        event?.classifier_confidence ||
        (event?.source ? CREDIBILITY_BY_SOURCE[event.source.toLowerCase()] : null) ||
        0.5;

      return {
        ...alert,
        event,
        risk,

        country:
          countryText ||
          event?.location ||
          "Unknown",

        commodity:
          commodityText ||
          "Unknown",

        severityLabel:
          alert.alert_level ||
          risk?.alert_level ||
          "Medium",

        severity: resolvedSeverity,
        confidence: resolvedConfidence,

        source:
          event?.source ||
          "Unknown",
      };
    });
  }, [alerts, events, riskItems]);

  const visibleRows = rows.filter((row) => {
    const severityValue =
      row.severityLabel.toLowerCase();

    return (
      (!filters.country ||
        row.country
          .toLowerCase()
          .includes(filters.country.toLowerCase())) &&

      (!filters.commodity ||
        row.commodity
          .toLowerCase()
          .includes(filters.commodity.toLowerCase())) &&

      (!filters.eventType ||
        (row.event?.category || "")
          .toLowerCase()
          .includes(filters.eventType.toLowerCase())) &&

      (!filters.severity ||
        severityValue.includes(filters.severity.toLowerCase()))
    );
  });

  return (
    <section className="card full">
      <div className="page-head">
        <div>
          <p className="section-kicker">
            SOC threat console
          </p>

          <h2>Ranked Disruption Alerts</h2>
        </div>

        <div className="filter-grid">
          {Object.entries(filters).map(([key, value]) => (
            <input
              key={key}
              value={value}
              onChange={(e) =>
                setFilters((current) => ({
                  ...current,
                  [key]: e.target.value,
                }))
              }
              placeholder={key.replace(/([A-Z])/g, " $1")}
            />
          ))}
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Summary</th>
              <th>Risk</th>
              <th>Exposure</th>
              <th>Severity</th>
              <th>Confidence</th>
            </tr>
          </thead>

          <tbody>
            {visibleRows.map((row) => {
              const exposureVal = row.risk_score ?? 0;
              const severityVal = row.severity ?? 0.5;
              const confidenceVal = row.confidence ?? 0.5;

              // Color helpers
              const getMetricColor = (val) => {
                if (val >= 0.8) return "#ef476f"; // red/critical
                if (val >= 0.6) return "#ffd166"; // yellow/high-medium
                return "#06d6a0"; // green/low-medium
              };

              const getSummaryPlaceholder = (row) => {
                const category = row.event?.category || "Geopolitical disruption";
                const country = row.country && row.country !== "Unknown" ? `in ${row.country}` : "across monitored logistics channels";
                const importance = row.severityLabel || "High";
                return `An active ${category.replace(/_/g, " ")} warning has been logged ${country}. Downstream risk analysis propagates a ${importance.toLowerCase()}-level exposure trace to linked suppliers. Operational adjustments and alternate routing reviews are recommended.`;
              };

              const rowSummary = cleanHtml(row.event?.summary) || getSummaryPlaceholder(row);

              return (
                <tr
                  key={row.risk_id || row.event_id}
                  onClick={() => setSelected(row)}
                >
                  <td>
                    {row.event?.category || `Event ${row.event_id}`}
                  </td>

                  <td className="summary-cell" title={rowSummary}>
                    {rowSummary}
                  </td>

                  <td>
                    <span
                      className={`pill ${row.severityLabel.toLowerCase()}`}
                    >
                      {row.severityLabel}
                    </span>
                  </td>

                  {/* Exposure Column */}
                  <td style={{ verticalAlign: "middle" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "110px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", fontWeight: "600", color: "#eff5ff" }}>
                        <span>{formatPercent(exposureVal)}</span>
                      </div>
                      <div style={{ background: "rgba(255, 255, 255, 0.05)", height: "6px", borderRadius: "3px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ 
                          background: getMetricColor(exposureVal), 
                          width: `${Math.round(exposureVal * 100)}%`, 
                          height: "100%", 
                          borderRadius: "3px",
                          boxShadow: `0 0 6px ${getMetricColor(exposureVal)}`
                        }} />
                      </div>
                    </div>
                  </td>

                  {/* Severity Column */}
                  <td style={{ verticalAlign: "middle" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "110px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", fontWeight: "600", color: "#eff5ff" }}>
                        <span>{formatPercent(severityVal)}</span>
                      </div>
                      <div style={{ background: "rgba(255, 255, 255, 0.05)", height: "6px", borderRadius: "3px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ 
                          background: getMetricColor(severityVal), 
                          width: `${Math.round(severityVal * 100)}%`, 
                          height: "100%", 
                          borderRadius: "3px",
                          boxShadow: `0 0 6px ${getMetricColor(severityVal)}`
                        }} />
                      </div>
                    </div>
                  </td>

                  {/* Confidence Column */}
                  <td style={{ verticalAlign: "middle" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px", width: "110px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", fontWeight: "600", color: "#eff5ff" }}>
                        <span>{formatPercent(confidenceVal)}</span>
                      </div>
                      <div style={{ background: "rgba(255, 255, 255, 0.05)", height: "6px", borderRadius: "3px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" }}>
                        <div style={{ 
                          background: getMetricColor(confidenceVal), 
                          width: `${Math.round(confidenceVal * 100)}%`, 
                          height: "100%", 
                          borderRadius: "3px",
                          boxShadow: `0 0 6px ${getMetricColor(confidenceVal)}`
                        }} />
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {selected ? (
        <AlertDetailModal
          alert={selected}
          event={selected.event}
          onClose={() => setSelected(null)}
        />
      ) : null}
    </section>
  );
}