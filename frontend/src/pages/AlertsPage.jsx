import { useMemo, useState } from "react";

function AlertDetailModal({ alert, event, onClose }) {
  if (!alert) return null;

  const entities = event?.entities || {};
  const summary = event?.summary || "No summary available";

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
                Companies: {(entities.companies || []).join(", ") || "-"}
              </li>

              <li>
                Countries: {(entities.countries || []).join(", ") || "-"}
              </li>

              <li>
                Ports: {(entities.ports || []).join(", ") || "-"}
              </li>

              <li>
                Commodities: {(entities.commodities || []).join(", ") || "-"}
              </li>
            </ul>
          </section>

          <section className="modal-card full-span">
            <h3>Risk propagation</h3>

            <p className="modal-text">
              Risk score: {Number(alert.risk_score ?? 0).toFixed(3)}
            </p>

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
    return alerts.map((alert) => {
      const event = events.find(
        (item) => item.id === alert.event_id
      );

      const risk = riskItems.find(
        (item) => item.event_id === alert.event_id
      );

      const entities = event?.entities || {};

      return {
        ...alert,
        event,
        risk,

        country:
          (entities.countries || [])[0] ||
          event?.location ||
          "Unknown",

        commodity:
          (entities.commodities || [])[0] ||
          "Unknown",

        severityLabel:
          alert.alert_level ||
          risk?.alert_level ||
          "Medium",

        confidence:
          event?.severity ??
          0.5,

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
            {visibleRows.map((row) => (
              <tr
                key={row.risk_id || row.event_id}
                onClick={() => setSelected(row)}
              >
                <td>
                  {row.event?.category || `Event ${row.event_id}`}
                </td>

                <td className="summary-cell">
                  {row.event?.summary || "No summary"}
                </td>

                <td>
                  <span
                    className={`pill ${row.severityLabel.toLowerCase()}`}
                  >
                    {row.severityLabel}
                  </span>
                </td>

                <td>
                  {Number(row.risk_score ?? 0).toFixed(3)}
                </td>

                <td>
                  {row.event?.severity ?? "-"}
                </td>

                <td>
                  {Number(row.confidence ?? 0).toFixed(2)}
                </td>
              </tr>
            ))}
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