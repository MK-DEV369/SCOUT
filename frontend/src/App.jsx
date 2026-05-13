import { Route, Routes } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import { api } from "./api";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import AlertsPage from "./pages/AlertsPage";
import SuppliersPage from "./pages/SuppliersPage";
import AnalyticsPage from "./pages/AnalyticsPage";

export default function App() {
  const [alerts, setAlerts] = useState([]);
  const [riskItems, setRiskItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [running, setRunning] = useState(false);

  function readItems(result, label) {
    if (result.status === "fulfilled") {
      return result.value.items || [];
    }
    console.error(`${label} request failed`, result.reason);
    return [];
  }

  async function refreshAll() {
    const [alertsResult, riskResult, eventResult, supplierResult] = await Promise.allSettled([
      api.alerts("Medium"),
      api.risk(),
      api.events(),
      api.suppliers(),
    ]);
    setAlerts(readItems(alertsResult, "alerts"));
    setRiskItems(readItems(riskResult, "risk"));
    setEvents(readItems(eventResult, "events"));
    setSuppliers(readItems(supplierResult, "suppliers"));
  }

  async function runPipeline(onboarding) {
    try {
      setRunning(true);
      const result = await api.runPipeline(onboarding);
      setAlerts(result.alerts || []);
      setRiskItems(result.riskItems || []);
      setEvents(result.events || []);
    } finally {
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
    () => ({ alerts, riskItems, events, suppliers }),
    [alerts, riskItems, events, suppliers]
  );

  return (
    <Layout onRunPipeline={runPipeline} running={running}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<DashboardPage riskItems={data.riskItems} events={data.events} />} />
        <Route path="/alerts" element={<AlertsPage alerts={data.alerts} />} />
        <Route path="/suppliers" element={<SuppliersPage suppliers={data.suppliers} onSave={saveSupplier} />} />
        <Route path="/analytics" element={<AnalyticsPage events={data.events} riskItems={data.riskItems} />} />
      </Routes>
    </Layout>
  );
}
