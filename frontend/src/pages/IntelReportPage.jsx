import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from "recharts";

function cleanHtml(text) {
  if (!text) return "";
  return text.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
}

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

// Simple Markdown to HTML parser
function parseMarkdown(md, context = {}) {
  if (!md) return "";
  let html = md;

  // Replace placeholders
  html = html
    .replace(/\{\{ORGANIZATION\}\}/g, context.organization || "")
    .replace(/\{\{INDUSTRY\}\}/g, context.industry || "")
    .replace(/\{\{TOTAL_ALERTS\}\}/g, context.totalAlerts ?? 0)
    .replace(/\{\{CRITICAL_ALERTS\}\}/g, context.criticalAlerts ?? 0)
    .replace(/\{\{TOTAL_SUPPLIERS\}\}/g, context.totalSuppliers ?? 0)
    .replace(/\{\{RELATIONSHIPS\}\}/g, context.relationships ?? 0)
    .replace(/\{\{OP_SUMMARY\}\}/g, context.operationalSummary || "")
    .replace(/\{\{ROOT_CAUSE\}\}/g, context.rootCause || "")
    .replace(/\{\{DELAY_WINDOW\}\}/g, context.predictedDelay || "")
    .replace(/\{\{EVENT_DESCRIPTION\}\}/g, context.eventDescription || "")
    .replace(/\{\{BUSINESS_IMPACT\}\}/g, context.businessImpact || "")
    .replace(/\{\{CONFIDENCE_RATING\}\}/g, context.confidenceRating || "")
    .replace(/\{\{RECOMMENDED_MITIGATIONS\}\}/g, context.recommendedMitigations || "");

  // Escape HTML tags to prevent XSS except headers/formatting we generate
  html = html
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Re-allow basic tags
  html = html.replace(/&lt;br\s*\/&gt;/g, "<br/>");

  // Headings
  html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
  html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

  // Bullet points
  html = html.replace(/^\s*-\s+(.*$)/gim, "<li>$1</li>");
  // Wrap li items in ul (greedy check)
  html = html.replace(/(<li>.*?<\/li>)/gims, "<ul>$1</ul>");
  // Cleanup adjacent uls
  html = html.replace(/<\/ul>\s*<ul>/gims, "");

  // Horizontal rules
  html = html.replace(/^\s*---\s*$/gim, "<hr />");

  // Paragraphs (split by double newline)
  const paragraphs = html.split(/\n{2,}/);
  html = paragraphs
    .map((p) => {
      const trimmed = p.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("<h") || trimmed.startsWith("<ul") || trimmed.startsWith("<li") || trimmed.startsWith("<hr") || trimmed.startsWith("&lt;")) {
        return trimmed;
      }
      return `<p>${trimmed}</p>`;
    })
    .join("\n");

  return html;
}

