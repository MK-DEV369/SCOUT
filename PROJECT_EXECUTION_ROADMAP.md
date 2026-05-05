# SCOUT MainEL - Comprehensive Execution Roadmap

Date: 2026-04-22
Project Type: Data + AI + Systems Engineering Platform for Supply Chain Risk Intelligence
Planning Horizon: 8 weeks (MVP to integrated demo)

## Progress Update (2026-04-27)

Overall roadmap completion estimate: ~78%

Execution status by workstream:

1. Ingestion and ETL: Partially Complete
- Completed: connector set, normalization, dedup, ingestion scheduler/manual run, fallback persistence
- Pending: retry/backoff/rate-limit framework, source freshness metrics endpoint

2. Data Model and Persistence: Partially Complete
- Completed: core tables and indexes for primary query fields, unique dedup constraints
- Pending: migration framework (Alembic), advanced JSONB indexing strategy, production schema evolution workflow

3. NLP Pipeline: Partially Complete
- Completed: extraction/classification/summarization pipeline integrated and persisted into `event_records`
- Pending: benchmarked quality tracking (macro-F1), clustering, expanded evaluation harness

4. Risk Engine: Mostly Complete (MVP)
- Completed: weighted scoring formula, alert levels, persisted risk features, graph-aware composite score path
- Pending: richer factor decomposition APIs and calibration workflow automation

5. Graph Layer: Partially Complete
- Completed: Neo4j hooks, graph APIs, graceful disabled behavior
- Pending: broader ontology coverage and fully validated propagation explanation UX for all high-risk classes

6. API Surface: Mostly Complete (MVP)
- Completed: ingestion/events/risk/alerts/suppliers + health + graph + ML status/load routes
- Pending: pagination/filter enhancements across all endpoints and formal API contract tests

7. Frontend and Alert UX: Mostly Complete (MVP)
- Completed: core pages, API integration, charts/map, supplier flows, resilient refresh behavior on partial API failure
- Pending: deeper drill-down explainability UX and stronger empty/error-state design

8. Testing and Quality Gates: Not Started
- Pending: backend unit tests, integration tests, frontend tests, CI quality gates

9. Week-by-week Outcome Alignment
- Weeks 1-5 goals: largely achieved in implementation
- Weeks 6-8 goals: partially addressed; hardening/packaging/testing remains primary gap

## 1) Objective and Scope

Build a working, end-to-end intelligence system (not just a dashboard):

Data Sources -> ETL/Normalization -> NLP -> Risk Engine -> Graph Context -> Alerts -> Dashboard

This roadmap is designed to move from your already-strong architecture to a reliable, demo-ready, industry-style implementation.

## 2) Current State Assessment

Based on current repository structure and README, these capabilities already exist in codebase form:

- Multi-source ingestion connectors (GDELT, NewsAPI, Freightos, World Bank, ACLED, FRED)
- Unified schema and dedup flow
- FastAPI backend with phase/API routes
- NLP modules (entity extraction, classification, summarization)
- Risk engine and pipeline modules
- Neo4j client module for graph propagation hooks
- React dashboard with core pages and API integration points

Strengths to keep:

- Canonical/normalized payload approach
- Layered pipeline mindset (raw -> processed -> intelligence)
- Good module separation under backend/app
- Strong conceptual fit with industry architectures

Critical gaps to close for a strong execution finish:

- No strict MVP gate definition (must avoid over-engineering)
- Limited operational hardening (retry, rate-limit, observability, QA gates)
- Need tighter integration and acceptance criteria per phase
- Need reliable trend/anomaly and explainable alerts for high impact demo

## 3) Delivery Strategy (MVP First, Scale Later)

### 3.1 Build order (must follow)

1. Data pipeline reliability
2. NLP quality and event structuring
3. Risk scoring and alerting
4. Dashboard decision UX
5. Advanced intelligence (graph propagation, trends, forecasting)

