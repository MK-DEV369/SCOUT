import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";

const statusCards = [
  { value: "Onboard", label: "Operational context first" },
  { value: "Trace", label: "Live pipeline execution" },
  { value: "Propagate", label: "Graph exposure and risk" },
];

const operatingPrinciples = [
  "Onboarding determines which suppliers, regions, and commodities matter.",
  "Pipeline execution shows ingestion, NLP, graph, and risk stages in sequence.",
  "Dashboard views are mission control: alerts, graph paths, supplier impact, and mitigation.",
];

const missionCards = [
  {
    title: "Operational context",
    copy: "Collect organization, supplier, and risk preferences before processing any data.",
  },
  {
    title: "Pipeline orchestration",
    copy: "Show stage-by-stage execution so the system feels live instead of static.",
  },
  {
    title: "Decision intelligence",
    copy: "Surface graph propagation, executive actions, and source-backed explanations.",
  },
];

export default function HomePage() {
  return (
    <div className="grid home-grid">
      <section className="card home-hero home-hero--operational">
        <div className="hero-brand">
          <p className="eyebrow">SCOUT</p>
          <h2>Supply Chain Operational Unified Threat Intelligence</h2>
          <p className="section-copy">
            AI-powered disruption detection and multi-hop supply chain risk intelligence.
          </p>
          <div className="hero-actions">
            <Button asChild size="lg">
              <Link to="/pipeline">Open Pipeline</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/graph-explorer">Explore Graph</Link>
            </Button>
          </div>
        </div>

        <div className="status-stack">
          {statusCards.map((card) => (
            <article className="stat-tile hero-stat-tile" key={card.label}>
              <strong>{card.value}</strong>
              <span>{card.label}</span>
            </article>
          ))}
        </div>
      </section>

      <section className="card full">
        <p className="section-kicker">Operational flow</p>
        <h2 className="section-title">What the control room does first</h2>
        <div className="mission-grid">
          {missionCards.map((item) => (
            <article className="mission-tile" key={item.title}>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <p className="section-kicker">Workflow</p>
        <h2 className="section-title">Execution sequence</h2>
        <ol className="flow-list">
          {operatingPrinciples.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ol>
      </section>

      <section className="card">
        <p className="section-kicker">Entry points</p>
        <h2 className="section-title">Start here</h2>
        <div className="stack-chips">
          <Link className="chip chip-link" to="/pipeline">Pipeline</Link>
          <Link className="chip chip-link" to="/dashboard">Mission control</Link>
          <Link className="chip chip-link" to="/graph-explorer">Graph explorer</Link>
          <Link className="chip chip-link" to="/report">Intel report</Link>
        </div>
      </section>

      <section className="card">
        <p className="section-kicker">Operating principle</p>
        <h2 className="section-title">Causality over charts</h2>
        <div className="status-panel">
          <p className="status-note">
            SCOUT does not start with charts. It starts with operational context, then shows the live
            pipeline, then surfaces propagation and mitigation.
          </p>
          <p className="status-note">
            Every screen is designed to answer one question: what changed, what is affected, and what
            should we do next?
          </p>
        </div>
      </section>
    </div>
  );
}
