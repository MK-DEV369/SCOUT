import { NavLink } from "react-router-dom";

export default function Layout({ children, onRunPipeline, running }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>SCOUT Control Tower</h1>
          <p>Supply disruption intelligence across ingest, NLP, risk, and suppliers.</p>
        </div>
        <button className="cta" onClick={onRunPipeline} disabled={running}>
          {running ? "Running..." : "Run Full Pipeline"}
        </button>
      </header>

      <nav className="tabs">
        <NavLink to="/" end className={({ isActive }) => (isActive ? "tab active" : "tab")}>
          Home
        </NavLink>
        <NavLink to="/dashboard" className={({ isActive }) => (isActive ? "tab active" : "tab")}>
          Dashboard
        </NavLink>
        <NavLink to="/alerts" className={({ isActive }) => (isActive ? "tab active" : "tab")}>
          Alerts
        </NavLink>
        <NavLink to="/suppliers" className={({ isActive }) => (isActive ? "tab active" : "tab")}>
          Supplier Profile
        </NavLink>
        <NavLink to="/analytics" className={({ isActive }) => (isActive ? "tab active" : "tab")}>
          Analytics
        </NavLink>
        <NavLink to="/teams" className={({ isActive }) => (isActive ? "tab active" : "tab")}>
          Teams
        </NavLink>
      </nav>

      <main className="content">{children}</main>
    </div>
  );
}
