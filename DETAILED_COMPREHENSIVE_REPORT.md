# SCOUT MainEL Detailed Comprehensive Report

Date: 2026-04-25
Project: SCOUT MainEL (Supply Chain Operational and Risk Tracking)

## 1. Executive Summary

SCOUT MainEL is an end-to-end supply chain risk intelligence platform that transforms heterogeneous external signals into explainable, personalized alerts for decision makers. The platform combines:

- Multi-source ingestion from news, economic, and conflict feeds
- NLP-driven event extraction from unstructured text
- Property graph modeling for multihop supply-chain impact analysis
- Risk scoring and personalized alert delivery

This report consolidates architecture, data contracts, execution strategy, and implementation status, and documents completed ingestion integration work including Google News (RSS/XML) support.

## 2. Problem Statement

Traditional dashboards surface generic events and static KPIs but do not explain how upstream disruptions propagate to downstream suppliers and companies. SCOUT addresses this gap by:

- Converting raw global signals into structured disruption events
- Mapping disruptions through multihop supplier-material-country networks
- Delivering user-specific alerts instead of global noise

## 3. Core USP and Product Differentiation

### 3.1 Multihop Supply Chain Reasoning

Primary differentiator:

Supplier -> Raw Material -> Country/Port -> Downstream Company

SCOUT computes risk propagation across graph hops and produces explainable paths for each high-impact alert.

### 3.2 Personalization by Exposure Graph

Alerts are tied to user/company exposure profiles:

- Apple profile: semiconductor, manufacturing corridor, logistics bottleneck alerts
- Tesla profile: lithium/cobalt/battery corridor disruption alerts

### 3.3 Agentic Intelligence Operations

- MCP-enabled dynamic source querying for fresh external signals
- A2A flow across three agents:
  - Event Detection Agent
  - Risk Analysis Agent
  - Alert Generation Agent

## 4. System Architecture

## 4.1 Logical Layers

1. Source Connectors Layer
- GDELT, NewsAPI, Google News RSS, World Bank, ACLED, FRED, optional Freightos

2. Ingestion + Normalization Layer
- Source-specific fetchers map data to a shared canonical schema
- Deduplication by deterministic content hash

3. Storage Layer
- Raw table for source traceability
- Unified normalized table for downstream processing
- Event and risk tables for operational intelligence

4. NLP Enrichment Layer
- Entity extraction (organizations, locations, commodities, supply chain entities)
- Event classification and confidence scoring
- Summarization for concise explainability

5. Risk Engine Layer
- Feature engineering
- Weighted risk scoring
- Alert-level categorization

6. Graph Intelligence Layer
- Ontology nodes and relations
- Impact propagation and queryable path explanations

7. API + Frontend Layer
- FastAPI endpoints for ingest/events/risk/alerts/suppliers
- React dashboard pages for operations and analytics

## 4.2 Current Backend Module Map

- backend/app/ingestion: connector logic, schema, dedup, scheduling, orchestration
- backend/app/nlp: extraction, classification, summarization, pipeline composition
- backend/app/risk: risk model and scoring pipeline
- backend/app/graph: Neo4j integration hooks
- backend/app/api: operational and phase APIs
- backend/app/db: SQLAlchemy models and session management

## 5. Data Ingestion Design

## 5.1 Source Strategy

- News/Media: high frequency for early disruption signals
- Economic indicators: macro pressure and volatility context
- Conflict datasets: geopolitical risk triggers
- Logistics/transport signals: shipment and flow disruption indicators

## 5.2 Format Handling

SCOUT supports multiple source response formats:

- JSON REST APIs (NewsAPI, GDELT, FRED, ACLED, World Bank)
- XML/RSS feeds (Google News integration)

Each connector transforms source-specific fields into a common record contract.

## 5.3 Canonical Normalized Record

Implemented normalized contract:

- source
- timestamp
- text
- location
- metadata
- source_id

This enables a source-agnostic downstream pipeline.

## 5.4 Deduplication

A content hash is computed for each normalized record and checked against both raw and unified tables to avoid re-ingestion duplicates.

