import { Route, Routes } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

import { api } from "./api";
import Layout from "./components/Layout";
import HomePage from "./pages/HomePage";
import DashboardPage from "./pages/DashboardPage";
import AlertsPage from "./pages/AlertsPage";
import SuppliersPage from "./pages/SuppliersPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import TeamsPage from "./pages/TeamsPage";

export default function App() {
  const [alerts, setAlerts] = useState([]);
  const [riskItems, setRiskItems] = useState([]);
  const [events, setEvents] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [running, setRunning] = useState(false);

  async function refreshAll() {
    const [alertsData, riskData, eventData, supplierData] = await Promise.all([
      api.alerts("Medium"),
      api.risk(),
      api.events(),
      api.suppliers(),
    ]);
    setAlerts(alertsData.items || []);
    setRiskItems(riskData.items || []);
    setEvents(eventData.items || []);
    setSuppliers(supplierData.items || []);
  }

  async function runPipeline() {
    try {
      setRunning(true);
      await api.ingest();
      await api.buildEvents();
      await api.scoreRisk();
      await refreshAll();
    } finally {
      setRunning(false);
    }
  }

  async function saveSupplier(payload) {
    await api.saveSupplier(payload);
    await refreshAll();
  }

  useEffect(() => {
    refreshAll();
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
        <Route path="/teams" element={<TeamsPage />} />
      </Routes>
    </Layout>
  );
}
