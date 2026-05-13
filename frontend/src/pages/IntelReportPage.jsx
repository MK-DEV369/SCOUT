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