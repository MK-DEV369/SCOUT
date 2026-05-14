import { Link } from "react-router-dom";
import DomeGallery from "@/components/DomeGallery";
import moryakanthaImg from "@/lib/moryakantha.jpeg";
import { Button } from "@/components/ui/button";
import { useMemo } from "react";

const teamGalleryImages = [
  {
    src: "https://images.unsplash.com/photo-1617050318658-a9a3175e34cb?q=80&w=1200&auto=format&fit=crop",
    alt: "Shashank K",
    title: "Shashank K",
    usn: "1XX22AI001",
    branch: "AIML",
  },
  {
    src: moryakanthaImg,
    alt: "L Moryakantha",
    title: "L Moryakantha",
    usn: "1RV24AI406",
    branch: "AIML",
  },
  {
    src: "https://images.unsplash.com/photo-1609081144281-5b01f7f74531?q=80&w=1200&auto=format&fit=crop",
    alt: "Tulya Reddy",
    title: "Tulya Reddy",
    usn: "1XX22CS011",
    branch: "CS",
  },
  {
    src: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=1200&auto=format&fit=crop",
    alt: "Anirudh",
    title: "Anirudh",
    usn: "1XX22IS021",
    branch: "IS",
  },
  {
    src: "https://images.unsplash.com/photo-1560250097-0b93528c311a?q=80&w=1200&auto=format&fit=crop",
    alt: "Ankit Pathak",
    title: "Ankit Pathak",
    usn: "1XX22IS022",
    branch: "IS",
  },
];

const shuffleArray = (array) => {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const objectives = [
  "Detect operational disruption risks earlier from multi-source global events and news.",
  "Normalize multi-source data into a single schema for downstream ML.",
  "Generate ranked, supplier-specific alerts with explainable risk features and impact paths.",
];

const operatingPrinciples = [
  "Onboarding determines which suppliers, regions, and commodities matter.",
  "Pipeline execution shows ingestion → NLP (entity+classification+embeddings) → clustering → graph → risk → alerts.",
  "Dashboard views are mission control: real-time alerts, multihop graph paths, supplier impact, and mitigation recommendations.",
];

const methodology = [
  "Ingest -> Deduplicate -> Normalize",
  "NER + Event Classification + Summarization + Embeddings + Clustering",
  "Risk Feature Engineering + Weighted Scoring + Explainable Alert Levels",
  "Knowledge Graph propagation for ripple-effect modeling",
];

const capabilityNotes = [
  "FastAPI backend with live /ingest, /events, /risk, /alerts, /suppliers, /ml/cluster/run, /health, and graph endpoints.",
  "SentenceTransformer embeddings and event clustering enable operational event grouping and similarity intelligence.",
  "Debug logging traces each NLP stage (classifier, embeddings, clustering) so pipeline execution is fully observable.",
  "Risk scoring persists explainable features, alert levels, and source metadata for ranked supplier-impact transparency.",
  "Databricks notebook orchestration validates backend health and triggers clustering runs end-to-end.",
  "Shadcn UI is initialized on the Vite frontend, enabling rapid prototyping of new components.",
];

export default function HomePage() {
  const shuffledTeamImages = useMemo(() => shuffleArray(teamGalleryImages), []);

  return (
    <div className="grid home-grid">
      <section className="card home-hero home-hero--operational">
        <div className="hero-brand">
          <p className="section-copy">
            SCOUT is now a working late-MVP (~82%) control tower: multi-source ingestion, NLP extraction with embeddings and clustering,
            risk scoring, graph hooks, debug observability, and live dashboard views are fully wired end-to-end and production-hardened.
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
      </section>

      <section className="card full">
        <p className="section-kicker">Current status</p>
        <h2 className="section-title">What is already working</h2>
        <div className="status-panel">
          {capabilityNotes.map((item) => (
            <p key={item} className="status-note">
              {item}
            </p>
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
        <p className="section-kicker">Implementation</p>
        <h2 className="section-title">Tech stack</h2>
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
            "Databricks"
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
        <h2 className="section-title">Better than existing solutions</h2>
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
        <div className="team-dome-wrap">
          <DomeGallery
            images={shuffledTeamImages}
            fit={0.5}
            minRadius={800}
            maxVerticalRotationDeg={0}
            segments={34}
            dragDampening={1}
            grayscale
            openedImageWidth="420px"
            openedImageHeight="460px"
          />
        </div>
      </section>
    </div>
  );
}
