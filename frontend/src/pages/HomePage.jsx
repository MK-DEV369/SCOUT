import { Link } from "react-router-dom";
import moryakanthaImg from "@/lib/moryakantha.jpeg";
import vineetrajImg from "@/lib/VineetRaj.jpg";
import { Button } from "@/components/ui/button";
import { useMemo, useState } from "react";

const teamGalleryImages = [
  {
    src: moryakanthaImg,
    alt: "L Moryakantha",
    title: "L Moryakantha",
    usn: "1RV24AI406",
    branch: "AIML",
  },
  {
    src: vineetrajImg,
    alt: "Vineet Raj",
    title: "Vineet Raj",
    usn: "1RV23AI132",
    branch: "AIML",
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

export default function HomePage() {
  const shuffledTeamImages = useMemo(() => shuffleArray(teamGalleryImages), []);
  const [hoveredPillar, setHoveredPillar] = useState(null);

  const pillars = [
    {
      id: "pipeline",
      title: "Pipeline Ingestion",
      description: "Monitor live multi-source data ingestion streams, spaCy entity extraction, and NLP pipeline runs.",
      badge: "Active",
      color: "var(--blue)",
      to: "/pipeline"
    },
    {
      id: "dashboard",
      title: "Control Dashboard",
      description: "Access the main supply chain cockpit tracking supplier exposures, risk scores, and active logs.",
      badge: "Live",
      color: "var(--aqua)",
      to: "/dashboard"
    },
    {
      id: "graph",
      title: "Graph Explorer",
      description: "Visualize relational path mappings tracing exposure propagation from events to manufacturers.",
      badge: "Interactive",
      color: "#8e7dff",
      to: "/graph"
    },
    {
      id: "alerts",
      title: "Disruption Alerts",
      description: "Investigate and resolve ranked risk alerts prioritized by multi-factor threat severity scores.",
      badge: "Real-time",
      color: "var(--rose)",
      to: "/alerts"
    },
    {
      id: "suppliers",
      title: "Supplier Profiles",
      description: "Manage registered suppliers, configure geographic profiles, and assign importance ratings.",
      badge: "Configurable",
      color: "var(--amber)",
      to: "/suppliers"
    },
    {
      id: "analytics",
      title: "Analytics Hotspots",
      description: "Explore the global risk map, data ingestion metrics, and storage vacuum logs.",
      badge: "Spatial",
      color: "#06d6a0",
      to: "/analytics"
    },
    {
      id: "report",
      title: "Intel Reports",
      description: "Draft publication-grade executive briefs and generate page-sliced PDF or Word document exports.",
      badge: "Ready",
      color: "#ffd166",
      to: "/report"
    }
  ];

  const steps = [
    { num: "01", name: "SME Onboarding", desc: "Configure custom supply chain profiles & parameters." },
    { num: "02", name: "Ingestion Engine", desc: "Aggregate global data sources and de-duplicate." },
    { num: "03", name: "NLP Analysis", desc: "Perform named entity extraction & categorization." },
    { num: "04", name: "Risk Scoring", desc: "Determine threat level based on multi-factor weighting." },
    { num: "05", name: "Graph Propagation", desc: "Trace supply chain impact paths and ripple effects." },
    { num: "06", name: "Cockpit Dashboard", desc: "Investigate live alerts, maps, and generate reports." }
  ];

  return (
    <div className="grid home-grid" style={{ gap: "30px", padding: "20px" }}>
      {/* Hero Section */}
      <section className="card home-hero home-hero--operational" style={{ gridColumn: "1 / -1", padding: "50px 40px", background: "linear-gradient(135deg, rgba(8, 28, 51, 0.95), rgba(4, 11, 20, 0.98))" }}>
        <div className="hero-brand" style={{ maxWidth: "800px" }}>
          <h1 style={{ fontSize: "2.8rem", fontWeight: "800", color: "#eff5ff", marginBottom: "12px", lineHeight: "1.2", letterSpacing: "-0.02em" }}>
            SCOUT Control Tower
          </h1>
          <p style={{ fontSize: "1.15rem", color: "var(--muted)", lineHeight: "1.6", marginBottom: "30px", textAlign: "justify" }}>
            A cognitive risk monitoring system leveraging multi-source intelligence, advanced NLP pipeline classification, and knowledge graph propagation to protect global supply chains.
          </p>
          <div className="hero-actions" style={{ display: "flex", gap: "16px" }}>
            <Button asChild size="lg" className="btn-animate-pipeline" style={{ padding: "14px 28px", fontWeight: "bold" }}>
              <Link to="/pipeline">Launch Cockpit</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="btn-animate-graph" style={{ padding: "14px 28px", fontWeight: "bold" }}>
              <Link to="/graph">Explore Graph</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Core Pillars */}
      <section className="card full" style={{ gridColumn: "1 / -1", background: "transparent", border: "none", boxShadow: "none", padding: 0 }}>
        <h2 style={{ fontSize: "1.5rem", color: "#eff5ff", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "var(--aqua)" }}></span>
          Core Capabilities
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
          {pillars.map((pillar) => (
            <Link
              key={pillar.id}
              to={pillar.to}
              style={{ textDecoration: "none" }}
            >
              <div
                style={{
                  background: "rgba(10, 20, 30, 0.45)",
                  border: "1px solid var(--line)",
                  borderTop: hoveredPillar === pillar.id ? `3px solid ${pillar.color}` : "1px solid var(--line)",
                  borderRadius: "20px",
                  padding: "24px",
                  height: "100%",
                  boxSizing: "border-box",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)",
                  transform: hoveredPillar === pillar.id ? "translateY(-5px)" : "translateY(0)",
                  boxShadow: hoveredPillar === pillar.id ? `0 10px 25px rgba(0,0,0,0.5), 0 0 10px ${pillar.color}20` : "none",
                  cursor: "pointer"
                }}
                onMouseEnter={() => setHoveredPillar(pillar.id)}
                onMouseLeave={() => setHoveredPillar(null)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: "600" }}>Pillar</span>
                  <span style={{ fontSize: "0.7rem", background: `${pillar.color}15`, color: pillar.color, border: `1px solid ${pillar.color}30`, padding: "2px 8px", borderRadius: "10px", fontWeight: "bold", textTransform: "uppercase" }}>
                    {pillar.badge}
                  </span>
                </div>
                <h3 style={{ fontSize: "1.15rem", color: "#eff5ff", margin: "0 0 8px 0", fontWeight: "700" }}>{pillar.title}</h3>
                <p style={{ fontSize: "0.85rem", color: "var(--muted)", lineHeight: "1.5", margin: 0, textAlign: "justify" }}>{pillar.description}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Execution Sequence Flow */}
      <section className="card full" style={{ gridColumn: "1 / -1" }}>
        <h2 style={{ fontSize: "1.4rem", color: "#eff5ff", marginBottom: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#8e7dff" }}></span>
          Cognitive Pipeline Execution
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "15px" }}>
          {steps.map((step) => (
            <div key={step.num} style={{ background: "rgba(255,255,255,0.01)", border: "1px solid var(--line)", padding: "18px", borderRadius: "16px", position: "relative" }}>
              <span style={{ position: "absolute", top: "10px", right: "12px", fontSize: "1.5rem", fontWeight: "900", color: "rgba(255,255,255,0.03)", fontFamily: "monospace" }}>
                {step.num}
              </span>
              <span style={{ display: "inline-block", fontSize: "0.85rem", background: "rgba(142, 125, 255, 0.1)", color: "#8e7dff", padding: "1px 6px", borderRadius: "4px", fontWeight: "bold", marginBottom: "8px" }}>
                Step {step.num}
              </span>
              <h4 style={{ fontSize: "0.9rem", color: "#eff5ff", margin: "0 0 6px 0", fontWeight: "700" }}>{step.name}</h4>
              <p style={{ fontSize: "0.75rem", color: "var(--muted)", margin: 0, lineHeight: "1.4", textAlign: "justify" }}>{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tech Stack & Team */}
      <section className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div>
          <p className="section-kicker">Implementation</p>
          <h2 className="section-title">Technological Backbone</h2>
          <p style={{ fontSize: "0.85rem", color: "var(--muted)", lineHeight: "1.5", marginBottom: "20px" }}>
            SCOUT relies on a state-of-the-art hybrid architecture combining pythonic data scrapers, machine learning models, and real-time frontend visualizations.
          </p>
        </div>
        <div className="stack-chips" style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {[
            "FastAPI",
            "PostgreSQL",
            "APScheduler",
            "spaCy",
            "DistilBERT",
            "Mistral-7B",
            "React",
            "Recharts",
            "CUDA",
            "Databricks"
          ].map((item) => (
            <span className="chip" key={item} style={{ background: "rgba(255,255,255,0.05)", border: "1px solid var(--line)", padding: "4px 10px", borderRadius: "8px", fontSize: "0.75rem", color: "#eff5ff" }}>{item}</span>
          ))}
        </div>
      </section>

      <section className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div>
          <p className="section-kicker">Differentiation</p>
          <h2 className="section-title">Core Innovations</h2>
          <ul className="plain-list" style={{ paddingLeft: 0, listStyle: "none", fontSize: "0.85rem", color: "var(--muted)", lineHeight: "1.6" }}>
            <li style={{ marginBottom: "10px", display: "flex", gap: "8px" }}>
              <span style={{ color: "var(--aqua)" }}>✓</span>
              <span><strong>Cross-Source Fusion:</strong> Aggregates disparate news feeds, conflict logs, and macro indicators into a single unified record.</span>
            </li>
            <li style={{ marginBottom: "10px", display: "flex", gap: "8px" }}>
              <span style={{ color: "var(--aqua)" }}>✓</span>
              <span><strong>Explainable Risk:</strong> Decomposes risk ratings into explicit, auditable metrics (severity, recency, credibility, relevance).</span>
            </li>
            <li style={{ display: "flex", gap: "8px" }}>
              <span style={{ color: "var(--aqua)" }}>✓</span>
              <span><strong>Zero-Neo4j Fallback:</strong> Local PostgreSQL-backed relational graph engine enables instant path-tracing with zero deployment overhead.</span>
            </li>
          </ul>
        </div>
      </section>

      <section className="card full" style={{ gridColumn: "1 / -1" }}>
        <p className="section-kicker">Team</p>
        <h2 className="section-title" style={{ marginBottom: "20px" }}>Core Developers</h2>
        
        {/* Staggered Team Grid Layout */}
        <div className="team-staggered-grid" style={{ 
          display: "grid", 
          gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", 
          gap: "30px", 
          marginTop: "20px",
          perspective: "1000px"
        }}>
          {shuffledTeamImages.map((member, index) => (
            <article key={member.title} className="team-stagger-card" style={{
              background: "linear-gradient(135deg, rgba(13, 27, 43, 0.7), rgba(8, 17, 27, 0.9))",
              border: "1px solid var(--line)",
              borderRadius: "24px",
              padding: "24px",
              textAlign: "center",
              boxShadow: "0 15px 35px rgba(0,0,0,0.4)",
              transform: `rotateY(${index % 2 === 0 ? "6deg" : "-6deg"}) translateY(${index % 2 === 0 ? "0px" : "20px"})`,
              transition: "transform 0.4s ease, box-shadow 0.4s ease, border-color 0.4s ease",
              cursor: "pointer",
              position: "relative",
              overflow: "hidden"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-10px) rotateY(0deg) scale(1.02)";
              e.currentTarget.style.borderColor = "var(--aqua)";
              e.currentTarget.style.boxShadow = "0 20px 45px rgba(6, 214, 160, 0.25)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = `rotateY(${index % 2 === 0 ? "6deg" : "-6deg"}) translateY(${index % 2 === 0 ? "0px" : "20px"})`;
              e.currentTarget.style.borderColor = "var(--line)";
              e.currentTarget.style.boxShadow = "0 15px 35px rgba(0,0,0,0.4)";
            }}
            >
              <div style={{ 
                width: "180px", 
                height: "180px", 
                borderRadius: "50%", 
                margin: "0 auto 20px", 
                overflow: "hidden", 
                border: "3px solid var(--line)",
                boxShadow: "0 8px 20px rgba(0,0,0,0.3)",
                transition: "border-color 0.4s ease"
              }} className="team-avatar-wrap">
                <img 
                  src={member.src} 
                  alt={member.alt} 
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                />
              </div>
              <h3 style={{ fontSize: "1.4rem", color: "#fff", margin: "0 0 6px 0" }}>{member.title}</h3>
              <p style={{ color: "var(--aqua)", fontSize: "0.85rem", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 12px 0" }}>{member.branch} Developer</p>
              <div style={{ background: "rgba(255, 255, 255, 0.03)", borderRadius: "12px", padding: "10px 14px", border: "1px solid rgba(255,255,255,0.05)" }}>
                <span style={{ display: "block", fontSize: "0.75rem", color: "var(--muted)", textTransform: "uppercase", marginBottom: "2px" }}>USN Identification</span>
                <strong style={{ fontSize: "0.95rem", color: "#eff5ff", fontFamily: "monospace" }}>{member.usn}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