### 3.2 Tech strategy

Phase 1 baseline:

- FastAPI + PostgreSQL + SQLAlchemy + APScheduler/Celery
- spaCy + DistilBERT for NLP
- Rule-weighted risk scoring

Phase 2 upgrades (after MVP is stable):

- Kafka for event streaming
- Spark/Flink for heavier processing
- Timescale optimizations and forecasting services
 - Databricks for distributed model training, embeddings, and batch evaluation

## 4) Target Architecture (Practical)

Data Sources
-> Ingestion Connectors
-> Raw Records (Bronze)
-> Normalization + Dedup (Silver)
-> NLP/Feature Enrichment
-> Event/Alert Intelligence (Gold)
-> Risk Engine
-> Graph Enrichment (Neo4j, optional in MVP)
-> FastAPI APIs
-> React Dashboard + Alert UX

## 5) Canonical Data Contract (Required)

Use one normalized event contract across all connectors and downstream processors.

```json
{
  "source": "gdelt",
  "external_id": "...",
  "event_type": "conflict|logistics|environmental|economic|other",
  "timestamp": "2026-04-22T12:34:56Z",
  "location": {
    "country": "...",
    "region": "...",
    "lat": 0.0,
    "lon": 0.0
  },
  "entities": {
    "companies": [],
    "countries": [],
    "ports": [],
    "commodities": []
  },
  "text": "...",
  "severity": 0.0,
  "credibility": 0.0,
  "supplier_relevance": 0.0,
  "frequency": 0.0,
  "metadata": {},
  "raw_data": {}
}
```

Rules:

- Every connector output must map to this schema.
- Unknown fields must stay in metadata/raw_data.
- All timestamps UTC ISO-8601.

## 6) Module-Level Execution Plan

This section maps tasks directly to your existing folder structure.

### 6.1 Ingestion and ETL

Paths:

- backend/app/ingestion/connectors
- backend/app/ingestion/service.py
- backend/app/ingestion/schema.py
- backend/app/ingestion/dedup.py
- backend/app/ingestion/scheduler.py

Tasks:

- Enforce connector interface consistency and typed return schema
- Add retry/backoff for each external source
- Add source-specific rate limiting and timeout defaults
- Add robust logging (success/failure counts, latency, errors)
- Improve dedup into deterministic event fingerprinting
- Add ingestion health metrics and source freshness checks

Deliverable:

- One-command ingestion run with per-source summary and zero crashes on partial source failure

Acceptance criteria:

- >=95% successful ingestion runs in test week
- Any single connector failure does not break pipeline
- Duplicate rate reduced and measured (report metric weekly)

### 6.2 Data Model and Persistence

Paths:

- backend/app/db/models.py
- backend/app/db/session.py
- backend/app/db/base.py

Tasks:

- Confirm raw/silver/gold persistence model boundaries
- Add indexes on timestamp, source, event_type, location fields
- Add JSONB indexes where needed for metadata/raw payload
- Add migration-safe constraints for required normalized fields

Optional advanced tables (v1+):

- event_clusters
- event_trends
- anomalies

Deliverable:

- Queryable, indexed storage that supports dashboard and API latency goals

Acceptance criteria:

- P95 API reads under target threshold for key endpoints
- No schema mismatch between ingestion output and DB constraints

### 6.3 NLP Pipeline

Paths:

- backend/app/nlp/entity_extractor.py
- backend/app/nlp/event_classifier.py
- backend/app/nlp/summarizer.py
- backend/app/nlp/pipeline.py
- backend/app/training/finetune_event_classifier.py

Tasks:

- Standardize NLP pipeline contract: input normalized event -> enriched event
- Tune spaCy extraction rules for supply-chain entities
- Train/tune DistilBERT labels: Geopolitical, Logistics, Environmental, Economic
- Add confidence thresholds and fallback classification
- Add optional summarization for alert explainability
- Add event clustering (sentence embeddings + cosine) for same-event grouping