## 6. NLP Event Extraction Design

## 6.1 Pipeline Objective

Transform unstructured narrative text into structured machine-actionable event records.

## 6.2 Target Output Attributes

- Event category (conflict/logistics/economic/environmental/policy etc.)
- Severity and confidence signals
- Location and entity set
- Explainable summary text

## 6.3 Operational Considerations

- Confidence thresholding for low-certainty predictions
- Fallback behavior for sparse or noisy text
- Persisted event records for reproducibility and audits

## 7. Property Graph Ontology and Multihop Modeling

## 7.1 Proposed Ontology

Node labels:

- Supplier
- Company
- Commodity
- RawMaterial
- Country
- Port
- Route
- Event

Relation types:

- supplies_to
- depends_on
- located_in
- exports_to
- imports_from
- ships_via
- affects

## 7.2 Multihop Impact Computation

A disruption linked to a node propagates through weighted dependencies to estimate downstream exposure.

Example:

Conflict event in producing country -> lithium output risk -> battery supplier stress -> EV manufacturer alert

## 8. Personalized Alerting Design

## 8.1 Filtering Principle

Only show events that are relevant to user profile context:

- Watched companies/suppliers
- Commodity exposure
- Geographic lanes
- Minimum severity/credibility thresholds

## 8.2 Alert Payload Contract

- What happened
- Why this user is affected
- Multihop path explanation
- Risk score and alert level
- Timestamp and source confidence

## 9. MCP and A2A Orchestration Blueprint

## 9.1 MCP Responsibility

- Query live data sources dynamically
- Provide uniform tool interface to the pipeline

## 9.2 A2A Agent Responsibility

1. Event Detection Agent
- Converts normalized records into structured events

2. Risk Analysis Agent
- Scores event impact and propagation potential

3. Alert Generation Agent
- Personalizes and prioritizes alerts for each profile

## 9.3 End-to-End Orchestration Flow

MCP Fetch -> Normalize -> Event Agent -> Risk Agent -> Alert Agent -> API/Frontend

## 10. API Surface (Operational)

Current key endpoints:

- POST /api/v1/ingest
- POST /api/v1/events
- GET /api/v1/events
- POST /api/v1/risk
- GET /api/v1/risk
- GET /api/v1/alerts
- POST /api/v1/suppliers
- GET /api/v1/suppliers
- POST /api/v1/ingestion/run
- GET /api/v1/records

## 11. Data Ingestion Pipeline Integration Executed

## 11.1 Integration Scope Completed

Implemented and integrated Google News as an additional ingestion source.

Changes made:

1. Added connector implementation:
- backend/app/ingestion/connectors/google_news.py

2. Added runtime settings:
- enable_google_news
- google_news_query
- google_news_language
- google_news_country

3. Registered connector in ingestion pipeline:
- backend/app/ingestion/service.py

4. Added environment variables:
- .env.example

## 11.2 Integration Rationale

This closes a key requirement from the project definition:

- multi-source ingestion across news + economic + conflict + Google
- handling multiple transport formats (JSON and XML/RSS)

## 12. Execution and Validation Plan

## 12.1 Preconditions

- Valid PostgreSQL connection in DATABASE_URL
- Required API keys configured where applicable
- Python virtual environment active

## 12.2 Validation Commands

- Run ingestion job via API endpoint: POST /api/v1/ingest
- Or run ingestion scheduler function directly in Python context
- Verify records via GET /api/v1/records

## 12.3 Success Criteria

- Ingestion runs without crash on partial source failures
- Records inserted and duplicates tracked
- New Google source records appear with source = google_news

## 13. Risk and Mitigation Matrix

1. External API rate limits
- Mitigation: per-connector backoff, timeout, and partial-failure isolation

2. Source schema drift
- Mitigation: connector-level parser guards and metadata fallback storage

3. False-positive NLP classification
- Mitigation: confidence thresholds and human-review lanes

4. Alert fatigue
- Mitigation: profile-based relevance and minimum impact gating

## 14. Recommended Next Iteration

