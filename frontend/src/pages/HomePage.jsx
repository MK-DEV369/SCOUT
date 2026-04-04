import { Link } from "react-router-dom";

const teamMembers = [
  { role: "AI/ML Student", name: "Placeholder AIML 1", stream: "AIML" },
  { role: "AI/ML Student", name: "Placeholder AIML 2", stream: "AIML" },
  { role: "CS Student", name: "Placeholder CS 1", stream: "CS" },
  { role: "IS Student", name: "Placeholder IS 1", stream: "IS" },
  { role: "IS Student", name: "Placeholder IS 2", stream: "IS" },
];

const objectives = [
  "Detect disruption risks earlier from global events and news.",
  "Normalize multi-source data into a single schema for downstream ML.",
  "Generate ranked, supplier-specific alerts with explainable features.",
];

const methodology = [
  "Ingest -> Deduplicate -> Normalize",
  "NER + Event Classification + Summarization",
  "Risk Feature Engineering + Score + Alerting",
  "Knowledge Graph propagation for ripple-effect modeling",
];

export default function HomePage() {
  return (
    <div className="grid home-grid">
      <section className="card home-hero">
        <p className="eyebrow">SCOUT MainEL</p>
        <h2>AI-powered supply disruption intelligence platform</h2>
        <p className="subtle">
          A unified system for multi-source ingestion, NLP-driven event intelligence, risk scoring, and
          supplier impact mapping.
        </p>
        <div className="hero-actions">
          <Link className="cta-link" to="/dashboard">Open Dashboard</Link>
          <Link className="cta-link secondary" to="/alerts">View Alerts</Link>
        </div>
      </section>

      <section className="card">
        <h2>How The Project Works</h2>
        <ol className="flow-list">
          <li>Collect data from GDELT, NewsAPI, Freightos, World Bank, ACLED, and FRED.</li>
          <li>Apply SHA-256 deduplication and unified schema normalization.</li>
          <li>Run NLP pipeline to extract entities, classify event type, and generate summaries.</li>
          <li>Compute risk scores and alert levels per event and supplier context.</li>
          <li>Propagate impacts through the knowledge graph for indirect risk detection.</li>
        </ol>
      </section>

      <section className="card">
        <h2>Tech Stack</h2>
        <div className="stack-chips">
          {[
            "FastAPI",
            "PostgreSQL",
            "APScheduler",
            "spaCy",
            "DistilBERT",
            "Mistral",
            "Neo4j",
            "React",
            "Recharts",
            "CUDA",
          ].map((item) => (
            <span className="chip" key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section className="card">
        <h2>Innovations</h2>
        <ul className="plain-list">
          <li>Unified event intelligence from heterogeneous geopolitical, economic, and logistics data.</li>
          <li>Hybrid AI pipeline combining rule-grounded extraction and transformer models.</li>
          <li>Knowledge graph propagation for ripple effects across supplier-manufacturer chains.</li>
        </ul>
      </section>

      <section className="card">
        <h2>Better Than Existing Solutions</h2>
        <ul className="plain-list">
          <li>Cross-source fusion instead of isolated single-feed monitoring.</li>
          <li>Risk scoring with transparent feature contributions for explainability.</li>
          <li>Operational dashboard unifying alerts, supplier context, trends, and map intelligence.</li>
        </ul>
      </section>

      <section className="card">
        <h2>Objectives</h2>
        <ul className="plain-list">
          {objectives.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Methodologies</h2>
        <ul className="plain-list">
          {methodology.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="card full">
        <h2>Teams Section</h2>
        <p className="subtle">Project placeholders: 2 AIML, 1 CS, 2 IS students.</p>
        <div className="team-grid">
          {teamMembers.map((member, index) => (
            <article className="team-card" key={`${member.role}-${index}`}>
              <h3>{member.name}</h3>
              <p>{member.role}</p>
              <span className="pill team-pill">{member.stream}</span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