Deliverable:

- Reproducible NLP enrichment pipeline with model loading status and metrics

Acceptance criteria:

- Classification macro-F1 target defined and tracked
- Entity extraction precision reviewed on sampled events
- Enriched records persist with confidence + summary fields

### 6.4 Risk Engine

Paths:

- backend/app/risk/engine.py
- backend/app/risk/pipeline.py

Core formula:

Risk Score =
w1*severity + w2*recency + w3*credibility + w4*supplier_relevance + w5*frequency

Tasks:

- Finalize feature engineering for all five core factors
- Add explicit alert thresholds: LOW/MEDIUM/HIGH/CRITICAL
- Add explainability payload per score (factor contribution breakdown)
- Add anomaly/trend multipliers (phase 2)
- Calibrate weights from historical/simulated cases

Deliverable:

- Deterministic, explainable scoring output and ranked alerts

Acceptance criteria:

- Alert output always includes score + level + rationale
- Score reproducibility for same input event set

### 6.5 Graph Layer (Differentiator)

Paths:

- backend/app/graph/neo4j_client.py

Tasks:

- Define ontology: Supplier, Country, Port, Commodity, Event
- Define key relations: located_in, affects, exports, dependent_on
- Add idempotent graph upserts from enriched/risked events
- Add query templates for impact propagation explanations

Deliverable:

- At least one graph-powered explanation shown in dashboard/API

Acceptance criteria:

- Graph write path does not block core MVP if Neo4j unavailable
- One-click explanation chain for high-risk alert

### 6.6 API Surface

Paths:

- backend/app/api/routes.py
- backend/app/api/phase_routes.py
- backend/app/api/ml_routes.py

Required endpoint groups:

- Ingestion control: run/status/source-health
- Events: list/filter/pagination
- Risk: ranked risks/history/trends
- Alerts: active/acknowledge/explanations
- Suppliers: supplier-centric risk view

Tasks:

- Validate contracts and response shape consistency
- Add pagination/filtering/sorting for dashboard performance
- Add error model and stable status codes
- Add API smoke tests for critical paths

Deliverable:

- Clean and predictable API consumed by frontend pages

Acceptance criteria:

- Zero contract mismatches across frontend calls
- Stable API behavior under partial source outages

### 6.7 Frontend and Alert UX

Paths:

- frontend/src/pages
- frontend/src/components
- frontend/src/api.js

Tasks:

- Improve dashboard hierarchy: overview -> drill-down -> explanation
- Add high-clarity risk cards and time trend visualizations
- Add map view and source confidence context
- Add alert details panel with why/how impact text
- Add filter controls (region, event type, severity window)

Deliverable:

- Decision-centric dashboard, not just data display

Acceptance criteria:

- User can identify top 3 risks in under 30 seconds
- User can trace alert explanation path in under 2 clicks

## 7) Testing and Quality Gates

### 7.1 Automated checks

- Unit tests: schema mapping, scoring logic, classifier wrappers
- Integration tests: source fetch -> normalize -> DB -> API
- API tests: health, ingest run, events list, risk list, alerts list
- Frontend sanity tests: rendering + key interaction flows

### 7.2 Observability

- Structured logging for ingestion, NLP, risk pipeline
- Basic metrics counters (ingested, deduped, failed, alerted)
- Weekly quality report:
  - connector uptime
  - duplicate rate
  - NLP confidence distribution
  - alert precision (manual review sample)

## 8) 8-Week Timeline (Execution)

### Week 1-2: Ingestion and Data Foundations

- Finalize source connectors and normalization contract
- Harden retry/rate-limit/logging
- Validate DB schema/indexing
- Demo output: ingestion run + normalized event table

### Week 3: NLP Core

- Integrate/tune spaCy NER
- DistilBERT classification baseline and confidence gating
- Persist enriched events
- Demo output: classified + entity-tagged events

### Week 4: Risk Engine v1

