# SCOUT MainEL - Phase 3 NLP Layer

## Current Implementation Status (2026-04-30)

Overall completion (code present and wired): ~78%

- Completed:
  - Multi-source ingestion connectors (GDELT, Google News, NewsAPI, World Bank, ACLED, FRED; Freightos optional)
  - Unified normalization + hash dedup + raw/unified persistence
  - NLP pipeline wiring (entity extraction + classification + summarization)
  - Risk scoring pipeline with alert levels and feature breakdown in API payload
  - Graph integration hooks and graph API endpoints
  - Frontend pages wired to live backend APIs
  - API health checks and ingestion fallback file path handling

- Partially completed:
  - Connector resiliency (timeouts and graceful per-source failure are present; retry/backoff/rate-limit policies are not fully implemented)
  - Explainability (alert-level explanation text and risk features are present; factor decomposition endpoint/reporting is still basic)
  - Operations hardening (works for local dev but needs stronger deployment-grade controls)

- Pending:
  - Automated test suite (unit/integration/frontend)
  - Alembic migrations
  - Source freshness/health metrics endpoint per connector
  - Formal contract tests and performance SLO validation

This repository now includes a full **Phase 2 ingestion stack** for multi-source global risk/supply intelligence:

- GDELT (global events)
- NewsAPI (news articles)
- Freightos (shipping index)
- World Bank (commodity indicators)
- ACLED (conflict events)
- FRED (macroeconomic signals)

The pipeline normalizes all inputs into a common schema, performs SHA-256 deduplication, and stores raw + unified records in PostgreSQL.

It now also includes **Phase 3-6 delivery**:

- NLP pipeline (NER + event classification + summarization)
- Risk scoring engine with alert levels
- Neo4j knowledge graph propagation hooks
- API endpoints for ingest/events/risk/alerts/suppliers

## Architecture

### Backend

- FastAPI API server
- APScheduler periodic ingestion
- SQLAlchemy ORM + PostgreSQL
- Connector-per-source ingestion pattern
- Unified schema output

### Frontend

- React dashboard (Vite + React Router)
- Pages: Home, Dashboard, Alerts, Supplier Profile, Analytics
- Recharts visualizations for trends, severity, and distributions
- Global map using event-country markers

### ML Setup

- DistilBERT configured (`distilbert-base-uncased` by default, local fine-tuned artifact supported)
- Mistral configured (`mistralai/Mistral-7B-Instruct-v0.3` by default, local artifact supported)
- On-demand model loading endpoint

- Embeddings: switched to `sentence-transformers/all-mpnet-base-v2` using `SentenceTransformer` (improved embedding quality). Add `sentence-transformers` to your environment (see requirements).

- Summarization: LLM summarizer is enabled by default and falls back to extractive bullet summaries if the model cannot load or generate output.

### NLP + Risk + Graph

- spaCy-based entity extraction (companies, countries, ports, commodities)
- DistilBERT-based classification pipeline with fine-tune script
- Mistral summarization into operational bullet points
- Risk feature engineering and weighted score formula
- Neo4j graph updates for ripple-effect modeling

Model loader behavior:

- DistilBERT prefers a local fine-tuned artifact if available.
- Mistral prefers a local artifact if available, otherwise loads the configured Hugging Face model.
- The `/api/v1/ml/load` endpoint reports whether each model loaded successfully.
- On this workspace, DistilBERT loads on `cuda:0` and Mistral v0.3 loads successfully with GPU-first offload-aware settings.

## Unified Schema

```json
{
  "source": "newsapi",
  "timestamp": "2026-04-04T10:30:00Z",
  "text": "...",
  "location": "...",
  "metadata": {"...": "..."}
}
```

## Project Structure

```text
backend/
  app/
    api/
      routes.py
      ml_routes.py
      phase_routes.py
    core/
      config.py
    db/
      base.py
      models.py
      session.py
    ingestion/
      dedup.py
      schema.py
      service.py
      scheduler.py
      connectors/
        gdelt.py
        newsapi.py
        freightos.py
        worldbank.py
        acled.py
        fred.py
    ml/
      models.py
    nlp/
      entity_extractor.py
      event_classifier.py
      summarizer.py
      pipeline.py
      schemas.py
    risk/
      engine.py
      pipeline.py
    graph/
      neo4j_client.py
    training/
      finetune_event_classifier.py
    main.py
frontend/
  index.html
  package.json
  src/
    App.jsx
    api.js
    styles.css
    components/
      Layout.jsx
    pages/
      HomePage.jsx
      DashboardPage.jsx
      AlertsPage.jsx
      SuppliersPage.jsx
      AnalyticsPage.jsx
requirements.txt
.env.example
```

## Quickstart

### 1) Create and activate virtual environment (Python 3.12 preferred)

