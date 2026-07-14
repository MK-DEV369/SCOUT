# SCOUT: Cognitive Supply Chain Control Tower

SCOUT is a state-of-the-art cognitive risk monitoring and decision-support system designed to identify, analyze, and mitigate disruptions across global supply chains. By fusing multi-source global intelligence with machine learning and knowledge graph propagation, SCOUT provides real-time visibility into supplier, commodity, and port exposures.

---

## 🚀 Key Capabilities

### 1. Multi-Source Ingestion & Laptop Space Protection
SCOUT continuously aggregates high-velocity data feeds from multiple geopolitical, economic, and logistical sources:
* **GDELT Global News Stream:** Global event database.
* **ACLED (Armed Conflict Location & Event Data):** Geopolitical conflict tracking.
* **Google RSS & NewsAPI:** Live news and publisher feeds.
* **FRED (Federal Reserve Economic Data):** Macro-economic indicators.
* **World Bank Development Statistics:** Long-term development and inflation metrics.

> [!TIP]
> **Laptop Space Protection Mode:** To protect local host storage, SCOUT processes high-volume raw streams (~567 GB processed over 2,800+ connector cycles), indexes structured metadata, and automatically purges raw JSON/ZIP payloads. This retains high-integrity indicators while consuming only a tiny PostgreSQL footprint (~3.28 GB saved).

### 2. Cognitive NLP Pipeline
Ingested streams flow through a multi-stage machine learning enrichment pipeline:
* **Named Entity Recognition (NER):** Uses **spaCy** models coupled with custom domain dictionaries to isolate companies, countries, ports, and commodities.
* **Event Classification:** Uses a fine-tuned **DistilBERT** classifier to categorize disruptions into Geopolitical, Logistics, Environmental, or Economic domains.
* **Actionable Summarization:** Employs **Mistral-7B** to extract bulleted key takeaways and mitigation options, with local extractive fallbacks.
* **Semantic Vector Embeddings:** Computes high-dimensional representations using the `all-mpnet-base-v2` model from **SentenceTransformers** for advanced grouping.

### 3. Databricks Cloud Orchestration
For heavy analytics, SCOUT integrates directly with **Databricks** workspaces via the REST API:
* **Distributed Clustering:** Triggers scheduled K-Means clustering runs on Databricks clusters.
* **Model Training:** Triggers and monitors DistilBERT fine-tuning jobs.
* **Cloud Scraping:** Deploys Spark jobs to scrape RSS feeds directly into Delta Lake mounts.
* **Schedule Alignment:** Configured to run automatically every hour at the **8th minute** (e.g., 5:08, 6:08) via Quartz cron scheduling.

### 4. Zero-Neo4j Relational Knowledge Graph
SCOUT includes a high-performance **PostgreSQL-backed relational graph engine** that functions as a lightweight, zero-dependency alternative to Neo4j. It materializes multi-hop propagation paths instantly, enabling developers to trace risk cascading from `Event -> Country -> Supplier -> Manufacturer`.

### 5. Interactive React Cockpit
* **Executive Report Builder:** Advanced editor with Split Screen, Editor Only, and Preview Only view modes. Features **page-slice technology** to fit reports exactly into target lengths (1–5 pages) without overflows.
* **Interactive Risk Map:** Hotspot map built with `react-simple-maps` displaying glows over countries experiencing high threat pressure.
* **SME Onboarding Presets:** Interactive modal console that allows users to pre-fill risk profiles instantly using templates (e.g., *Semiconductor Factory*, *EV Battery*, *Ethanol Fuel*).

---

## 🛠️ Tech Stack

* **Backend:** FastAPI, Python 3.11/3.12, SQLAlchemy, Uvicorn, APScheduler.
* **Frontend:** React, React Router, Vite, Recharts, CSS Grid/Flexbox.
* **Machine Learning / NLP:** PyTorch, Hugging Face Hub, spaCy, SentenceTransformers, DistilBERT, Mistral-7B.
* **Big Data / Cloud:** Databricks Jobs API, PySpark.
* **Database:** PostgreSQL (with `pgvector` compatibility), Neo4j (optional).

---

## 📂 Project Architecture

```text
backend/
  app/
    api/              # FastAPI endpoints (records, events, risk, alerts, databricks)
    core/             # Config variables and lifespan management
    db/               # SQLAlchemy session and models
    enrichment/       # Metadata normalization and deduplication
    ingestion/        # Multi-source API connector services
    integration/      # Databricks REST API Client
    ml/               # Hugging Face model loading and local routing
    nlp/              # spaCy NER, DistilBERT classification, clustering, explainability
    risk/             # Weighted multi-factor risk calculations
    graph/            # Neo4j & Relational PostgreSQL graph materialization
  notebooks/          # Databricks cluster jobs & notebooks
frontend/
  src/
    components/       # Layouts and navigation
    pages/            # Dashboard page, Alerts page, Analytics map page, Home page
```

---

## ⚡ Quickstart

### 1. Initialize Virtual Environment
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install --upgrade pip
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` and set your connection strings and API keys:
```text
DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/scout
DATABRICKS_HOST=https://<your-workspace>.databricks.com
DATABRICKS_TOKEN=dapi...
HF_TOKEN=hf...
```

### 3. Run the Control Tower
Run the backend server:
```powershell
cd backend
python -m uvicorn app.main:app --port 8000 --reload
```

Run the frontend development server:
```powershell
cd frontend
npm install
npm run dev
```

The application will be accessible locally at `http://localhost:5173`. If using ngrok for Databricks webhooks:
```bash
ngrok http 8000 --domain=disprove-overlook-abdominal.ngrok-free.dev
```