- Implement weighted scoring and alert levels
- Add explainability breakdown
- Expose risk APIs
- Demo output: ranked risk feed with rationale

### Week 5: Dashboard v1

# we can reduce the scope of project to target SMEs
# domain based alerts for user
# neo4j why not (its not that we want it, but yea, looks good for our project)
# credibility of data, view source
# mitigation engine

- Build decision-focused pages and filters
- Connect APIs for events/risk/alerts/suppliers
- Demo output: interactive risk dashboard

### Week 6: Advanced Intelligence

- Event clustering + trend signals + anomaly flags
- Optional graph explanation hooks
- Demo output: trend-aware alerts and event grouping

### Week 7: Integration Hardening

- End-to-end workflow tests
- Failure handling and performance tuning
- API/frontend contract freeze
- Demo output: stable integrated pipeline

### Week 8: Testing, Packaging, and Final Demo

- Regression testing and bug fixes
- Final metrics and architecture slides
- Recorded and live demo preparation
- Demo output: final showcase build

## 9) Immediate Action Plan (Today to Next 7 Days)

### Day 0-1

- Lock canonical schema and validate all connector outputs
- Run ingestion from at least two sources (GDELT + FRED) repeatedly
- Confirm DB writes and dedup behavior

### Day 2-3

- Integrate spaCy entity extraction in pipeline
- Wire DistilBERT classifier endpoint/pipeline stage
- Store NLP-enriched records in gold layer
 - (Optional) Run model training/evaluation on Databricks using the `databricks` integration helper; configure `DATABRICKS_HOST`/`DATABRICKS_TOKEN` and a job to run training/eval notebooks

### Day 4-5

- Implement risk scoring API and thresholded alerts
- Add contribution explanation payload

### Day 6-7

- Wire dashboard risk and alert pages to live backend
- Prepare first integrated mini-demo

## 10) MVP Definition (Non-Negotiable)

MVP is complete only when all are true:

- Multi-source ingestion works on schedule and manual trigger
- Unified normalized schema is enforced end-to-end
- NLP enrichment (NER + classification) is visible in output records
- Risk scoring produces ranked, explainable alerts
- Dashboard displays live risk insights and alert details

## 11) v1 Enhancements (After MVP)

- Graph propagation explanations with Neo4j
- Trend and anomaly detection layers
- Forecasting models (Prophet/LSTM)
- What-if supplier failure simulation
- Confidence scoring and source reliability calibration

## 12) Risks and Mitigations

Risk: connector instability or API rate limits
Mitigation: retries, caching, graceful degradation, source health indicators

Risk: model quality variance on noisy news text
Mitigation: confidence thresholds, fallback labels, periodic retraining

Risk: over-complex stack slows delivery
Mitigation: MVP-first stack lock, defer Kafka/Spark to post-MVP

Risk: integration drift between backend and frontend
Mitigation: contract tests and weekly endpoint freeze/review

## 13) Demo Narrative (For Evaluation)

Tell the story in this exact sequence:

1. New global event arrives from source connectors
2. Event is normalized and deduplicated
3. NLP extracts entities and classifies risk type
4. Risk engine computes explainable score
5. Alert appears in dashboard with impact explanation
6. Optional graph shows ripple path across suppliers/regions

## 14) Success Metrics (Track Weekly)

- Ingestion success rate
- Duplicate reduction rate
- NLP classification confidence and sampled accuracy
- Alert precision on reviewed alerts
- API latency and dashboard load times
- Mean time from ingest to visible alert

## 15) Final Build Order Summary

1. Pipeline reliability
2. NLP enrichment
3. Risk scoring + explainability
4. Dashboard decision UX
5. Graph/trend/forecast enhancements

If this order is followed strictly, you will move from good architecture to a production-style, defensible final project.

Current recommendation:

- Keep this build order but prioritize Week 7/8 activities now: automated testing, migration setup, and reliability controls.
