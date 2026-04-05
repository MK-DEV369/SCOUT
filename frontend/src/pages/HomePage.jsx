import { Link } from "react-router-dom";

const teamMembers = [
  { role: "AI/ML Student", name: "Shashank K", stream: "AIML" },
  { role: "AI/ML Student", name: "L Moryakantha", stream: "AIML" },
  { role: "CS Student", name: "Tulya Reddy", stream: "CS" },
  { role: "IS Student", name: "Anirudh", stream: "IS" },
  { role: "IS Student", name: "Ankit Pathak", stream: "IS" },
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
        <p className="section-copy">
          A unified system for multi-source ingestion, NLP-driven event intelligence, risk scoring, and
          supplier impact mapping.
        </p>
        <div className="hero-actions">
          <Link className="cta-link" to="/dashboard">Open Dashboard</Link>
          <Link className="cta-link secondary" to="/alerts">View Alerts</Link>
        </div>
        <div className="hero-stats">
          <div className="stat-tile">
            <strong>6</strong>
            <span>Live data sources unified</span>
          </div>
          <div className="stat-tile">
            <strong>3</strong>
            <span>AI layers: NLP, risk, graph</span>
          </div>
          <div className="stat-tile">
            <strong>1</strong>
            <span>Operational control tower</span>
          </div>
        </div>
      </section>

      <section className="card">
        <p className="section-kicker">Workflow</p>
        <h2 className="section-title">How The Project Works</h2>
        <ol className="flow-list">
          <li>Collect data from GDELT, NewsAPI, Freightos, World Bank, ACLED, and FRED.</li>
          <li>Apply SHA-256 deduplication and unified schema normalization.</li>
          <li>Run NLP pipeline to extract entities, classify event type, and generate summaries.</li>
          <li>Compute risk scores and alert levels per event and supplier context.</li>
          <li>Propagate impacts through the knowledge graph for indirect risk detection.</li>
        </ol>
      </section>

      <section className="card">
        <p className="section-kicker">Implementation</p>
        <h2 className="section-title">Tech Stack</h2>
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
        <p className="section-kicker">Differentiation</p>
        <h2 className="section-title">Innovations</h2>
        <ul className="plain-list">
          <li>Unified event intelligence from heterogeneous geopolitical, economic, and logistics data.</li>
          <li>Hybrid AI pipeline combining rule-grounded extraction and transformer models.</li>
          <li>Knowledge graph propagation for ripple effects across supplier-manufacturer chains.</li>
        </ul>
      </section>

      <section className="card">
        <p className="section-kicker">Value Proposition</p>
        <h2 className="section-title">Better Than Existing Solutions</h2>
        <ul className="plain-list">
          <li>Cross-source fusion instead of isolated single-feed monitoring.</li>
          <li>Risk scoring with transparent feature contributions for explainability.</li>
          <li>Operational dashboard unifying alerts, supplier context, trends, and map intelligence.</li>
        </ul>
      </section>

      <section className="card">
        <p className="section-kicker">Goals</p>
        <h2 className="section-title">Objectives</h2>
        <ul className="plain-list">
          {objectives.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="card">
        <p className="section-kicker">Method</p>
        <h2 className="section-title">Methodologies</h2>
        <ul className="plain-list">
          {methodology.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="card full">
        <p className="section-kicker">Team</p>
        <h2 className="section-title">Teams Section</h2>
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