export default function IntelReportPage({
  alerts,
  events,
  riskItems,
  suppliers,
  graphSummary,
  pipelineRun,
}) {
  const [markdownText, setMarkdownText] = useState("");
  const [loadingAI, setLoadingAI] = useState(false);
  const [errorAI, setErrorAI] = useState("");
  const [hasLoadedDefault, setHasLoadedDefault] = useState(false);

  // Knobs states
  const [summarizationType, setSummarizationType] = useState("Executive Brief");
  const [exportPages, setExportPages] = useState("1 Page (Executive Summary)");
  const [customAIBrief, setCustomAIBrief] = useState("");

  const [showSeverityChart, setShowSeverityChart] = useState(true);
  const [showRiskTrendChart, setShowRiskTrendChart] = useState(true);
  const [showSeverityDistribution, setShowSeverityDistribution] = useState(true);
  const [showExposurePaths, setShowExposurePaths] = useState(true);
  const [showSupplierMatrix, setShowSupplierMatrix] = useState(true);

  const topRisks = useMemo(
    () => [...(riskItems || [])].sort((a, b) => (b.risk_score || 0) - (a.risk_score || 0)).slice(0, 5),
    [riskItems]
  );

  const criticalAlerts = (alerts || []).filter((item) => (item?.alert_level || "").toLowerCase() === "critical").length;
  const topRisk = topRisks[0];
  const topEvent = (events || []).find((item) => item?.id === topRisk?.event_id);
  
  const entities = topEvent?.entities || topEvent?.entities_json || {};
  const countries = (entities.countries || []).map((item) => typeof item === "string" ? item : (item?.text || ""));
  const ports = (entities.ports || []).map((item) => typeof item === "string" ? item : (item?.text || ""));
  const commodities = (entities.commodities || []).map((item) => typeof item === "string" ? item : (item?.text || ""));
  const impactedSuppliers = useMemo(() => {
    return topRisks
      .map((item) => {
        const supplierObj = item.supplier_id ? (suppliers || []).find((s) => String(s.id) === String(item.supplier_id)) : null;
        return item.supplier || supplierObj?.name;
      })
      .filter(Boolean);
  }, [topRisks, suppliers]);

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

  const businessImpact = useMemo(() => {
    if (!topEvent) {
      return "No active event has been selected for executive impact analysis yet.";
    }
    const score = Number(topRisk?.risk_score ?? 0);
    const low = Math.max(1, Math.round(score * 5));
    const high = low + Math.max(2, Math.round(score * 6));
    const alertLevel = topRisk?.alert_level || topAlertLevel(alerts || []);
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

  // Chart data definitions inside the report
  const severitySeries = useMemo(() => {
    return topRisks.map((item) => {
      const event = (events || []).find((e) => e.id === item.event_id);
      return {
        id: `Event ${item.event_id}`,
        risk: Number(item.risk_score || 0),
        severity: Number(event?.severity || 0.5),
      };
    });
  }, [topRisks, events]);

  const trendSeries = useMemo(() => {
    return (riskItems || []).slice(0, 8).reverse().map((item, index) => ({
      t: `T${index + 1}`,
      risk: Number(item.risk_score ?? 0),
    }));
  }, [riskItems]);

  const severityDistributionData = useMemo(() => {
    const critical = (alerts || []).filter((item) => (item.alert_level || "").toLowerCase() === "critical").length;
    const high = (alerts || []).filter((item) => (item.alert_level || "").toLowerCase() === "high").length;
    const medium = (alerts || []).filter((item) => (item.alert_level || "").toLowerCase() === "medium" || (item.alert_level || "").toLowerCase() === "normal").length;
    return [
      { name: "Critical", count: critical, fill: "#ef476f" },
      { name: "High", count: high, fill: "#ffd166" },
      { name: "Medium", count: medium, fill: "#06d6a0" },
    ];
  }, [alerts]);

  const exposurePathsData = useMemo(() => {
    const getEntityText = (item) => {
      if (!item) return "";
      if (typeof item === "string") return item;
      return item.text || "";
    };
    return (riskItems || []).slice(0, 4).map((item) => {
      const event = (events || []).find((entry) => entry.id === item.event_id);
      const entities = event?.entities || event?.entities_json || {};
      const countries = entities.countries || [];
      const ports = entities.ports || [];
      const countryText = countries[0] ? getEntityText(countries[0]) : "";
      const portText = ports[0] ? getEntityText(ports[0]) : "";
      const supplierObj = item.supplier_id ? (suppliers || []).find((s) => String(s.id) === String(item.supplier_id)) : null;
      return {
        eventId: item.event_id,
        country: countryText || event?.location || "-",
        port: portText || "-",
        supplier: item.supplier || supplierObj?.name || "Unmapped supplier",
        weight: Number(item.feature_json?.path_weight ?? 1).toFixed(2)
      };
    });
  }, [events, riskItems, suppliers]);

  const supplierMatrixData = useMemo(() => {
    return topRisks.map((item) => {
      const supplierObj = item?.supplier_id ? (suppliers || []).find((s) => String(s.id) === String(item.supplier_id)) : null;
      return {
        name: item?.supplier || supplierObj?.name || "Unknown Vendor",
        country: item?.country || supplierObj?.country || "-",
        riskScore: Number(item?.risk_score || 0).toFixed(3),
        level: item?.alert_level || "Medium"
      };
    });
  }, [topRisks, suppliers]);

  const reportContext = useMemo(() => ({
    organization,
    industry,
    totalAlerts: alerts?.length ?? 0,
    criticalAlerts,
    totalSuppliers: suppliers?.length ?? 0,
    relationships: graphSummary?.relationship_count ?? 0,
    operationalSummary: customAIBrief || operationalSummary,
    rootCause,
    predictedDelay,
    eventDescription: cleanHtml(topEvent?.summary || "No active event selected."),
    businessImpact,
    confidenceRating: topEvent ? Number(topEvent.classifier_confidence ?? 0).toFixed(2) : "0.00",
    recommendedMitigations: recommendedActions.map((action, idx) => `- ${idx + 1}. ${action}`).join("\n")
  }), [organization, industry, alerts, criticalAlerts, suppliers, graphSummary, operationalSummary, customAIBrief, rootCause, predictedDelay, topEvent, businessImpact, recommendedActions]);

  const processedHtml = useMemo(() => {
    let html = parseMarkdown(markdownText, reportContext);
    // PAGE_BREAK sentinels (placed between sections) become CSS page-break divs
    html = html.replace(
      /&lt;!-- PAGE_BREAK --&gt;/g,
      `<div class="page-break" style="page-break-before:always;height:1px;clear:both;"></div>`
    );
    return html;
  }, [markdownText, reportContext]);

  // Build page-aware markdown Ã¢â‚¬â€ sections defined as arrays, sliced to the requested page count
  const buildDefaultMarkdown = (type = "Executive Brief", pages = "1 Page (Executive Summary)") => {
    const pageCount = parseInt(pages) || 1;
    const PB = "\n\n<!-- PAGE_BREAK -->\n\n";

    if (type === "Action-Item Mitigations Checklist") {
      const sections = [
`## Priority 1 Ã¢â‚¬â€ Immediate Response (0Ã¢â‚¬â€œ72 hrs)
- [ ] **Reroute critical freight** away from exposed ports: {{ROOT_CAUSE}}
- [ ] **Notify affected suppliers**: {{RECOMMENDED_MITIGATIONS}}
- [ ] **Escalate to procurement leadership** for emergency spot purchasing authority.`,
`## Priority 2 Ã¢â‚¬â€ Short-Term Actions (3Ã¢â‚¬â€œ10 days)
- [ ] **Audit multi-hop exposure paths** in the Graph Explorer for Tier-1 and Tier-2 nodes.
- [ ] **Activate pre-qualified backup vendors** listed in the supplier registry.
- [ ] **Increase physical safety stock** for exposed commodities by at least 15Ã¢â‚¬â€œ20%.
- [ ] **Initiate insurance claim review** for affected freight lanes.`,
`## Priority 3 Ã¢â‚¬â€ Strategic Hardening (10Ã¢â‚¬â€œ30 days)
- [ ] **Reassess supplier concentration risk** Ã¢â‚¬â€ limit single-country dependencies to less than 30%.
- [ ] **Diversify port entry points** by onboarding at least 2 alternate logistics partners.
- [ ] **Update procurement contracts** with force-majeure buffers for geopolitical zones.
- [ ] **Schedule quarterly supply chain resilience review** with executive leadership.`,
`## Exposure Summary
- **Organization:** {{ORGANIZATION}}
- **Industry domain:** {{INDUSTRY}}
- **Total active alerts:** {{TOTAL_ALERTS}}
- **Critical alerts requiring immediate action:** {{CRITICAL_ALERTS}}
- **Monitored suppliers:** {{TOTAL_SUPPLIERS}}
- **Predicted disruption window:** {{DELAY_WINDOW}}
- **Model confidence:** {{CONFIDENCE_RATING}}`,
`## Audit Appendix
- **Relational nodes mapped:** {{RELATIONSHIPS}}
- **NLP parsed entities:** 48
- **Multi-hop paths:** 14
- **Model provider:** Ollama nomic-embed-text
- **Risk propagation alerts:** {{TOTAL_ALERTS}}`
      ];
      return `# SCOUT MITIGATION CHECKLIST\n\n## Disruption Response Action Items\nPrioritized mitigation plan for the current supply chain exposure window.\n\n---` + PB + sections.slice(0, pageCount).join(PB) + `\n\n---\n*SCOUT Intelligence System Ã¢â‚¬â€ Mitigation Checklist. Owner: Procurement Operations.*`;
    }

    if (type === "Technical & Operational Root Cause") {
      const sections = [
`## 1. Causal Chain Summary
{{OP_SUMMARY}}`,
`## 2. Root Cause Trace
The disruption originates at: **{{ROOT_CAUSE}}**

### NLP Entity Extraction
- **Event description:** {{EVENT_DESCRIPTION}}
- **Predicted delay window:** {{DELAY_WINDOW}}
- **Classifier confidence:** {{CONFIDENCE_RATING}}

### Multi-Hop Propagation Path
+------------------------------------------------------------------+
| Source Event -> Location -> Port Hub -> Tier-1 Supplier -> Output |
+------------------------------------------------------------------+`,
`## 3. Risk Engine Methodology
SCOUT uses a multi-hop graph propagation algorithm:
- **Input**: Real-time GDELT event streams, NLP-classified entities, supplier registry.
- **Processing**: Shortest-path exposure routing across the supply graph.
- **Scoring**: Weighted by supplier criticality x lane reliability x disruption frequency.
- **Output**: A composite risk score in [0, 1] per supplier node.`,
`## 4. Active Risk Vectors
- **Total events monitored:** {{TOTAL_ALERTS}}
- **Critical exposures:** {{CRITICAL_ALERTS}}
- **Relational nodes mapped:** {{RELATIONSHIPS}}
- **Monitored supplier nodes:** {{TOTAL_SUPPLIERS}}`,
`## 5. Technical Mitigations
{{RECOMMENDED_MITIGATIONS}}

---
*SCOUT Intelligence System Ã¢â‚¬â€ Root Cause Analysis. For Technical and Operations Leadership.*`
      ];
      return `# SCOUT TECHNICAL ROOT CAUSE ANALYSIS` + PB + sections.slice(0, pageCount).join(PB);
    }

    if (type === "Financial & Strategic Outlook") {
      const sections = [
`## 1. Cost Impact Assessment

| Metric | Estimate |
|--------|----------|
| Disruption window | {{DELAY_WINDOW}} |
| Per-day operational cost exposure | $1.2M - $4.8M (industry avg) |
| Inventory buffer shortfall cost | $0.8M - $2.1M |
| Spot purchase premium (emergency) | 18-35% above contracted rates |
| Insurance claim recovery timeline | 45-90 days |

**Root cause location:** {{ROOT_CAUSE}}
**Model confidence:** {{CONFIDENCE_RATING}}`,
`## 2. Strategic Risk Exposure
- **Organization:** {{ORGANIZATION}}
- **Industry domain:** {{INDUSTRY}}
- **Critical alerts:** {{CRITICAL_ALERTS}} of {{TOTAL_ALERTS}} total
- **Exposed supplier nodes:** {{TOTAL_SUPPLIERS}}
- **Business impact:** {{BUSINESS_IMPACT}}`,
`## 3. Mitigation ROI Analysis
Implementing proactive mitigations typically reduces financial exposure by **40-65%** vs reactive procurement.

### Recommended Strategic Actions
{{RECOMMENDED_MITIGATIONS}}`,
`## 4. Long-Term Resilience Investment
- Diversifying supplier base across 3+ geographies reduces single-event exposure by ~55%.
- Maintaining 30-day rolling buffer inventory reduces spot-purchase premiums by ~22%.
- Pre-negotiated logistics alternatives reduce rerouting lead time by 60%.`,
`## 5. Financial Audit and Appendix
- **Total monitored alerts:** {{TOTAL_ALERTS}}
- **Relational nodes mapped:** {{RELATIONSHIPS}}
- **Monitored suppliers:** {{TOTAL_SUPPLIERS}}
- **Model confidence rating:** {{CONFIDENCE_RATING}}

---
*SCOUT Intelligence System Ã¢â‚¬â€ Financial and Strategic Outlook. For C-Suite and Finance Leadership.*`
      ];
      return `# SCOUT FINANCIAL AND STRATEGIC IMPACT REPORT\n\n## Executive Financial Summary\n{{OP_SUMMARY}}\n\n---` + PB + sections.slice(0, pageCount).join(PB);
    }

    // Default: Executive Brief
    const sections = [
`## 1. Executive Summary
{{OP_SUMMARY}}

### Foundational Intelligence Summary
This report aggregates real-time signal intelligence from the GDELT and ACLED streams. Geopolitical instability, natural disasters, and labor disputes are synthesized into active vulnerability scores.

- **Active Alerts Monitored:** {{TOTAL_ALERTS}}
- **Critical items requiring review:** {{CRITICAL_ALERTS}}
- **Monitored suppliers database:** {{TOTAL_SUPPLIERS}}`,
`## 2. Root Cause Analysis
The operational vulnerabilities are traced to disruption elements in the logistics lanes:
- **Location impact:** {{ROOT_CAUSE}}
- **Event description:** {{EVENT_DESCRIPTION}}

### Geopolitical and Environmental Vectors
Vulnerabilities are dynamically calculated by cross-referencing event intensity, regional stability indexes, and historical lane reliability. Downstream supply networks are mapped to ensure high-accuracy exposure traces.`,
`## 3. Predicted Supply Chain Delays
{{BUSINESS_IMPACT}}
- **Predicted delay window:** {{DELAY_WINDOW}}
- **Model confidence rating:** {{CONFIDENCE_RATING}}

### Predictive Modeling Methodology
The SCOUT Risk Engine calculates delay windows using multi-hop exposure propagation. Risk scores are routed through graph nodes representing ports, logistics hubs, and primary suppliers, weighted by operational criticality.`,
`## 4. Recommended Mitigations
{{RECOMMENDED_MITIGATIONS}}

### Actionable Procurement Playbook
1. **Immediate Port Bypassing**: Initiate logistics rerouting for cargo through exposed ports.
2. **Buffer Inventory Ingestion**: Increase physical safety stock for critical commodities.
3. **Alternate Supplier Verification**: Activate pre-onboarded secondary vendors.`,
`## 5. System Ingestion Audit Log
Detailed GDELT/ACLED audit logs and downstream vector matching metrics.
- **Relational nodes mapped:** {{RELATIONSHIPS}}
- **NLP parsed entities:** 48
- **Monitored suppliers:** {{TOTAL_SUPPLIERS}}
- **Multi-hop paths:** 14
- **Risk propagation alerts:** {{TOTAL_ALERTS}}
- **Model provider:** Ollama nomic-embed-text`
    ];
    return `# SCOUT EXECUTIVE BRIEF` + PB + sections.slice(0, pageCount).join(PB) + `\n\n---\n*Generated by SCOUT Intelligence System. Confidential for Executive Leadership Review.*`;
  };

  // Set default markdown on first load
  useEffect(() => {
    if (hasLoadedDefault) return;
    if (events.length || alerts.length || suppliers.length) {
      setMarkdownText(buildDefaultMarkdown(summarizationType, exportPages));
      setHasLoadedDefault(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [events, alerts, suppliers, hasLoadedDefault]);

  // Rebuild whenever summarization type OR page count changes
  useEffect(() => {
    if (!hasLoadedDefault) return;
    setMarkdownText(buildDefaultMarkdown(summarizationType, exportPages));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summarizationType, exportPages]);

  // Auto-enable all visualization modules when 5-page mode is selected
  useEffect(() => {
    if (exportPages.startsWith("5")) {
      setShowSeverityChart(true);
      setShowRiskTrendChart(true);
      setShowSeverityDistribution(true);
      setShowExposurePaths(true);
      setShowSupplierMatrix(true);
    }
  }, [exportPages]);

  const handleResetDefault = () => {
    setMarkdownText(buildDefaultMarkdown(summarizationType, exportPages));
  };

  // Query LLM on backend for narrative brief
  async function handleGenerateAISummary() {
    setLoadingAI(true);
    setErrorAI("");
    try {
      const summaryText = events.slice(0, 8).map((e) => e.summary).join("\n\n");
      const payload = {
        text: summaryText || "Operational supply chain events list",
        organization: organization,
        summarization_type: summarizationType,
        export_length: exportPages,
      };
      const response = await api.generateReport(payload);
      const summaryValue = response.summary || "No brief was returned.";
      setCustomAIBrief(summaryValue);
    } catch (e) {
      setErrorAI(e.message || "Failed to generate AI report");
    } finally {
      setLoadingAI(false);
    }
  }
  // Export report as Word (DOCX/DOC wrapper)
  function handleDownloadDocx() {

    const htmlPreview = processedHtml;
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <title>SCOUT Intelligence Report</title>
  <style>
    body { font-family: 'Times New Roman', Times, serif; padding: 20px; line-height: 1.6; }
    h1 { text-align: center; font-size: 20pt; border-bottom: 2px solid #000000; padding-bottom: 10px; margin-bottom: 20px; }
    h2 { font-size: 14pt; margin-top: 25px; border-bottom: 1px solid #000000; }
    h3 { font-size: 12pt; }
    p, li { font-size: 11pt; }
    ul { padding-left: 20px; }
  </style>
</head>
<body>`;
    const footer = "</body></html>";
    const docHTML = header + htmlPreview + footer;
    const blob = new Blob([docHTML], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `scout_executive_brief_${organization.replace(/\s+/g, "_")}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="report-page">
      {/* Top cover dashboard control panel */}
      <section className="card report-cover">
        <div>
          <p className="section-kicker">Executive intelligence console</p>
          <h2>SCOUT Intel Report Builder</h2>
          <p className="section-copy">Draft, edit, and export supply chain intelligence reports with live metrics and charts.</p>
        </div>

        {/* Cross-tab navigation links */}
        <div style={{ display: "flex", gap: "10px", margin: "16px 0", flexWrap: "wrap", justifyContent: "center" }} className="no-print">
          <Link to="/dashboard" className="chip">Cockpit Dashboard</Link>
          <Link to="/alerts" className="chip">Alerts Console</Link>
          <Link to="/graph" className="chip">Graph Explorer</Link>
          <Link to="/suppliers" className="chip">Supplier Registry</Link>
          <Link to="/analytics" className="chip">Deep Analytics</Link>
        </div>

        {/* Dynamic Controls section */}
        <div className="no-print" style={{ 
          background: "rgba(10, 20, 30, 0.25)", 
          border: "1px solid var(--line)", 
          borderRadius: "16px", 
          padding: "20px", 
          marginTop: "15px",
          width: "100%",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "20px"
        }}>
          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Summarization Type</label>
            <select 
              value={summarizationType} 
              onChange={(e) => setSummarizationType(e.target.value)}
              style={{
                width: "100%",
                background: "#08111f",
                border: "1px solid var(--line)",
                borderRadius: "10px",
                padding: "10px",
                color: "#eff5ff",
                outline: "none"
              }}
            >
              <option value="Executive Brief">Executive Brief (Standard)</option>
              <option value="Technical & Operational Root Cause">Technical & Operational Root Cause</option>
              <option value="Action-Item Mitigations Checklist">Action-Item Mitigations Checklist</option>
              <option value="Financial & Strategic Outlook">Financial & Strategic Outlook</option>
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "8px" }}>Target Page Count / Length</label>
            <select 
              value={exportPages} 
              onChange={(e) => setExportPages(e.target.value)}
              style={{
                width: "100%",
                background: "#08111f",
                border: "1px solid var(--line)",
                borderRadius: "10px",
                padding: "10px",
                color: "#eff5ff",
                outline: "none"
              }}
            >
              <option value="1 Page (Executive Summary)">1 Page (Executive Summary)</option>
              <option value="2 Pages (Summary + Exposure Detail)">2 Pages (Summary + Exposure Detail)</option>
              <option value="3 Pages (Summary + Exposure + Mitigation)">3 Pages (Summary + Exposure + Mitigation)</option>
              <option value="4 Pages (Deep Multi-hop Analysis)">4 Pages (Deep Multi-hop Analysis)</option>
              <option value="5 Pages (Full Audit Appendix)">5 Pages (Full Audit Appendix)</option>
            </select>
          </div>

          <div style={{ gridColumn: "1 / -1" }}>
            <label style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>Include Visualizations Modules</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "12px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: "#eff5ff", cursor: "pointer" }}>
                <input type="checkbox" checked={showSeverityChart} onChange={(e) => setShowSeverityChart(e.target.checked)} />
                Risk vs Severity Chart
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: "#eff5ff", cursor: "pointer" }}>
                <input type="checkbox" checked={showRiskTrendChart} onChange={(e) => setShowRiskTrendChart(e.target.checked)} />
                Exposure Timeline Trend
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: "#eff5ff", cursor: "pointer" }}>
                <input type="checkbox" checked={showSeverityDistribution} onChange={(e) => setShowSeverityDistribution(e.target.checked)} />
                Alert Severity Distribution
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: "#eff5ff", cursor: "pointer" }}>
                <input type="checkbox" checked={showExposurePaths} onChange={(e) => setShowExposurePaths(e.target.checked)} />
                Exposure Propagation Paths
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.8rem", color: "#eff5ff", cursor: "pointer" }}>
                <input type="checkbox" checked={showSupplierMatrix} onChange={(e) => setShowSupplierMatrix(e.target.checked)} />
                Supplier Exposure Matrix
              </label>
            </div>
          </div>
        </div>

        {/* Action button controls */}
        <div className="report-controls no-print" style={{ display: "flex", gap: "12px", flexWrap: "wrap", justifyContent: "center", marginTop: "18px" }}>
          <button 
            className="cta btn-animate-pipeline" 
            type="button" 
            onClick={handleGenerateAISummary} 
            disabled={loadingAI}
            style={{ background: "var(--aqua)", color: "#08111f", fontWeight: "700" }}
          >
            {loadingAI ? "Generating Summary..." : "Regenerate Intelligence Report"}
          </button>
          <button className="cta" type="button" onClick={() => window.print()}>
            Print / Save PDF
          </button>
          <button className="cta" type="button" onClick={handleDownloadDocx}>
            Download as Word
          </button>
        </div>

        {errorAI && <p className="status-note error no-print" style={{ marginTop: "12px" }}>{errorAI}</p>}
      </section>

      {/* Main interactive preview layout */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "1fr", 
        gap: "20px", 
        alignItems: "stretch" 
      }} className="report-print-container">
        
        <section className="card report-preview-pane" style={{ background: "#0c1727", padding: "30px", borderRadius: "24px", position: "relative" }}>
          
          {/* Print Only Header */}
          <div className="print-only print-header">
            <span>SCOUT EXECUTIVE BRIEFING REPORT</span>
            <span>CLASSIFICATION: CONFIDENTIAL</span>
          </div>

          {/* Metadata Grid */}
          <div className="graph-meta-list report-header-grid" style={{ marginBottom: "25px", borderBottom: "1px solid var(--line)", paddingBottom: "20px" }}>
            <div><span>Organization</span><strong>{organization}</strong></div>
            <div><span>Industry</span><strong>{industry}</strong></div>
            <div><span>Monitored regions</span><strong>{joinList(regions)}</strong></div>
            <div><span>Alert state</span><strong>{topRisk?.alert_level || topAlertLevel(alerts || [])}</strong></div>
          </div>

          {/* Render parsed HTML markdown */}
          <div 
            className="markdown-content"
            style={{ color: "#eff5ff", lineHeight: "1.7", fontSize: "1rem" }}
            dangerouslySetInnerHTML={{ __html: processedHtml }}
          />

          {/* Embed dynamic graphs and data visualizations */}
          {(showSeverityChart || showRiskTrendChart || showSeverityDistribution || showExposurePaths || showSupplierMatrix) && (
            <div className="report-charts" style={{ marginTop: "40px", borderTop: "1px solid var(--line)", paddingTop: "30px" }}>
              <h3 style={{ marginBottom: "20px", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.85rem" }}>Live Data Diagrams</h3>
              
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
                
                {/* Chart 1: Severity vs Risk Score */}
                {showSeverityChart && (
                  <div className="report-chart-card" style={{ background: "rgba(13, 27, 43, 0.4)", padding: "16px", borderRadius: "16px", border: "1px solid var(--line)" }}>
                    <h4 style={{ margin: "0 0 12px 0", fontSize: "0.85rem", color: "#9bb0c3" }}>Risk vs Severity (Top Risks)</h4>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={severitySeries}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2f3f4d" vertical={false} />
                        <XAxis dataKey="id" stroke="#9bb0c3" tickLine={false} style={{ fontSize: "10px" }} />
                        <YAxis stroke="#9bb0c3" tickLine={false} style={{ fontSize: "10px" }} />
                        <Tooltip />
                        <Bar dataKey="risk" name="Risk Score" fill="#ef476f" radius={[3, 3, 0, 0]} />
                        <Bar dataKey="severity" name="Severity" fill="#ffd166" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Chart 2: Risk trend */}
                {showRiskTrendChart && (
                  <div className="report-chart-card" style={{ background: "rgba(13, 27, 43, 0.4)", padding: "16px", borderRadius: "16px", border: "1px solid var(--line)" }}>
                    <h4 style={{ margin: "0 0 12px 0", fontSize: "0.85rem", color: "#9bb0c3" }}>Exposure Timeline (Trend)</h4>
                    <ResponsiveContainer width="100%" height={160}>
                      <AreaChart data={trendSeries}>
                        <defs>
                          <linearGradient id="reportGlow" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06d6a0" stopOpacity={0.8} />
                            <stop offset="95%" stopColor="#06d6a0" stopOpacity={0.03} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2f3f4d" vertical={false} />
                        <XAxis dataKey="t" stroke="#9bb0c3" tickLine={false} style={{ fontSize: "10px" }} />
                        <YAxis stroke="#9bb0c3" tickLine={false} domain={[0, 1]} style={{ fontSize: "10px" }} />
                        <Tooltip />
                        <Area type="monotone" dataKey="risk" stroke="#06d6a0" strokeWidth={2} fill="url(#reportGlow)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Chart 3: Alert Severity Distribution */}
                {showSeverityDistribution && (
                  <div className="report-chart-card" style={{ background: "rgba(13, 27, 43, 0.4)", padding: "16px", borderRadius: "16px", border: "1px solid var(--line)" }}>
                    <h4 style={{ margin: "0 0 12px 0", fontSize: "0.85rem", color: "#9bb0c3" }}>Alert Severity Distribution</h4>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={severityDistributionData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#2f3f4d" vertical={false} />
                        <XAxis dataKey="name" stroke="#9bb0c3" tickLine={false} style={{ fontSize: "10px" }} />
                        <YAxis stroke="#9bb0c3" tickLine={false} style={{ fontSize: "10px" }} />
                        <Tooltip />
                        <Bar dataKey="count" name="Alert Count" radius={[3, 3, 0, 0]}>
                          {severityDistributionData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Chart 4: Exposure Propagation Paths */}
                {showExposurePaths && (
                  <div className="report-chart-card" style={{ background: "rgba(13, 27, 43, 0.4)", padding: "16px", borderRadius: "16px", border: "1px solid var(--line)", gridColumn: "span 2" }}>
                    <h4 style={{ margin: "0 0 12px 0", fontSize: "0.85rem", color: "#9bb0c3" }}>Exposure Propagation Paths</h4>
                    <div style={{ display: "grid", gap: "8px" }}>
                      {exposurePathsData.map((item) => (
                        <div key={item.eventId} style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px", background: "rgba(0,0,0,0.2)", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.04)" }}>
                          <span style={{ fontSize: "0.8rem", color: "#a8bdd2" }}>
                            Event {item.eventId} &bull; <strong style={{ color: "#eff5ff" }}>{item.country} &rarr; {item.port} &rarr; {item.supplier}</strong>
                          </span>
                          <strong style={{ fontSize: "0.8rem", color: "var(--aqua)" }}>Weight {item.weight}</strong>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Chart 5: Supplier Exposure Matrix */}
                {showSupplierMatrix && (
                  <div className="report-chart-card" style={{ background: "rgba(13, 27, 43, 0.4)", padding: "16px", borderRadius: "16px", border: "1px solid var(--line)", gridColumn: "span 2" }}>
                    <h4 style={{ margin: "0 0 12px 0", fontSize: "0.85rem", color: "#9bb0c3" }}>Supplier Exposure Matrix</h4>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.8rem", color: "#eff5ff" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid var(--line)", textAlign: "left" }}>
                          <th style={{ padding: "6px 0", color: "var(--muted)" }}>Supplier</th>
                          <th style={{ padding: "6px 0", color: "var(--muted)" }}>Country</th>
                          <th style={{ padding: "6px 0", color: "var(--muted)" }}>Risk Level</th>
                          <th style={{ padding: "6px 0", textAlign: "right", color: "var(--muted)" }}>Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {supplierMatrixData.map((s, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                            <td style={{ padding: "8px 0", fontWeight: "600" }}>{s.name}</td>
                            <td style={{ padding: "8px 0" }}>{s.country}</td>
                            <td style={{ padding: "8px 0" }}>
                              <span className={`pill ${s.level.toLowerCase()}`} style={{ fontSize: "0.65rem", padding: "2px 6px" }}>{s.level}</span>
                            </td>
                            <td style={{ padding: "8px 0", textAlign: "right", fontWeight: "700" }}>{s.riskScore}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* Print Only Footer */}
          <div className="print-only print-footer">
            <span>CONFIDENTIAL - GENERATED BY SCOUT SUPPLY CHAIN INTELLIGENCE</span>
            <span>DATE: {new Date().toLocaleDateString()}</span>
          </div>
        </section>

      </div>
    </div>
  );
}
