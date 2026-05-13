import { useMemo } from "react";

const stageOrder = ["ingestion", "nlp", "graph", "risk", "mitigation"];

function MetricGrid({ title, metrics }) {
  return (
    <section className="metric-block">
      <h3>{title}</h3>
      <div className="metric-grid">
        {Object.entries(metrics).map(([key, value]) => (
          <article className="metric-tile" key={key}>
            <span>{key}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}

export default function PipelinePage({ pipelineRun, running }) {
  const currentStageIndex = useMemo(() => {
    if (!pipelineRun) return 0;
    const active = pipelineRun.stages.findIndex((stage) => stage.status === "active");
    return active >= 0 ? active : pipelineRun.stages.length - 1;
  }, [pipelineRun]);

  return (
    <div className="grid pipeline-grid">
      <section className="card full pipeline-hero">
        <p className="section-kicker">Live orchestration screen</p>
        <h2>Pipeline execution in progress</h2>
        <p className="section-copy">
          SCOUT is ingesting sources, extracting entities, materializing the graph, and preparing
          risk propagation output before returning you to mission control.
        </p>
        <div className="pipeline-progress">
          {stageOrder.map((key, index) => {
            const stage = pipelineRun?.stages?.[index];
            const status = stage?.status || (index <= currentStageIndex ? "complete" : "pending");
            return (
              <article className={`pipeline-step ${status}`} key={key}>
                <span>{index + 1}</span>
                <strong>{stage?.label || key}</strong>
                <p>{stage?.detail || "Waiting"}</p>
                <div className="pipeline-bar"><i style={{ width: `${stage?.progress ?? (status === "complete" ? 100 : 0)}%` }} /></div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="card">
        <h2>Ingestion stats</h2>
        <MetricGrid title="Data ingestion" metrics={pipelineRun?.metrics?.ingestion || { connected: 0, processed: 0, synced: 0 }} />
      </section>

      <section className="card">
        <h2>NLP extraction stats</h2>
        <MetricGrid title="NLP extraction" metrics={pipelineRun?.metrics?.nlp || { entities: 0, suppliers: 0, ports: 0, commodities: 0 }} />
      </section>

      <section className="card">
        <h2>Graph processing</h2>
        <MetricGrid title="Graph materialization" metrics={pipelineRun?.metrics?.graph || { nodes: 0, relationships: 0, exposurePaths: 0, criticalChains: 0 }} />
      </section>

      <section className="card">
        <h2>Risk engine</h2>
        <MetricGrid title="Risk propagation" metrics={pipelineRun?.metrics?.risk || { high: 0, critical: 0, multiHop: 0 }} />
      </section>

      <section className="card full">
        <h2>Execution notes</h2>
        <div className="pipeline-summary">
          {(pipelineRun?.summary || [running ? "Processing live pipeline..." : "Waiting for execution."]).map((item) => (
            <div className="pipeline-note" key={item}>{item}</div>
          ))}
        </div>
      </section>
    </div>
  );
}