Windows PowerShell:

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
```

If Python 3.12 is not available, use Python 3.11:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
```

### 2) Install dependencies

```powershell
pip install --upgrade pip
pip install -r requirements.txt
```

Install CUDA-enabled PyTorch (recommended for RTX 3070):

```powershell
pip uninstall -y torch torchvision torchaudio
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu128
```

Verify GPU is active:

```powershell
python -c "import torch; print(torch.__version__, torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'no-gpu')"
```

### 3) Configure environment variables

```powershell
Copy-Item .env.example .env
```

Then edit `.env` and set your keys:

- `DATABASE_URL`
- `NEWSAPI_KEY`
- `FREIGHTOS_API_KEY`
- `FRED_API_KEY`
- `INGESTION_INTERVAL_MINUTES`
- `MISTRAL_USE_4BIT` (optional, set `true` if you install `bitsandbytes` and want lower VRAM)
- `EVENT_CLASSIFIER_MODEL`
- `SUMMARIZER_MODEL`
- `SPACY_MODEL`
- `NEO4J_URI`, `NEO4J_USER`, `NEO4J_PASSWORD`

### 4) Ensure PostgreSQL is running

Create DB:

```sql
CREATE DATABASE scout;
```

Default connection expected:

```text
postgresql+psycopg://postgres:postgres@localhost:5432/scout
```

### 5) Run backend + frontend

Build frontend first:

```powershell
Set-Location frontend
npm install
npm run build
Set-Location ..
```

Then run backend from backend directory:

```powershell
Set-Location backend
python -m uvicorn app.main:app --reload
```

Optional React dev mode:

```powershell
Set-Location frontend
npm run dev
```

Recommended terminal split:

1. Terminal 1 (backend):

```powershell
Set-Location E:\6th SEM Data\Projects\SCOUT_MainEL\backend
python -m uvicorn app.main:app --reload
```

1. Terminal 2 (frontend dev):

```powershell
Set-Location E:\6th SEM Data\Projects\SCOUT_MainEL\frontend
npm run dev
```

App URLs:

- Frontend home: `http://127.0.0.1:8000/#/`
- Frontend dashboard: `http://127.0.0.1:8000/#/dashboard`
- Health: `http://127.0.0.1:8000/api/v1/health`
- Run ingestion once: `POST http://127.0.0.1:8000/api/v1/ingestion/run`
- List unified records: `GET http://127.0.0.1:8000/api/v1/records`
- Load models: `POST http://127.0.0.1:8000/api/v1/ml/load`
- ML runtime status: `GET http://127.0.0.1:8000/api/v1/ml/status`

Phase 3-6 API endpoints:

- `POST /api/v1/ingest` -> run multi-source ingestion
- `POST /api/v1/events` -> transform raw/unified records into structured events
- `GET /api/v1/events` -> list structured events
- `POST /api/v1/risk` -> compute risk scores from events
- `GET /api/v1/risk` -> list ranked risk records
- `GET /api/v1/alerts?min_level=Medium` -> get filtered disruption alerts
- `POST /api/v1/suppliers` -> create or update supplier profile
- `GET /api/v1/suppliers` -> list suppliers

Homepage sections:

- How the project works
- Tech stack
- Innovations
- What is better than existing solutions
- Objectives
- Methodologies
- Teams section with 5 placeholders

## Key APIs

Core ingestion and processing:

- `POST /api/v1/ingest`
- `POST /api/v1/events`
- `POST /api/v1/risk`
- `GET /api/v1/alerts?min_level=Medium`

Data access:

- `GET /api/v1/events`
- `GET /api/v1/risk`
- `GET /api/v1/suppliers`
- `POST /api/v1/suppliers`

Platform and model:

- `GET /api/v1/health`
- `POST /api/v1/ml/load`
- `GET /api/v1/ml/status`
- `POST /api/v1/ingestion/run` (legacy/manual ingestion endpoint)

## Homepage Team Section

The homepage includes a dedicated teams section with 5 placeholders:

- 2 AIML students
- 1 CS student
- 2 IS students

## Optional RAG Pipeline (If Needed)

RAG is optional for your current risk pipeline, but useful if you want retrieval-backed explainability and historical context in summaries.

Suggested flow:

1. Ingestion output (`unified_records`) -> chunk `text` into passages.
2. Create embeddings using a sentence-transformer model.
3. Store vectors in PostgreSQL with `pgvector` (or dedicated vector DB).
4. On alert request, retrieve top-k context chunks for the event/supplier.
5. Build prompt: event summary + retrieved context + constraints.
6. Generate grounded response with Mistral.

Suggested additional endpoints for RAG extension:

- `POST /api/v1/rag/index` -> build/update vector index
- `POST /api/v1/rag/query` -> retrieve context and answer
- `GET /api/v1/rag/status` -> index size and freshness

This can be added without changing current ingestion/risk endpoints.

## End-to-End Run Order

1. `POST /api/v1/ingest`
2. `POST /api/v1/events`
3. `POST /api/v1/risk`
4. `GET /api/v1/alerts`

This flow produces structured disruption events and ranked supplier-impact alerts.

## Phase 3 Details: NLP Pipeline

- NER uses spaCy plus domain dictionaries for companies, countries, ports, commodities.
- Event class output:
  - Geopolitical
  - Logistics
  - Environmental
  - Economic
- Summarization uses Mistral to return short actionable bullet points.

Fine-tuning DistilBERT for event classes:

```powershell
python -m backend.app.training.finetune_event_classifier
```

Expected training data format at `data/event_train.jsonl`:

```json
{"text": "Port strike in Hamburg disrupts shipping", "label": "Logistics"}
{"text": "Flood damages rice production and transport", "label": "Environmental"}
```

## Phase 4 Details: Risk Scoring

Feature set:

- severity
- recency
- source credibility
- geographic relevance
- supplier importance

Implemented weighted formula:

```text
risk_score = (
  severity * 0.3 +
  recency * 0.2 +
  credibility * 0.2 +
  relevance * 0.2 +
  supplier_importance * 0.1
)
```

Alert levels:

- 0.0 to 0.4 -> Low
- 0.4 to 0.6 -> Medium
- 0.6 to 0.8 -> High
- 0.8 to 1.0 -> Critical

## Phase 5 Details: Knowledge Graph

Neo4j entities and relations are written when Neo4j credentials are set:

- Nodes: Event, Country, Supplier, Manufacturer, Commodity
- Edges: AFFECTS, AFFECTED_BY, LOCATED_IN, SUPPLIES

Impact path covered:

`Event -> Country -> Supplier -> Manufacturer`

## Notes on Source APIs

- Some connectors require API keys and may return empty results when unset.
- ACLED and Freightos public endpoints may differ by account plan; connector returns empty on non-success.
- World Bank and GDELT are public and should ingest without key restrictions.

## Deduplication Strategy

Dedup key is SHA-256 over normalized tuple:

```text
source | source_id | timestamp(UTC ISO) | text(lowercased) | location(lowercased)
```

Duplicate hashes are skipped before insert.

## What is complete for Phase 2

- Multi-source ingestion connectors
- Unified normalization schema
- Hash-based deduplication
- Raw and unified storage tables
- Scheduled and manual ingestion triggers
- Frontend monitoring console
- DistilBERT + Mistral model integration hooks

## GPU Notes (RTX 3070)

- DistilBERT is moved directly to `cuda:0` when CUDA is available.
- Mistral loads with `torch.float16` and `device_map=cuda:0` to prioritize GPU execution and minimize CPU RAM usage.
- If Mistral hits VRAM limits, set `MISTRAL_USE_4BIT=true` and install `bitsandbytes`.

## Recent Fixes (2026-04-27)

- Fixed `/api/v1/alerts` 500 caused by empty `entities.countries` lists in alert explanation generation.
- Improved frontend data refresh resiliency: dashboard refresh now uses `Promise.allSettled`, so one endpoint failure does not break all page data loads.
- Corrected documented backend startup pattern to avoid `ModuleNotFoundError: No module named 'app'` when running from repository root.

### 2026-04-30 Updates

- Replaced deprecated `@app.on_event("startup")` with a FastAPI `lifespan` handler in `backend/app/main.py` to address deprecation warnings and provide a single lifecycle entrypoint for startup/shutdown tasks.
- Fixed `EventEmbedding` model nesting in `backend/app/db/models.py` (moved to top-level model). This resolves import errors when loading the NLP clustering pipeline.
- Switched embedding implementation to use `SentenceTransformer('all-mpnet-base-v2')` in `backend/app/nlp/embeddings.py` (cached model load) to produce higher-quality 768-dim vectors.
- Enabled the LLM summarizer by default in `backend/app/core/config.py` and updated `backend/app/nlp/summarizer.py` to use cached model loading with safe extractive fallback.
- Ensure Databricks job trigger remains mandatory at startup; set `DATABRICKS_HOST`, `DATABRICKS_TOKEN`, and `DATABRICKS_DEFAULT_JOB_ID` in your environment before running the app.
- Added `sentence-transformers` to `requirements.txt`.

## Next Recommended Steps

1. Add Alembic migrations for production-safe schema evolution.
2. Add retry/backoff and rate-limit handling per connector.
3. Add test coverage for normalization and dedup modules.
4. Add a message queue (Celery + Redis) for higher-volume ingestion workloads.