1. Add connector health metrics and freshness endpoint per source
2. Add explainable factor decomposition in risk API responses
3. Persist graph propagation edges generated by high-severity events
4. Implement profile-aware alert query endpoint with user context
5. Add integration tests for connector normalization contracts

## 15. Conclusion

SCOUT MainEL already contains the core architecture for an advanced supply-chain intelligence platform. This integration cycle extends ingestion capability with Google News RSS while preserving the normalized contract and dedup behavior. The system is now better aligned with the project goals of broad-source coverage, structured NLP insight extraction, graph-based multihop reasoning, and personalized alerting.

Based on the SCOUT MainEL codebase analysis, here's the **complete software requirements list**:

## **Required Software**

### 1. **Python 3.11+**
   - Status: ✅ You have Python 3.11.9
   - Purpose: Runtime for backend

### 2. **PostgreSQL 16+**
   - Status: ✅ You have PostgreSQL 18 running on port 5433
   - Purpose: Primary data storage (raw records, unified records, events, risk scores, suppliers)
   - Action needed: Create `scout` database (simple one-liner)

### 3. **Git** (optional but recommended)
   - Purpose: Version control for your project

---

## **Optional but Recommended Software**

### 4. **Neo4j Graph Database** (optional in MVP)
   - Purpose: Multihop supply chain graph reasoning and impact propagation
   - Version: 5.x or newer
   - Installation: Download from neo4j.com or use Docker (but you don't have Docker)
   - Status: **Not required for initial integration** but needed for full USP (graph-based multihop alerts)

### 5. **pgAdmin** (optional admin tool)
   - Purpose: Visual PostgreSQL management UI
   - Status: Helpful but not required

---

## **External API Keys (All Optional)**

These are configured in .env - they're optional because the system gracefully skips sources without keys:

1. **NewsAPI** (`NEWSAPI_KEY`)
   - Signup: https://newsapi.org
   - Purpose: News article ingestion

2. **FRED API** (`FRED_API_KEY`)
   - Signup: https://fred.stlouisfed.org/docs/api
   - Purpose: Macroeconomic data

3. **Freightos API** (`FREIGHTOS_API_KEY`)
   - Purpose: Shipping/logistics data
   - Status: Optional, disabled by default

4. **ACLED** (`ACLED_USERNAME`, `ACLED_PASSWORD`)
   - Signup: https://acleddata.com
   - Purpose: Conflict event data

**Note:** GDELT (global events), World Bank (commodity data), and Google News (RSS) require **no API keys** — they're free/public and already integrated.

---

## **What You Need to Do Right Now**

✅ **Have** (already installed):
- Python 3.11.9
- PostgreSQL 18 (running on 5433)
- All Python dependencies in requirements.txt

⚠️ **Need to Create**:
- PostgreSQL database named `scout`

❌ **Don't have** (but don't block MVP):
- Docker (skipped — not essential)
- Neo4j (skipped for now — add later for full multihop graph features)

---

## **Quick Setup Steps**

1. **Create the scout database** (one-time):
   ```powershell
   $env:PGPASSWORD='postgres'
   & 'C:\Program Files\PostgreSQL\18\bin\createdb.exe' -h localhost -p 5433 -U postgres scout
   ```

2. **Update your .env file** (copy from .env.example):
   ```
   DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5433/scout
   # Add API keys if you have them (all optional)
   NEWSAPI_KEY=your_key_here
   FRED_API_KEY=your_key_here
   ```

3. **Verify environment**:
   ```powershell
   cd E:\6th SEM Data\Projects\SCOUT_MainEL
   python -c "import sys; print(f'Python {sys.version}')"
   ```

---

## **Summary for You**

| Component | Status | Action |
|-----------|--------|--------|
| Python 3.11 | ✅ Ready | None |
| PostgreSQL 18 | ✅ Running | Create `scout` DB |
| Python packages | ✅ Ready | Already in venv |
| API Keys | ❌ Optional | Add only if you want them |
| Docker | ❌ Not needed | Skip |
| Neo4j | ❌ For later | Add after MVP works |
