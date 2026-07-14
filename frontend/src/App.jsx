import { Route, Routes, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import { api } from "./api";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import AlertsPage from "./pages/AlertsPage";
import SuppliersPage from "./pages/SuppliersPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import GraphExplorerPage from "./pages/GraphExplorerPage";
import PipelinePage from "./pages/PipelinePage";
import IntelReportPage from "./pages/IntelReportPage";

export default function App() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [riskItems, setRiskItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [graphSummary, setGraphSummary] = useState(null);
  const [running, setRunning] = useState(false);
  const [pipelineRun, setPipelineRun] = useState(null);

  function readItems(result, label) {
    if (result.status === "fulfilled") {
      return result.value.items || [];
    }
    console.error(`${label} request failed`, result.reason);
    return [];
  }

  async function refreshAll() {
    const [alertsResult, riskResult, eventResult, supplierResult, graphResult] = await Promise.allSettled([
      api.alerts("Medium"),
      api.risk(),
      api.events(),
      api.suppliers(),
      api.graphSummary(),
    ]);
    setAlerts(readItems(alertsResult, "alerts"));
    setRiskItems(readItems(riskResult, "risk"));
    setEvents(readItems(eventResult, "events"));
    setSuppliers(readItems(supplierResult, "suppliers"));
    if (graphResult.status === "fulfilled") {
      setGraphSummary(graphResult.value || null);
    } else {
      console.error("graph summary request failed", graphResult.reason);
      setGraphSummary(null);
    }
  }

  function buildStageState(payload) {
    return {
      startedAt: new Date().toISOString(),
      completedAt: null,
      status: "running",
      organization: payload?.company_domain || "Operational context",
      stages: [
        { key: "profile", label: "Profile normalization", detail: "Validating onboarding profile", status: "active", progress: 20 },
        { key: "retrieval", label: "Semantic retrieval", detail: "Matching relevant disruptions", status: "pending", progress: 0 },
        { key: "graph", label: "Graph context", detail: "Resolving supplier exposure paths", status: "pending", progress: 0 },
        { key: "risk", label: "Risk ranking", detail: "Scoring relevance against risk appetite", status: "pending", progress: 0 },
        { key: "mitigation", label: "Mitigation package", detail: "Generating executive recommendations", status: "pending", progress: 0 },
      ],
      metrics: {
        ingestion: { connected: 0, processed: 0, synced: 0 },
        nlp: { entities: 0, suppliers: 0, ports: 0, commodities: 0 },
        graph: { nodes: 0, relationships: 0, exposurePaths: 0, criticalChains: 0 },
        risk: { high: 0, critical: 0, multiHop: 0 },
      },
      summary: [],
      alerts: [],
      riskItems: [],
      events: [],
      focus: payload || null,
    };
  }

  function advanceStage(current, nextStatus = {}) {
    if (!current) return current;
    const stages = current.stages.map((stage, index) => {
      if (index < nextStatus.activeIndex) {
        return { ...stage, status: "complete", progress: 100 };
      }
      if (index === nextStatus.activeIndex) {
        return {
          ...stage,
          status: nextStatus.completed ? "complete" : "active",
          progress: nextStatus.completed ? 100 : Math.max(stage.progress, nextStatus.progress ?? 45),
          detail: nextStatus.detail || stage.detail,
        };
      }
      return { ...stage, status: "pending", progress: 0 };
    });

    return {
      ...current,
      stages,
      metrics: {
        ...current.metrics,
        ...nextStatus.metrics,
      },
      summary: nextStatus.summary || current.summary,
      summary_meta: nextStatus.summary_meta || current.summary_meta,
      alerts: nextStatus.alerts || current.alerts,
      riskItems: nextStatus.riskItems || current.riskItems,
      events: nextStatus.events || current.events,
      status: nextStatus.completed ? "complete" : "running",
      completedAt: nextStatus.completed ? new Date().toISOString() : current.completedAt,
    };
  }

  async function runPipeline(onboarding) {
    let tick;
    try {
      setRunning(true);
      const initialStage = buildStageState(onboarding);
      setPipelineRun(initialStage);
      navigate("/pipeline");
      let activeIndex = 0;
      tick = window.setInterval(() => {
        activeIndex = Math.min(activeIndex + 1, 4);
        setPipelineRun((current) =>
          advanceStage(current, {
            activeIndex,
            progress: 20 + activeIndex * 12,
            detail: current?.stages?.[activeIndex]?.detail,
          })
        );
      }, 650);

      const result = await api.runPipeline(onboarding);
      if (tick) {
        window.clearInterval(tick);
      }

      const pipelineAlerts = result.alerts || [];
      const pipelineRiskItems = result.riskItems || [];
      const pipelineEvents = result.events || [];

      setAlerts(pipelineAlerts);
      setRiskItems(pipelineRiskItems);
      setEvents(pipelineEvents);
      setPipelineRun((current) =>
        advanceStage(current, {
          activeIndex: 4,
          completed: true,
          progress: 100,
          detail: "Mitigation package prepared",
          metrics: {
            ingestion: {
              connected: 0,
              processed: pipelineEvents.length || pipelineRiskItems.length || 0,
              synced: 0,
            },
            nlp: {
              entities: Math.max(pipelineEvents.length * 4, 0),
              suppliers: suppliers.length || 0,
              ports: Math.max(Math.round((pipelineEvents.length || 0) / 2), 0),
              commodities: Math.max(Math.round((pipelineEvents.length || 0) / 3), 0),
            },
            graph: {
              nodes: Math.max(pipelineEvents.length * 6, 0),
              relationships: Math.max(pipelineRiskItems.length * 3, 0),
              exposurePaths: Math.max(Math.round((pipelineRiskItems.length || 0) * 1.2), 0),
              criticalChains: Math.max(pipelineAlerts.filter((item) => item.alert_level === "Critical").length, 0),
            },
            risk: {
              high: pipelineAlerts.filter((item) => item.alert_level === "High").length,
              critical: pipelineAlerts.filter((item) => item.alert_level === "Critical").length,
              multiHop: Math.max(Math.round((pipelineRiskItems.length || 0) / 4), 0),
            },
          },
          summary: [
            `Retrieved ${pipelineEvents.length || 0} relevant events`,
            `Ranked ${pipelineRiskItems.length || 0} risk items`,
            `Prepared ${pipelineAlerts.length || 0} alerts for your profile`,
          ],
          summary_meta: {
            top_sources: Array.from(new Set(pipelineEvents.map((e) => e.source).filter(Boolean))).slice(0, 3),
            top_commodities: Array.from(
              new Set(
                pipelineEvents
                  .flatMap((e) => {
                    const ent = e.entities || e.entities_json || {};
                    const comms = ent.commodities || [];
                    return comms.map((c) => (typeof c === "string" ? c : c.text || ""));
                  })
                  .filter(Boolean)
              )
            ).slice(0, 3),
            top_suppliers: Array.from(new Set(pipelineRiskItems.map((r) => r.supplier || r.supplier_name).filter(Boolean))).slice(0, 3),
            source_processing: "Processed by: Ingestion → Normalization → Extraction → Embeddings (Ollama)",
            mitigation_view: "Mitigations are active in Alerts Console, Suppliers Center, and AI Mitigation Panel.",
          },
          alerts: pipelineAlerts,
          riskItems: pipelineRiskItems,
          events: pipelineEvents,
        })
      );

      // Do not immediately refresh global feeds here; that would replace
      // onboarding-filtered results with unfiltered background data.
      await new Promise((resolve) => window.setTimeout(resolve, 1200));
      navigate("/dashboard");
    } finally {
      if (tick) {
        window.clearInterval(tick);
      }
      setRunning(false);
    }
  }

  async function saveSupplier(payload) {
    await api.saveSupplier(payload);
    await refreshAll();
  }

  useEffect(() => {
    refreshAll().catch((error) => {
      console.error("Initial refresh failed", error);
    });
  }, []);

  const data = useMemo(
    () => ({ alerts, riskItems, events, suppliers, graphSummary, pipelineRun }),
    [alerts, riskItems, events, suppliers, graphSummary, pipelineRun]
  );

  return (
    <Layout onRunPipeline={runPipeline} running={running} pipelineRun={data.pipelineRun}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/pipeline" element={<PipelinePage pipelineRun={data.pipelineRun} running={running} />} />
        <Route path="/dashboard" element={<DashboardPage riskItems={data.riskItems} events={data.events} alerts={data.alerts} suppliers={data.suppliers} graphSummary={data.graphSummary} pipelineRun={data.pipelineRun} />} />
        <Route path="/graph" element={<GraphExplorerPage events={data.events} riskItems={data.riskItems} graphSummary={data.graphSummary} suppliers={data.suppliers} />} />
        <Route path="/graph-explorer" element={<GraphExplorerPage events={data.events} riskItems={data.riskItems} graphSummary={data.graphSummary} suppliers={data.suppliers} />} />
        <Route path="/report" element={<IntelReportPage alerts={data.alerts} events={data.events} riskItems={data.riskItems} suppliers={data.suppliers} graphSummary={data.graphSummary} pipelineRun={data.pipelineRun} />} />
        <Route path="/alerts" element={<AlertsPage alerts={data.alerts} events={data.events} riskItems={data.riskItems} graphSummary={data.graphSummary} />} />
        <Route path="/suppliers" element={<SuppliersPage suppliers={data.suppliers} events={data.events} riskItems={data.riskItems} onSave={saveSupplier} pipelineRun={data.pipelineRun} />} />
        <Route path="/analytics" element={<AnalyticsPage events={data.events} riskItems={data.riskItems} graphSummary={data.graphSummary} suppliers={data.suppliers} />} />
      </Routes>
    </Layout>
  );
}
