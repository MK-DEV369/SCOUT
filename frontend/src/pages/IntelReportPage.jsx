import { useMemo } from "react";

function formatPercent(value) {
  return `${Math.round((Number(value) || 0) * 100)}%`;
}

function joinList(values, fallback = "-") {
  if (!Array.isArray(values) || !values.length) return fallback;
  return values.join(", ");
}

function topAlertLevel(rows) {
  const critical = rows.find((row) => (row.alert_level || "").toLowerCase() === "critical");
  const high = rows.find((row) => (row.alert_level || "").toLowerCase() === "high");
  return critical?.alert_level || high?.alert_level || rows[0]?.alert_level || "Medium";
}

function deriveImpactSummary({ organization, industry, event, countries, ports, commodities, suppliers }) {
  const location = countries[0] || event?.location || "key operating regions";
  const port = ports[0] || "critical ports";
  const commodity = commodities[0] || "critical commodities";
  const supplier = suppliers[0] || "critical suppliers";
  return `${organization} in ${industry} faces disruption exposure through ${location} and ${port}, which can delay ${commodity} flows and affect ${supplier}.`;
}

export default function IntelReportPage({ alerts, events, riskItems, suppliers, graphSummary, pipelineRun }) {
  const topRisks = useMemo(
    () => [...riskItems].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0)).slice(0, 5),
    [riskItems]
  );

  const criticalAlerts = alerts.filter((item) => (item.alert_level || "").toLowerCase() === "critical").length;
  const topRisk = topRisks[0];
  const topEvent = events.find((item) => item.id === topRisk?.event_id);
  const entities = topEvent?.entities_json || {};
  const countries = (entities.countries || []).map((item) => item.text);
  const ports = (entities.ports || []).map((item) => item.text);
  const commodities = (entities.commodities || []).map((item) => item.text);
  const impactedSuppliers = topRisks.map((item) => item.supplier_name).filter(Boolean);

  const organization = pipelineRun?.focus?.organization_name || pipelineRun?.organization || pipelineRun?.focus?.company_domain || "Your organization";
  const industry = pipelineRun?.focus?.industry_domain || pipelineRun?.focus?.company_domain || "operating domain";
  const regions = pipelineRun?.focus?.operational_regions || pipelineRun?.focus?.supplier_regions || [];
  const focusPorts = pipelineRun?.focus?.critical_ports || [];
  const focusCommodities = pipelineRun?.focus?.critical_commodities || [];
  const focusSuppliers = pipelineRun?.focus?.supplier_names || [];

  const operationalSummary = useMemo(
    () =>
      deriveImpactSummary({
        organization,
        industry,
        event: topEvent,
        countries,
        ports,
        commodities,
        suppliers: impactedSuppliers,
      }),
    [organization, industry, topEvent, countries, ports, commodities, impactedSuppliers]
  );

  const rootCause = useMemo(() => {
    const causeParts = [];
    if (topEvent?.location) causeParts.push(topEvent.location);
    if (countries[0] && countries[0] !== topEvent?.location) causeParts.push(countries[0]);
    if (ports[0]) causeParts.push(`port ${ports[0]}`);
    if (topRisk?.alert_level) causeParts.push(`${topRisk.alert_level.toLowerCase()} risk`);
    return causeParts.length ? causeParts.join(", ") : "Current root cause is still being resolved from live inputs.";
  }, [countries, ports, topEvent?.location, topRisk?.alert_level]);

  const summary = useMemo(
    () => [
      `${organization} is being monitored across ${events.length} events and ${suppliers.length} suppliers.`,
      `${alerts.length} live alerts with ${criticalAlerts} critical items are currently active.`,
      `${graphSummary?.relationship_count ?? 0} graph relationships are materialized for exposure tracing.`,
    ],
    [alerts.length, criticalAlerts, events.length, graphSummary?.relationship_count, organization, suppliers.length]
  );

  const businessImpact = useMemo(() => {
    if (!topEvent) {
      return "No active event has been selected for executive impact analysis yet.";
    }
    const score = Number(topRisk?.risk_score ?? 0);
    const low = Math.max(1, Math.round(score * 5));
    const high = low + Math.max(2, Math.round(score * 6));
    const alertLevel = topRisk?.alert_level || topAlertLevel(alerts);
    return `${industry} operations may see a ${low}–${high} day disruption window if the current ${alertLevel.toLowerCase()}-level exposure is not mitigated.`;
  }, [alerts, industry, topEvent, topRisk?.alert_level, topRisk?.risk_score]);

  const recommendedActions = useMemo(() => {
    const actions = [];
    if (focusPorts.length || ports.length) actions.push(`Reroute through ${focusPorts[0] || "alternate ports"}.`);
    if (focusCommodities.length || commodities.length) actions.push(`Increase buffers for ${focusCommodities[0] || commodities[0] || "critical commodities"}.`);
    if (focusSuppliers.length || impactedSuppliers.length) actions.push(`Prioritize alternate suppliers such as ${focusSuppliers[0] || impactedSuppliers[0] || "backup vendors"}.`);
    actions.push("Monitor multi-hop exposure on the graph explorer before escalating procurement decisions.");
    return actions.slice(0, 4);
  }, [commodities, focusCommodities, focusPorts, focusSuppliers, impactedSuppliers, ports.length]);

  const predictedDelay = useMemo(() => {
    const score = Number(topRisk?.risk_score ?? 0);
    const low = Math.max(1, Math.round(score * 5));
    const high = low + Math.max(2, Math.round(score * 6));
    return `${low}–${high} day delay window`;
  }, [topRisk?.risk_score]);

  return (
    <div className="report-page">
      <section className="card report-cover">
        <div>
          <p className="section-kicker">Executive intelligence report</p>
          <h2>SCOUT Operational Summary</h2>
          <p className="section-copy">A PDF-style intelligence brief for leadership review.</p>
        </div>
        <button className="cta" type="button" onClick={() => window.print()}>
          Print / Save PDF
        </button>
        <div className="graph-meta-list report-header-grid">
          <div><span>Organization</span><strong>{organization}</strong></div>
          <div><span>Industry</span><strong>{industry}</strong></div>
          <div><span>Monitored regions</span><strong>{joinList(regions)}</strong></div>
          <div><span>Alert state</span><strong>{topRisk?.alert_level || topAlertLevel(alerts)}</strong></div>
        </div>
      </section>

      <section className="card">
        <p className="section-kicker">Why this organization should care</p>
        <h2>Operational impact summary</h2>
        <p className="modal-text">{operationalSummary}</p>
        <ul className="plain-list">
          {summary.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Root cause</h2>
        <p className="modal-text">{rootCause}</p>
        <p className="modal-text">{topEvent?.summary || "The current event summary will appear here once the pipeline has a selected event."}</p>
      </section>

      <section className="card">
        <h2>Exposed supply chain</h2>
        <div className="report-list">
          <article className="report-item">
            <strong>{joinList(focusSuppliers, "Critical suppliers")}</strong>
            <span>{joinList(focusPorts, "Critical ports")}</span>
            <span>{joinList(focusCommodities, "Critical commodities")}</span>
          </article>
          <article className="report-item">
            <strong>{joinList(impactedSuppliers, "Live affected suppliers")}</strong>
            <span>{joinList(countries, "Affected countries")}</span>
            <span>{joinList(ports, "Affected ports")}</span>
          </article>
        </div>
      </section>

      <section className="card">
        <h2>Top risks</h2>
        <div className="report-list">
          {topRisks.map((risk) => (
            <article className="report-item" key={risk.event_id}>
              <strong>Event {risk.event_id}</strong>
              <span>Risk {Number(risk.risk_score || 0).toFixed(3)}</span>
              <span>Alert {risk.alert_level}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Risk level</h2>
        <div className="graph-meta-list">
          <div><span>Risk level</span><strong>{topRisk?.alert_level || topAlertLevel(alerts)}</strong></div>
          <div><span>Confidence</span><strong>{topRisk ? Number(topRisk.classifier_confidence ?? 0).toFixed(2) : "0.00"}</strong></div>
          <div><span>Predicted delay</span><strong>{predictedDelay}</strong></div>
        </div>
      </section>

      <section className="card">
        <h2>Confidence and exposure</h2>
        <div className="graph-meta-list">
          <div><span>Alerts</span><strong>{alerts.length}</strong></div>
          <div><span>Critical alerts</span><strong>{criticalAlerts}</strong></div>
          <div><span>Exposure paths</span><strong>{graphSummary?.relationship_count ?? 0}</strong></div>
          <div><span>Source coverage</span><strong>{formatPercent(events.length / Math.max(suppliers.length || 1, 1))}</strong></div>
        </div>
      </section>

      <section className="card full">
        <h2>Recommended actions</h2>
        <ul className="plain-list">
          {recommendedActions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="card full">
        <h2>Executive mitigation summary</h2>
        <p className="modal-text">
          SCOUT recommends rerouting high-priority shipments, increasing buffer stock, and validating alternate suppliers before the next procurement cycle.
        </p>
        <p className="modal-text">{businessImpact}</p>
      </section>
    </div>
  );
}

// import { useMemo } from "react";

// function formatPercent(value) {
//   return `${Math.round((Number(value) || 0) * 100)}%`;
// }

// function joinList(values, fallback = "—") {
//   if (!Array.isArray(values) || !values.length) return fallback;
//   return values.join(", ");
// }

// function topAlertLevel(rows) {
//   const critical = rows.find((row) => (row.alert_level || "").toLowerCase() === "critical");
//   const high = rows.find((row) => (row.alert_level || "").toLowerCase() === "high");
//   return critical?.alert_level || high?.alert_level || rows[0]?.alert_level || "Medium";
// }

// function deriveImpactSummary({ organization, industry, event, countries, ports, commodities, suppliers }) {
//   const location = countries[0] || event?.location || "key operating regions";
//   const port = ports[0] || "critical ports";
//   const commodity = commodities[0] || "critical commodities";
//   const supplier = suppliers[0] || "critical suppliers";
//   return `${organization} in ${industry} faces disruption exposure through ${location} and ${port}, which can delay ${commodity} flows and affect ${supplier}.`;
// }

// const ALERT_META = {
//   critical: { label: "Critical", color: "#E24B4A", bg: "#FCEBEB", textColor: "#501313" },
//   high:     { label: "High",     color: "#EF9F27", bg: "#FAEEDA", textColor: "#412402" },
//   medium:   { label: "Medium",   color: "#378ADD", bg: "#E6F1FB", textColor: "#042C53" },
//   low:      { label: "Low",      color: "#1D9E75", bg: "#E1F5EE", textColor: "#04342C" },
// };

// function alertMeta(level = "") {
//   return ALERT_META[(level || "").toLowerCase()] || ALERT_META.medium;
// }

// function AlertBadge({ level }) {
//   const meta = alertMeta(level);
//   return (
//     <span style={{
//       display: "inline-flex",
//       alignItems: "center",
//       gap: 5,
//       padding: "3px 10px",
//       borderRadius: 20,
//       fontSize: 11,
//       fontWeight: 600,
//       letterSpacing: "0.06em",
//       textTransform: "uppercase",
//       background: meta.bg,
//       color: meta.textColor,
//       border: `1px solid ${meta.color}40`,
//     }}>
//       <span style={{
//         width: 6, height: 6, borderRadius: "50%",
//         background: meta.color, flexShrink: 0,
//       }} />
//       {meta.label}
//     </span>
//   );
// }

// function SectionLabel({ children }) {
//   return (
//     <p style={{
//       fontSize: 10,
//       fontWeight: 700,
//       letterSpacing: "0.14em",
//       textTransform: "uppercase",
//       color: "var(--color-text-tertiary)",
//       margin: "0 0 6px",
//     }}>
//       {children}
//     </p>
//   );
// }

// function MetricCard({ label, value, accent }) {
//   return (
//     <div style={{
//       background: "var(--color-background-secondary)",
//       borderRadius: 10,
//       padding: "14px 16px",
//       borderLeft: accent ? `3px solid ${accent}` : "none",
//     }}>
//       <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", margin: "0 0 4px", letterSpacing: "0.04em" }}>{label}</p>
//       <p style={{ fontSize: 20, fontWeight: 600, margin: 0, color: "var(--color-text-primary)", fontVariantNumeric: "tabular-nums" }}>{value}</p>
//     </div>
//   );
// }

// function RiskRow({ risk, index }) {
//   const score = Number(risk.risk_score || 0);
//   const meta = alertMeta(risk.alert_level);
//   const pct = Math.round(score * 100);
//   return (
//     <div style={{
//       display: "grid",
//       gridTemplateColumns: "20px 1fr auto auto",
//       alignItems: "center",
//       gap: 12,
//       padding: "10px 0",
//       borderBottom: "0.5px solid var(--color-border-tertiary)",
//     }}>
//       <span style={{ fontSize: 11, color: "var(--color-text-tertiary)", fontVariantNumeric: "tabular-nums" }}>
//         {String(index + 1).padStart(2, "0")}
//       </span>
//       <div>
//         <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>Event {risk.event_id}</p>
//         <div style={{ marginTop: 5, height: 3, borderRadius: 2, background: "var(--color-background-secondary)", overflow: "hidden" }}>
//           <div style={{ width: `${pct}%`, height: "100%", borderRadius: 2, background: meta.color }} />
//         </div>
//       </div>
//       <span style={{ fontSize: 12, color: "var(--color-text-secondary)", fontVariantNumeric: "tabular-nums" }}>
//         {score.toFixed(3)}
//       </span>
//       <AlertBadge level={risk.alert_level} />
//     </div>
//   );
// }

// function Divider() {
//   return <div style={{ borderTop: "0.5px solid var(--color-border-tertiary)", margin: "28px 0" }} />;
// }

// function FieldRow({ label, value }) {
//   return (
//     <div style={{
//       display: "flex",
//       justifyContent: "space-between",
//       alignItems: "flex-start",
//       gap: 16,
//       padding: "8px 0",
//       borderBottom: "0.5px solid var(--color-border-tertiary)",
//     }}>
//       <span style={{ fontSize: 12, color: "var(--color-text-secondary)", flexShrink: 0 }}>{label}</span>
//       <span style={{ fontSize: 12, fontWeight: 500, textAlign: "right", color: "var(--color-text-primary)" }}>{value}</span>
//     </div>
//   );
// }

// export default function IntelReportPage({ alerts = [], events = [], riskItems = [], suppliers = [], graphSummary, pipelineRun }) {
//   const topRisks = useMemo(
//     () => [...riskItems].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0)).slice(0, 5),
//     [riskItems]
//   );

//   const criticalAlerts = alerts.filter((item) => (item.alert_level || "").toLowerCase() === "critical").length;
//   const topRisk = topRisks[0];
//   const topEvent = events.find((item) => item.id === topRisk?.event_id);
//   const entities = topEvent?.entities_json || {};
//   const countries = (entities.countries || []).map((item) => item.text);
//   const ports = (entities.ports || []).map((item) => item.text);
//   const commodities = (entities.commodities || []).map((item) => item.text);
//   const impactedSuppliers = topRisks.map((item) => item.supplier_name).filter(Boolean);

//   const organization = pipelineRun?.focus?.organization_name || pipelineRun?.organization || pipelineRun?.focus?.company_domain || "Your Organization";
//   const industry = pipelineRun?.focus?.industry_domain || pipelineRun?.focus?.company_domain || "Operating Domain";
//   const regions = pipelineRun?.focus?.operational_regions || pipelineRun?.focus?.supplier_regions || [];
//   const focusPorts = pipelineRun?.focus?.critical_ports || [];
//   const focusCommodities = pipelineRun?.focus?.critical_commodities || [];
//   const focusSuppliers = pipelineRun?.focus?.supplier_names || [];

//   const currentAlertLevel = topRisk?.alert_level || topAlertLevel(alerts);
//   const alertM = alertMeta(currentAlertLevel);

//   const operationalSummary = useMemo(
//     () => deriveImpactSummary({ organization, industry, event: topEvent, countries, ports, commodities, suppliers: impactedSuppliers }),
//     [organization, industry, topEvent, countries, ports, commodities, impactedSuppliers]
//   );

//   const rootCause = useMemo(() => {
//     const parts = [];
//     if (topEvent?.location) parts.push(topEvent.location);
//     if (countries[0] && countries[0] !== topEvent?.location) parts.push(countries[0]);
//     if (ports[0]) parts.push(`port ${ports[0]}`);
//     if (topRisk?.alert_level) parts.push(`${topRisk.alert_level.toLowerCase()} risk`);
//     return parts.length ? parts.join(" · ") : "Root cause analysis pending live inputs.";
//   }, [countries, ports, topEvent?.location, topRisk?.alert_level]);

//   const predictedDelay = useMemo(() => {
//     const score = Number(topRisk?.risk_score ?? 0);
//     const low = Math.max(1, Math.round(score * 5));
//     const high = low + Math.max(2, Math.round(score * 6));
//     return `${low}–${high} days`;
//   }, [topRisk?.risk_score]);

//   const businessImpact = useMemo(() => {
//     if (!topEvent) return "No active event selected for executive impact analysis.";
//     const score = Number(topRisk?.risk_score ?? 0);
//     const low = Math.max(1, Math.round(score * 5));
//     const high = low + Math.max(2, Math.round(score * 6));
//     const level = topRisk?.alert_level || topAlertLevel(alerts);
//     return `${industry} operations may see a ${low}–${high} day disruption window if the current ${level.toLowerCase()}-level exposure is not mitigated.`;
//   }, [alerts, industry, topEvent, topRisk?.alert_level, topRisk?.risk_score]);

//   const recommendedActions = useMemo(() => {
//     const actions = [];
//     if (focusPorts.length || ports.length) actions.push({ icon: "🔀", text: `Reroute through ${focusPorts[0] || "alternate ports"}.` });
//     if (focusCommodities.length || commodities.length) actions.push({ icon: "📦", text: `Increase buffers for ${focusCommodities[0] || commodities[0] || "critical commodities"}.` });
//     if (focusSuppliers.length || impactedSuppliers.length) actions.push({ icon: "🤝", text: `Prioritize alternate suppliers such as ${focusSuppliers[0] || impactedSuppliers[0] || "backup vendors"}.` });
//     actions.push({ icon: "🔍", text: "Monitor multi-hop exposure on the graph explorer before escalating procurement decisions." });
//     return actions.slice(0, 4);
//   }, [commodities, focusCommodities, focusPorts, focusSuppliers, impactedSuppliers, ports.length]);

//   const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

//   return (
//     <div style={{ fontFamily: "var(--font-sans)", color: "var(--color-text-primary)", maxWidth: 800, margin: "0 auto", padding: "0 0 60px" }}>

//       {/* ── Cover ── */}
//       <div style={{
//         position: "relative",
//         borderRadius: 16,
//         overflow: "hidden",
//         background: "var(--color-background-secondary)",
//         border: "0.5px solid var(--color-border-tertiary)",
//         padding: "36px 40px 32px",
//         marginBottom: 2,
//       }}>
//         {/* Alert stripe */}
//         <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 4, background: alertM.color }} />

//         <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
//           <div>
//             <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-text-tertiary)", margin: "0 0 10px" }}>
//               Scout · Executive Intelligence Report
//             </p>
//             <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 6px", lineHeight: 1.2 }}>
//               Operational Risk Brief
//             </h1>
//             <p style={{ fontSize: 14, color: "var(--color-text-secondary)", margin: "0 0 20px" }}>
//               {organization} · {industry} · {today}
//             </p>
//             <AlertBadge level={currentAlertLevel} />
//           </div>
//           <button
//             type="button"
//             onClick={() => window.print()}
//             style={{
//               display: "flex", alignItems: "center", gap: 7,
//               padding: "9px 18px", borderRadius: 8,
//               border: "0.5px solid var(--color-border-secondary)",
//               background: "var(--color-background-primary)",
//               color: "var(--color-text-primary)",
//               fontSize: 13, fontWeight: 500, cursor: "pointer",
//               fontFamily: "var(--font-sans)",
//             }}
//           >
//             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
//               <polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>
//             </svg>
//             Export PDF
//           </button>
//         </div>

//         <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginTop: 28 }}>
//           <MetricCard label="Monitored events" value={events.length} />
//           <MetricCard label="Active alerts" value={alerts.length} />
//           <MetricCard label="Critical alerts" value={criticalAlerts} accent="#E24B4A" />
//           <MetricCard label="Exposure paths" value={graphSummary?.relationship_count ?? 0} />
//           <MetricCard label="Suppliers tracked" value={suppliers.length} />
//         </div>
//       </div>

//       {/* Spacer */}
//       <div style={{ height: 20 }} />

//       {/* ── Two-column body ── */}
//       <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 16, alignItems: "start" }}>

//         {/* Left column */}
//         <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

//           {/* Impact summary */}
//           <div style={{
//             background: "var(--color-background-primary)",
//             border: "0.5px solid var(--color-border-tertiary)",
//             borderRadius: 12, padding: "24px 28px",
//           }}>
//             <SectionLabel>Operational impact</SectionLabel>
//             <p style={{ fontSize: 15, lineHeight: 1.7, color: "var(--color-text-primary)", margin: "0 0 16px" }}>
//               {operationalSummary}
//             </p>
//             <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 8 }}>
//               {[
//                 `${organization} monitored across ${events.length} events and ${suppliers.length} suppliers.`,
//                 `${alerts.length} live alerts — ${criticalAlerts} critical — currently active.`,
//                 `${graphSummary?.relationship_count ?? 0} graph relationships materialized for exposure tracing.`,
//               ].map((item) => (
//                 <li key={item} style={{ display: "flex", gap: 10, fontSize: 13, color: "var(--color-text-secondary)" }}>
//                   <span style={{ color: "var(--color-text-tertiary)", flexShrink: 0, marginTop: 1 }}>›</span>
//                   {item}
//                 </li>
//               ))}
//             </ul>
//           </div>

//           {/* Root cause */}
//           <div style={{
//             background: "var(--color-background-primary)",
//             border: "0.5px solid var(--color-border-tertiary)",
//             borderRadius: 12, padding: "24px 28px",
//           }}>
//             <SectionLabel>Root cause</SectionLabel>
//             <p style={{ fontSize: 13, fontWeight: 600, color: alertM.color, margin: "0 0 10px", letterSpacing: "0.02em" }}>
//               {rootCause}
//             </p>
//             <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--color-text-secondary)", margin: 0 }}>
//               {topEvent?.summary || "Event summary will appear here once the pipeline has a selected event."}
//             </p>
//           </div>

//           {/* Top risks */}
//           <div style={{
//             background: "var(--color-background-primary)",
//             border: "0.5px solid var(--color-border-tertiary)",
//             borderRadius: 12, padding: "24px 28px",
//           }}>
//             <SectionLabel>Top risks by score</SectionLabel>
//             {topRisks.length === 0 ? (
//               <p style={{ fontSize: 13, color: "var(--color-text-tertiary)", margin: 0 }}>No risk items available.</p>
//             ) : (
//               <div>
//                 {topRisks.map((risk, i) => (
//                   <RiskRow key={risk.event_id} risk={risk} index={i} />
//                 ))}
//               </div>
//             )}
//           </div>

//           {/* Recommended actions */}
//           <div style={{
//             background: "var(--color-background-primary)",
//             border: "0.5px solid var(--color-border-tertiary)",
//             borderRadius: 12, padding: "24px 28px",
//           }}>
//             <SectionLabel>Recommended actions</SectionLabel>
//             <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
//               {recommendedActions.map((action, i) => (
//                 <div key={action.text} style={{
//                   display: "flex", gap: 12, alignItems: "flex-start",
//                   padding: "12px 14px",
//                   background: "var(--color-background-secondary)",
//                   borderRadius: 8,
//                 }}>
//                   <span style={{
//                     flexShrink: 0, width: 22, height: 22, borderRadius: "50%",
//                     background: "var(--color-background-primary)",
//                     border: "0.5px solid var(--color-border-secondary)",
//                     display: "flex", alignItems: "center", justifyContent: "center",
//                     fontSize: 11, fontWeight: 700, color: "var(--color-text-tertiary)",
//                     fontVariantNumeric: "tabular-nums",
//                   }}>
//                     {i + 1}
//                   </span>
//                   <p style={{ fontSize: 13, margin: 0, lineHeight: 1.5, color: "var(--color-text-primary)" }}>
//                     {action.text}
//                   </p>
//                 </div>
//               ))}
//             </div>
//           </div>

//           {/* Mitigation summary */}
//           <div style={{
//             background: "var(--color-background-primary)",
//             border: "0.5px solid var(--color-border-tertiary)",
//             borderLeft: `3px solid ${alertM.color}`,
//             borderRadius: "0 12px 12px 0",
//             padding: "20px 24px",
//           }}>
//             <SectionLabel>Executive mitigation summary</SectionLabel>
//             <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--color-text-secondary)", margin: "0 0 8px" }}>
//               SCOUT recommends rerouting high-priority shipments, increasing buffer stock, and validating alternate suppliers before the next procurement cycle.
//             </p>
//             <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--color-text-primary)", margin: 0, fontWeight: 500 }}>
//               {businessImpact}
//             </p>
//           </div>
//         </div>

//         {/* Right sidebar */}
//         <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

//           {/* Risk level panel */}
//           <div style={{
//             background: "var(--color-background-primary)",
//             border: "0.5px solid var(--color-border-tertiary)",
//             borderRadius: 12, padding: "20px 20px",
//           }}>
//             <SectionLabel>Risk assessment</SectionLabel>
//             <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
//               <FieldRow label="Alert level" value={<AlertBadge level={currentAlertLevel} />} />
//               <FieldRow label="Confidence" value={topRisk ? Number(topRisk.classifier_confidence ?? 0).toFixed(2) : "—"} />
//               <FieldRow label="Predicted delay" value={predictedDelay} />
//               <FieldRow label="Source coverage" value={formatPercent(events.length / Math.max(suppliers.length || 1, 1))} />
//             </div>
//           </div>

//           {/* Supply chain panel */}
//           <div style={{
//             background: "var(--color-background-primary)",
//             border: "0.5px solid var(--color-border-tertiary)",
//             borderRadius: 12, padding: "20px 20px",
//           }}>
//             <SectionLabel>Exposed supply chain</SectionLabel>

//             <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--color-text-tertiary)", margin: "12px 0 6px" }}>Focus</p>
//             <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
//               <FieldRow label="Suppliers" value={joinList(focusSuppliers)} />
//               <FieldRow label="Ports" value={joinList(focusPorts)} />
//               <FieldRow label="Commodities" value={joinList(focusCommodities)} />
//             </div>

//             <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--color-text-tertiary)", margin: "16px 0 6px" }}>Live exposure</p>
//             <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
//               <FieldRow label="Suppliers" value={joinList(impactedSuppliers)} />
//               <FieldRow label="Countries" value={joinList(countries)} />
//               <FieldRow label="Ports" value={joinList(ports)} />
//             </div>
//           </div>

//           {/* Context panel */}
//           <div style={{
//             background: "var(--color-background-primary)",
//             border: "0.5px solid var(--color-border-tertiary)",
//             borderRadius: 12, padding: "20px 20px",
//           }}>
//             <SectionLabel>Context</SectionLabel>
//             <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
//               <FieldRow label="Organization" value={organization} />
//               <FieldRow label="Industry" value={industry} />
//               <FieldRow label="Regions" value={joinList(regions)} />
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }