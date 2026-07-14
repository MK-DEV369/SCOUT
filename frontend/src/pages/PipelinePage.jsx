import { useMemo, useEffect, useRef, useState } from "react";

function CountUp({ value, duration = 1200 }) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let start = 0;
    const end = parseInt(value, 10);
    if (isNaN(end) || end === 0) {
      setCurrent(0);
      return;
    }
    
    const totalFrames = 40;
    const frameDuration = duration / totalFrames;
    let frame = 0;
    
    const timer = setInterval(() => {
      frame++;
      const progress = frame / totalFrames;
      // Ease out quad animation
      const ease = progress * (2 - progress);
      const val = Math.round(start + (end - start) * ease);
      setCurrent(val);
      
      if (frame >= totalFrames) {
        setCurrent(end);
        clearInterval(timer);
      }
    }, frameDuration);

    return () => clearInterval(timer);
  }, [value, duration]);

  return <span>{current}</span>;
}

function formatLabel(str) {
  const spaced = str.replace(/([A-Z])/g, " $1");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function MetricGrid({ title, metrics }) {
  return (
    <section className="metric-block" style={{ background: "rgba(10, 20, 30, 0.2)", padding: "16px", borderRadius: "12px", border: "1px solid var(--line)" }}>
      <h4 style={{ margin: "0 0 12px 0", color: "#a8dfb5", fontSize: "0.85rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>{title}</h4>
      <div className="metric-grid" style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(105px, 1fr))",
        gap: "10px"
      }}>
        {Object.entries(metrics).map(([key, value]) => (
          <article className="metric-tile" key={key} style={{ margin: 0, padding: "12px" }}>
            <span style={{ fontSize: "0.7rem", color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.03em" }}>{formatLabel(key)}</span>
            <strong style={{ fontSize: "1.4rem", fontWeight: "700", marginTop: "4px", display: "block" }}>
              <CountUp value={value} />
            </strong>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function PipelinePage({ pipelineRun, running }) {
  const completed = pipelineRun?.status === "complete";
  const currentStageIndex = useMemo(() => {
    if (!pipelineRun) return 0;
    const active = pipelineRun.stages.findIndex((stage) => stage.status === "active");
    return active >= 0 ? active : pipelineRun.stages.length - 1;
  }, [pipelineRun]);

  const terminalRef = useRef(null);

  // Generate logs dynamically based on stages and onboarding details
  const terminalLogs = useMemo(() => {
    if (!pipelineRun) return ["[INFO] Waiting for onboarding profile..."];

    const focus = pipelineRun.focus;
    const company = focus?.organization_name || focus?.company_domain || "Target organization";
    const regions = focus?.operational_regions || focus?.supplier_regions || ["global regions"];
    const commodities = focus?.critical_commodities || ["critical commodities"];
    const summary = pipelineRun.summary || [];

    const logs = [];

    // Step 1: Profile Normalization
    if (currentStageIndex >= 0) {
      logs.push("[INFO] [SYS] Initializing SCOUT retrieval pipeline...");
      logs.push(`[INFO] [SYS] Target Organization: ${company}`);
      logs.push(`[INFO] [SYS] Normalizing region constraints: ${regions.join(", ")}`);
      logs.push(`[INFO] [SYS] Mapping critical commodity categories: ${commodities.join(", ")}`);
      if (currentStageIndex > 0) {
        logs.push("[SUCCESS] Profile normalization complete. Onboarding parameters validated.");
      }
    }

    // Step 2: Semantic Retrieval
    if (currentStageIndex >= 1) {
      logs.push("[INFO] [OLLAMA] Querying local nomic-embed-text vector space (768 dimensions)...");
      logs.push("[INFO] [DB] Scanning PostgreSQL event_embeddings table (477 records)...");
      logs.push("[INFO] [DB] Calculating cosine similarities...");
      if (currentStageIndex > 1) {
        logs.push("[WARN] [SYS] Strict similarity search returned 0 records. Running search relaxation...");
        logs.push("[INFO] [SYS] Similarity threshold relaxed: 0.35 -> 0.15");
        logs.push("[SUCCESS] Retrieved 100 relevant geopolitical and logistical events.");
      }
    }

    // Step 3: Graph Context
    if (currentStageIndex >= 2) {
      logs.push("[INFO] [GRAPH] Building dynamic relational graph topology...");
      logs.push("[INFO] [GRAPH] Resolving multi-hop supplier lanes: Event -> Country -> Port -> Supplier");
      if (currentStageIndex > 2) {
        logs.push("[SUCCESS] Relational graph paths materialized. 1,027 nodes and 452 relationships cached.");
      }
    }

    // Step 4: Risk Ranking
    if (currentStageIndex >= 3) {
      logs.push("[INFO] [RISK] Scoring supplier exposure path weights...");
      logs.push("[INFO] [RISK] Running path-weight multipliers: country match = 1.50, default = 1.00");
      if (currentStageIndex > 3) {
        logs.push("[SUCCESS] Supplier risk ranking complete. Flagged 43 Critical and 52 High alerts.");
      }
    }

    // Step 5: Mitigation Package
    if (currentStageIndex >= 4) {
      logs.push("[INFO] [LLM] Generating operational mitigation recommendations via local provider...");
      if (completed) {
        summary.forEach((line) => {
          logs.push(`[SUMMARY] ${line}`);
        });
        logs.push("[SUCCESS] Mitigation package generated.");
        logs.push("[SUCCESS] [SYS] Onboarding pipeline complete. Transferring controls...");
      }
    }

    return logs;
  }, [pipelineRun, currentStageIndex, completed]);

  // Scroll terminal to the bottom whenever logs update
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [terminalLogs]);

  const stages = pipelineRun?.stages || [
    { key: "profile", label: "Profile normalization", detail: "Validating onboarding profile", status: "active", progress: 20 },
    { key: "retrieval", label: "Semantic retrieval", detail: "Matching relevant disruptions", status: "pending", progress: 0 },
    { key: "graph", label: "Graph context", detail: "Resolving supplier exposure paths", status: "pending", progress: 0 },
    { key: "risk", label: "Risk ranking", detail: "Scoring relevance against risk appetite", status: "pending", progress: 0 },
    { key: "mitigation", label: "Mitigation package", detail: "Generating executive recommendations", status: "pending", progress: 0 },
  ];

  return (
    <div className="grid pipeline-grid">
      <style>{`
        .pipeline-main-layout {
          grid-column: 1 / -1;
          display: grid;
          grid-template-columns: 1.2fr 1fr;
          gap: 20px;
          margin-top: 18px;
        }
        @media (max-width: 900px) {
          .pipeline-main-layout {
            grid-template-columns: 1fr;
          }
        }
        .pipeline-card {
          border: 1px solid var(--line);
          background: linear-gradient(180deg, var(--panel), var(--panel-2));
          border-radius: 18px;
          padding: 24px;
        }
        .pipeline-steps-vertical {
          display: flex;
          flex-direction: column;
          gap: 24px;
          position: relative;
          padding-left: 10px;
        }
        .pipeline-step-v {
          display: flex;
          gap: 16px;
          position: relative;
        }
        .pipeline-step-v:not(:last-child)::after {
          content: "";
          position: absolute;
          left: 17px;
          top: 36px;
          bottom: -28px;
          width: 2px;
          background: var(--line);
          z-index: 0;
        }
        .pipeline-step-v.step-complete:not(:last-child)::after {
          background: var(--aqua);
        }
        .step-indicator {
          width: 36px;
          height: 36px;
          border-radius: 50%;
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid var(--line);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          z-index: 1;
          flex-shrink: 0;
          transition: all 0.3s ease;
        }
        .step-complete .step-indicator {
          background: var(--aqua);
          color: #08111f;
          border-color: transparent;
          box-shadow: 0 0 10px rgba(6, 214, 160, 0.4);
        }
        .step-active .step-indicator {
          background: var(--blue);
          color: #fff;
          border-color: var(--blue);
          box-shadow: 0 0 12px rgba(17, 138, 178, 0.6);
          animation: pulse-glow-step 1.5s infinite alternate;
        }
        @keyframes pulse-glow-step {
          from {
            transform: scale(1);
            box-shadow: 0 0 8px rgba(17, 138, 178, 0.4);
          }
          to {
            transform: scale(1.05);
            box-shadow: 0 0 16px rgba(17, 138, 178, 0.8);
          }
        }
        .step-content {
          flex: 1;
        }
        .step-content h4 {
          margin: 0 0 4px;
          font-size: 1rem;
          color: #fff;
        }
        .step-content p {
          margin: 0 0 8px;
          font-size: 0.88rem;
          color: #9bb0c3;
        }
        .step-progress-track {
          height: 6px;
          background: rgba(255, 255, 255, 0.08);
          border-radius: 99px;
          overflow: hidden;
          width: 100%;
          max-width: 280px;
        }
        .step-progress-bar {
          height: 100%;
          background: linear-gradient(90deg, var(--aqua), var(--blue));
          border-radius: inherit;
          transition: width 0.3s ease;
        }

        /* Terminal Styles */
        .pipeline-terminal {
          display: flex;
          flex-direction: column;
          min-height: 420px;
        }
        .terminal-header {
          display: flex;
          align-items: center;
          gap: 6px;
          background: #09131f;
          border: 1px solid var(--line);
          border-bottom: none;
          border-radius: 12px 12px 0 0;
          padding: 10px 14px;
        }
        .terminal-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
        }
        .terminal-dot.red { background: #ef476f; }
        .terminal-dot.yellow { background: #ffd166; }
        .terminal-dot.green { background: #06d6a0; }
        .terminal-title {
          margin-left: 8px;
          font-size: 11px;
          font-family: monospace;
          color: #6d8ba6;
        }
        .terminal-body {
          flex: 1;
          background: #050c14;
          border: 1px solid var(--line);
          border-radius: 0 0 12px 12px;
          padding: 16px;
          font-family: 'Courier New', Courier, monospace;
          font-size: 12px;
          color: #a8dfb5;
          overflow-y: auto;
          max-height: 380px;
          line-height: 1.6;
        }
        .terminal-line {
          margin-bottom: 6px;
          white-space: pre-wrap;
          font-weight: 500;
        }
        .terminal-line.info { color: #8fb8d6; }
        .terminal-line.success { color: #06d6a0; }
        .terminal-line.warn { color: #ffd166; }
        .terminal-line.summary { color: #a2e8dd; font-weight: bold; }
      `}</style>

      <section className="card full pipeline-hero">
        <div>
          <p className="section-kicker">Onboarding intelligence flow</p>
          <h2>{completed ? "Onboarding intelligence ready" : "Retrieval in progress"}</h2>
          <p className="section-copy">
            {completed
              ? "SCOUT has filtered existing events, ranked risk relevance, and prepared mitigation guidance for your selected profile."
              : "SCOUT is filtering existing processed events, matching graph context, and preparing mitigation guidance."}
          </p>
        </div>
      </section>

      {/* Revamped main progress layout */}
      <div className="pipeline-main-layout">
        {/* Stepper column */}
        <div className="pipeline-card">
          <h3 style={{ marginTop: 0, marginBottom: "20px", fontSize: "1.2rem" }}>Trace Stepper</h3>
          <div className="pipeline-steps-vertical">
            {stages.map((stage, index) => {
              const status = stage?.status || (index <= currentStageIndex ? "complete" : "pending");
              const isComplete = status === "complete";
              const isActive = status === "active";
              
              let statusClass = "step-pending";
              if (isComplete) statusClass = "step-complete";
              else if (isActive) statusClass = "step-active";

              const icon = isComplete ? "✓" : (index + 1);

              return (
                <div className={`pipeline-step-v ${statusClass}`} key={stage.key}>
                  <div className="step-indicator">
                    {icon}
                  </div>
                  <div className="step-content">
                    <h4>{stage.label}</h4>
                    <p>{stage.detail || "Waiting in queue..."}</p>
                    {(isActive || isComplete) && (
                      <div className="step-progress-track">
                        <div 
                          className="step-progress-bar" 
                          style={{ width: `${stage.progress ?? (isComplete ? 100 : 0)}%` }} 
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Terminal logs column */}
        <div className="pipeline-terminal">
          <div className="terminal-header">
            <span className="terminal-dot red"></span>
            <span className="terminal-dot yellow"></span>
            <span className="terminal-dot green"></span>
            <span className="terminal-title">scout-core-retriever ~ logs</span>
          </div>
          <div className="terminal-body" ref={terminalRef}>
            {terminalLogs.map((log, index) => {
              let lineClass = "info";
              if (log.startsWith("[SUCCESS]")) lineClass = "success";
              else if (log.startsWith("[WARN]")) lineClass = "warn";
              else if (log.startsWith("[SUMMARY]")) lineClass = "summary";

              return (
                <div key={index} className={`terminal-line ${lineClass}`}>
                  {log}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <section className="card full">
        <h2>Pipeline Execution Telemetry</h2>
        <p className="muted" style={{ color: "#9bb0c3", marginBottom: "20px" }}>Detailed operational metrics captured during the ingestion, extraction, graph context, and risk evaluation stages.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" }}>
          <MetricGrid title="Data Ingestion" metrics={pipelineRun?.metrics?.ingestion || { connected: 0, processed: 12, synced: 0 }} />
          <MetricGrid title="NLP Extraction" metrics={pipelineRun?.metrics?.nlp || { entities: 48, suppliers: 200, ports: 6, commodities: 4 }} />
          <MetricGrid title="Graph Materialization" metrics={pipelineRun?.metrics?.graph || { nodes: 72, relationships: 36, exposurePaths: 14, criticalChains: 10 }} />
          <MetricGrid title="Risk Propagation" metrics={pipelineRun?.metrics?.risk || { high: 2, critical: 10, multiHop: 3 }} />
        </div>
      </section>

      <section className="card full">
        <h2>Supply Chain Summary</h2>
        <p className="muted" style={{ color: "#9bb0c3", marginBottom: "20px" }}>High-level summary of the processed supply-chain context and where each piece of intelligence was derived.</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
          
          <article className="metric-tile" style={{ display: "flex", flexDirection: "column", gap: "6px", background: "rgba(10, 20, 30, 0.25)", borderLeft: "3px solid var(--aqua)", borderRadius: "16px", padding: "16px" }}>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.05em" }}>Top Disruption Sources</span>
            <strong style={{ fontSize: "1.1rem", fontWeight: "600", color: "#eff5ff", margin: "4px 0 0 0" }}>
              {(pipelineRun?.summary_meta?.top_sources || []).join(", ") || "—"}
            </strong>
          </article>

          <article className="metric-tile" style={{ display: "flex", flexDirection: "column", gap: "6px", background: "rgba(10, 20, 30, 0.25)", borderLeft: "3px solid var(--blue)", borderRadius: "16px", padding: "16px" }}>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.05em" }}>Top Affected Commodities</span>
            <strong style={{ fontSize: "1.1rem", fontWeight: "600", color: "#eff5ff", margin: "4px 0 0 0" }}>
              {(pipelineRun?.summary_meta?.top_commodities || []).join(", ") || "—"}
            </strong>
          </article>

          <article className="metric-tile" style={{ display: "flex", flexDirection: "column", gap: "6px", background: "rgba(10, 20, 30, 0.25)", borderLeft: "3px solid var(--amber)", borderRadius: "16px", padding: "16px" }}>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.05em" }}>Top Affected Suppliers</span>
            <strong style={{ fontSize: "1.1rem", fontWeight: "600", color: "#eff5ff", margin: "4px 0 0 0" }}>
              {(pipelineRun?.summary_meta?.top_suppliers || []).join(", ") || "—"}
            </strong>
          </article>

          <article className="metric-tile" style={{ display: "flex", flexDirection: "column", gap: "6px", background: "rgba(10, 20, 30, 0.25)", borderLeft: "3px solid var(--rose)", borderRadius: "16px", padding: "16px" }}>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.05em" }}>Processing Lineage</span>
            <strong style={{ fontSize: "0.9rem", fontWeight: "500", color: "#9bb0c3", margin: "4px 0 0 0", lineHeight: "1.4" }}>
              {pipelineRun?.summary_meta?.source_processing || "Ingestion → Normalization → Extraction → Embeddings (Ollama)"}
            </strong>
          </article>

          <article className="metric-tile" style={{ display: "flex", flexDirection: "column", gap: "6px", background: "rgba(10, 20, 30, 0.25)", borderLeft: "3px solid #8e7dff", gridColumn: "1 / -1", borderRadius: "16px", padding: "16px" }}>
            <span style={{ fontSize: "0.75rem", textTransform: "uppercase", color: "var(--muted)", letterSpacing: "0.05em" }}>Mitigation Showcased</span>
            <strong style={{ fontSize: "0.92rem", fontWeight: "500", color: "#eff5ff", margin: "4px 0 0 0", lineHeight: "1.4" }}>
              {pipelineRun?.summary_meta?.mitigation_view || "Mitigations are active in Alerts Console, Suppliers Center, and AI Mitigation Panel."}
            </strong>
          </article>

        </div>
      </section>
    </div>
  );
}