# Morya — Frontend, Domain Filtering & Databricks Integration Guide

**Owner:** Morya  
**Focus:** Frontend dashboard, SME domain filtering, model integration, Databricks orchestration  
**Timeline:** Weeks 4-8 (concurrent with risk/DB/NLP teams)

---

## Executive Summary

You own the **decision-facing layer and ML ops**. Your work has three pillars:

1. **Frontend UX:** Build a domain-aware SME dashboard where users can filter risks by industry/domain and see actionable alerts
2. **Domain Filtering:** Implement backend filtering logic so that Semiconductor users see different risks than Pharma users
3. **Databricks Integration:** Orchestrate model training, evaluation, and batch jobs on Databricks so ML is reproducible and scalable

The goal is to deliver a dashboard that SMEs trust and use, backed by reproducible ML pipelines.

---

## Current State (What's Done)

### Frontend

- [x] React dashboard structure exists in `frontend/src/pages`
- [x] Core pages: HomePage, DashboardPage, AlertsPage, AnalyticsPage, SuppliersPage
- [x] API integration in `frontend/src/api.js`
- [x] Basic charts and map components
- [x] **NOT done:** Domain selector, alert drill-down, source link UI, mitigation display, pagination

### Domain Filtering

- [x] **NOT done:** Backend endpoint to filter by domain, frontend UI to select domain

### Databricks Integration

- [x] `backend/app/integration/databricks.py` exists with stub for job trigger
- [x] Environment variables for DATABRICKS_HOST, DATABRICKS_TOKEN, DATABRICKS_DEFAULT_JOB_ID
- [x] **NOT done:** Actual job orchestration, model training workflow, batch evaluation

---

## What Needs to Be Done (Priority Order)

### Phase 1: Domain Filtering Backend & API (Weeks 4-5)

**Goal:** Implement backend logic so events and risks can be filtered by SME domain.

#### 1.1 Define Domain Mapping

Create `backend/app/core/domains.py`:

```python
from enum import Enum
from pydantic import BaseModel

class DomainEnum(str, Enum):
    SEMICONDUCTOR = "Semiconductor"
    PHARMA = "Pharma"
    AUTOMOTIVE = "Automotive"
    AGRICULTURE = "Agriculture"
    ELECTRONICS = "Electronics"

class DomainProfile(BaseModel):
    """Map domain to keywords, regions, commodities, companies."""
    
    name: DomainEnum
    keywords: list[str]
    regions: list[str]  # e.g., ["Taiwan", "South Korea", "Japan"]
    commodities: list[str]  # e.g., ["rare earth", "silicon wafer"]
    key_companies: list[str]  # e.g., ["TSMC", "Samsung", "Intel"]
    geopolitical_triggers: list[str]  # e.g., ["Taiwan tension", "China export controls"]
    logistics_triggers: list[str]  # e.g., ["Port congestion", "Freight delays"]

DOMAIN_PROFILES = {
    DomainEnum.SEMICONDUCTOR: DomainProfile(
        name=DomainEnum.SEMICONDUCTOR,
        keywords=["chip", "semiconductor", "wafer", "fabrication", "silicon", "device"],
        regions=["Taiwan", "South Korea", "Japan", "USA", "Netherlands"],
        commodities=["rare earth", "silicon", "photoresist", "equipment"],
        key_companies=["TSMC", "Samsung", "Intel", "SK Hynix", "Micron"],
        geopolitical_triggers=["Taiwan tension", "Export controls", "Chip export ban"],
        logistics_triggers=["Port strikes", "Freight congestion", "Equipment delays"]
    ),
    
    DomainEnum.PHARMA: DomainProfile(
        name=DomainEnum.PHARMA,
        keywords=["pharma", "drug", "vaccine", "API", "cold chain", "clinical trial"],
        regions=["USA", "India", "China", "Switzerland", "Germany"],
        commodities=["active pharmaceutical ingredients", "vials", "cold storage"],
        key_companies=["Pfizer", "Moderna", "Novo Nordisk", "GSK"],
        geopolitical_triggers=["Export ban", "Sanctions"],
        logistics_triggers=["Cold chain failure", "Port delay", "Air freight disruption"]
    ),
    
    DomainEnum.AUTOMOTIVE: DomainProfile(
        name=DomainEnum.AUTOMOTIVE,
        keywords=["automotive", "car", "battery", "EV", "component", "supplier"],
        regions=["Germany", "Japan", "USA", "Mexico", "China"],
        commodities=["lithium", "cobalt", "semiconductors", "steel"],
        key_companies=["Tesla", "Volkswagen", "Toyota", "BMW"],
        geopolitical_triggers=["Battery metal tension", "Tariff"],
        logistics_triggers=["Chip shortage", "Port congestion", "Component delay"]
    ),
    
    DomainEnum.AGRICULTURE: DomainProfile(
        name=DomainEnum.AGRICULTURE,
        keywords=["crop", "commodity", "wheat", "corn", "grain", "fertilizer"],
        regions=["Ukraine", "Russia", "USA", "Brazil", "India"],
        commodities=["wheat", "corn", "fertilizer", "potash"],
        key_companies=["Bayer", "Corteva"],
        geopolitical_triggers=["War", "Export ban", "Drought"],
        logistics_triggers=["Port blockade", "Rail disruption"]
    ),
    
    DomainEnum.ELECTRONICS: DomainProfile(
        name=DomainEnum.ELECTRONICS,
        keywords=["electronics", "device", "consumer", "smart", "battery", "display"],
        regions=["China", "Vietnam", "Taiwan", "Thailand"],
        commodities=["lithium battery", "rare earth", "PCB", "display panel"],
        key_companies=["Apple", "Samsung", "Sony"],
        geopolitical_triggers=["China trade tension"],
        logistics_triggers=["Freight cost spike", "Port congestion", "Container shortage"]
    )
}

def get_domain_profile(domain_name: str) -> DomainProfile | None:
    """Get profile for a domain."""
    try:
        domain_enum = DomainEnum(domain_name)
        return DOMAIN_PROFILES[domain_enum]
    except (ValueError, KeyError):
        return None

def rank_event_relevance_to_domain(
    event_text: str,
    event_entities: dict,
    domain: DomainEnum
) -> float:
    """
    Score how relevant an event is to a domain (0.0-1.0).
    Based on keywords, entities, and triggers.
    """
    profile = DOMAIN_PROFILES[domain]
    score = 0.0
    weights = {
        "keywords": 0.3,
        "entities": 0.4,
        "triggers": 0.3
    }
    
    # Keyword matching
    text_lower = event_text.lower()
    keyword_hits = sum(1 for kw in profile.keywords if kw.lower() in text_lower)
    keyword_score = min(1.0, keyword_hits / len(profile.keywords)) if profile.keywords else 0.0
    
    # Entity matching (countries, companies, commodities)
    entity_score = 0.0
    entities = event_entities.get("countries", [])
    company_matches = sum(1 for ent in entities if any(co.lower() in ent.lower() for co in profile.key_companies))
    entity_score = min(1.0, company_matches / len(profile.key_companies)) if profile.key_companies else 0.0
    
    # Trigger matching
    trigger_hits = 0
    trigger_hits += sum(1 for trigger in profile.geopolitical_triggers if trigger.lower() in text_lower)
    trigger_hits += sum(1 for trigger in profile.logistics_triggers if trigger.lower() in text_lower)
    trigger_score = min(1.0, trigger_hits / (len(profile.geopolitical_triggers) + len(profile.logistics_triggers))) if (profile.geopolitical_triggers or profile.logistics_triggers) else 0.0
    
    # Weighted score
    score = (
        keyword_score * weights["keywords"] +
        entity_score * weights["entities"] +
        trigger_score * weights["triggers"]
    )
    
    return float(score)
```

**Files to create:**
- `backend/app/core/domains.py` (new)

#### 1.2 Add Domain-Aware Filtering to Risk API

Update `backend/app/api/routes.py`:

```python
from backend.app.core.domains import DomainEnum, rank_event_relevance_to_domain

@router.get("/api/v1/alerts")
def list_alerts(
    domain: str | None = None,
    min_level: str = "Medium",
    limit: int = 50,
    db: Session = Depends(get_db)
):
    """
    List alerts, optionally filtered by SME domain.
    
    Query params:
    - domain: "Semiconductor", "Pharma", etc.
    - min_level: "Low", "Medium", "High", "Critical"
    - limit: max results
    """
    query = db.query(RiskRecord).join(EventRecord)
    
    # Filter by alert level
    level_order = ["Low", "Medium", "High", "Critical"]
    if min_level in level_order:
        min_idx = level_order.index(min_level)
        levels = level_order[min_idx:]
        query = query.filter(RiskRecord.alert_level.in_(levels))
    
    # Get all risks
    risks = query.order_by(RiskRecord.score.desc()).limit(limit * 2).all()  # Get extra to filter
    
    # If domain specified, rank by relevance
    if domain:
        domain_profile = get_domain_profile(domain)
        if not domain_profile:
            raise HTTPException(status_code=400, detail=f"Unknown domain: {domain}")
        
        # Rank each risk by domain relevance
        risks_with_relevance = []
        for risk in risks:
            event = risk.event_record
            relevance = rank_event_relevance_to_domain(
                event.text,
                event.entities_json,
                DomainEnum(domain)
            )
            risks_with_relevance.append((risk, relevance))
        
        # Filter to domain-relevant risks (threshold 0.3)
        risks = [r for r, rel in risks_with_relevance if rel > 0.3]
        risks = sorted(risks, key=lambda r: r.score, reverse=True)[:limit]
    else:
        risks = risks[:limit]
    
    # Format response
    return [
        {
            "id": risk.id,
            "event_id": risk.event_id,
            "score": risk.score,
            "alert_level": risk.alert_level,
            "summary": risk.event_record.summary,
            "explanation": risk.explanation_text,
            "mitigation_layman": risk.mitigation_layman,
            "mitigation_policy": risk.mitigation_policy,
            "source_url": risk.event_record.source_url,
            "timestamp": risk.timestamp
        }
        for risk in risks
    ]

@router.get("/api/v1/events")
def list_events(
    domain: str | None = None,
    category: str | None = None,
    limit: int = 100,
    offset: int = 0,
    db: Session = Depends(get_db)
):
    """
    List events with optional domain and category filtering.
    """
    query = db.query(EventRecord)
    
    if category:
        query = query.filter(EventRecord.category == category)
    
    if domain:
        # Filter events relevant to this domain
        all_events = query.order_by(EventRecord.timestamp.desc()).all()
        
        domain_profile = get_domain_profile(domain)
        if not domain_profile:
            raise HTTPException(status_code=400)
        
        relevant_events = [
            e for e in all_events
            if rank_event_relevance_to_domain(e.text, e.entities_json, DomainEnum(domain)) > 0.3
        ]
        
        events = relevant_events[offset:offset + limit]
    else:
        events = query.order_by(EventRecord.timestamp.desc()).offset(offset).limit(limit).all()
    
    return [
        {
            "id": e.id,
            "category": e.category,
            "summary": e.summary,
            "source": e.source,
            "entities": e.entities_json,
            "classifier_confidence": e.classifier_confidence,
            "source_url": e.source_url,
            "timestamp": e.timestamp
        }
        for e in events
    ]

@router.get("/api/v1/domains")
def list_domains():
    """List available domains for SME selection."""
    return {
        "domains": [
            {
                "name": d.value,
                "keywords": DOMAIN_PROFILES[d].keywords[:5],  # Top 5 keywords
                "key_companies": DOMAIN_PROFILES[d].key_companies[:5]
            }
            for d in DomainEnum
        ]
    }
```

**Files to update:**
- `backend/app/api/routes.py` — add domain filtering and `/domains` endpoint

#### 1.3 Add Domain to Event Record

Update `backend/app/db/models.py`:

```python
class EventRecord(Base):
    # ... existing ...
    domain: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # e.g., "Semiconductor", "Pharma"
```

And update the ingestion/NLP pipeline to infer domain:

```python
# In backend/app/nlp/pipeline.py
from backend.app.core.domains import DomainEnum, rank_event_relevance_to_domain

def build_structured_events(db: Session, limit: int = 100) -> dict[str, int]:
    for record in candidates:
        # ... existing NLP ...
        
        # Infer best-matching domain
        domain_scores = {}
        for domain_enum in DomainEnum:
            score = rank_event_relevance_to_domain(record.text, entities.model_dump(), domain_enum)
            domain_scores[domain_enum.value] = score
        
        best_domain = max(domain_scores, key=domain_scores.get)
        domain = best_domain if domain_scores[best_domain] > 0.3 else None
        
        event = EventRecord(
            # ... existing fields ...
            domain=domain
        )
```

**Files to update:**
- `backend/app/db/models.py`
- `backend/app/nlp/pipeline.py`
- New Alembic migration: `backend/alembic/versions/0010_add_event_domain.py`

**Acceptance:** Backend filters events/risks by domain; domain scores determine relevance.

---

### Phase 2: Frontend Domain Selector & UX (Weeks 5-6)

**Goal:** Build the frontend UI so SMEs can select their domain and see personalized risks.

#### 2.1 Create Domain Selector Component

`frontend/src/components/DomainSelector.jsx`:

```jsx
import React, { useState, useEffect } from 'react';
import { fetchDomains } from '../api.js';

export function DomainSelector({ onDomainChange }) {
  const [domains, setDomains] = useState([]);
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDomains()
      .then(data => {
        setDomains(data.domains);
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load domains:', err);
        setLoading(false);
      });
  }, []);

  const handleSelect = (domainName) => {
    setSelectedDomain(domainName);
    onDomainChange(domainName);
  };

  if (loading) return <div>Loading domains...</div>;

  return (
    <div className="domain-selector">
      <h2>Select Your Industry</h2>
      <div className="domain-grid">
        {domains.map(domain => (
          <button
            key={domain.name}
            className={`domain-card ${selectedDomain === domain.name ? 'selected' : ''}`}
            onClick={() => handleSelect(domain.name)}
          >
            <h3>{domain.name}</h3>
            <p className="keywords">
              {domain.keywords.join(', ')}
            </p>
            <p className="companies">
              {domain.key_companies.join(', ')}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
```

#### 2.2 Update Dashboard Page

`frontend/src/pages/DashboardPage.jsx`:

```jsx
import React, { useState, useEffect } from 'react';
import { DomainSelector } from '../components/DomainSelector';
import { fetchAlerts } from '../api.js';

export function DashboardPage() {
  const [selectedDomain, setSelectedDomain] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleDomainChange = (domain) => {
    setSelectedDomain(domain);
    loadAlerts(domain);
  };

  const loadAlerts = async (domain) => {
    setLoading(true);
    try {
      const data = await fetchAlerts({
        domain: domain,
        min_level: 'Medium',
        limit: 20
      });
      setAlerts(data);
    } catch (err) {
      console.error('Failed to load alerts:', err);
    }
    setLoading(false);
  };

  return (
    <div className="dashboard">
      <DomainSelector onDomainChange={handleDomainChange} />
      
      {selectedDomain && (
        <div className="alerts-section">
          <h2>{selectedDomain} Risks & Alerts</h2>
          
          {loading ? (
            <p>Loading alerts...</p>
          ) : (
            <div className="alert-list">
              {alerts.map(alert => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

#### 2.3 Create Alert Detail Card

`frontend/src/components/AlertCard.jsx`:

```jsx
import React, { useState } from 'react';
import { AlertLevel } from './AlertLevel';

export function AlertCard({ alert }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`alert-card alert-${alert.alert_level.toLowerCase()}`}>
      <div className="alert-header">
        <AlertLevel level={alert.alert_level} />
        <h3>{alert.summary}</h3>
        <p className="timestamp">{new Date(alert.timestamp).toLocaleString()}</p>
      </div>

      <div className="alert-body">
        <p className="explanation">{alert.explanation}</p>

        {/* View Source Button */}
        {alert.source_url && (
          <a
            href={alert.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-source"
          >
            📖 View Source ({alert.source_outlet})
          </a>
        )}
      </div>

      <button
        className="btn btn-expand"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Hide' : 'Show'} Details & Mitigation
      </button>

      {expanded && (
        <div className="alert-details">
          <div className="factors">
            <h4>Risk Factors</h4>
            <RiskFactorChart factors={alert.factors} />
          </div>

          <div className="mitigation">
            <h4>What to Do?</h4>
            <div className="mitigation-layman">
              <strong>For Business Teams:</strong>
              <p>{alert.mitigation_layman}</p>
            </div>
            <div className="mitigation-policy">
              <strong>For Government/Policy:</strong>
              <p>{alert.mitigation_policy}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RiskFactorChart({ factors }) {
  return (
    <div className="factor-chart">
      {Object.entries(factors).map(([factor, data]) => (
        <div key={factor} className="factor-bar">
          <label>{factor}</label>
          <div className="bar-container">
            <div
              className="bar-fill"
              style={{ width: `${data.value * 100}%` }}
            />
          </div>
          <span className="value">{(data.value * 100).toFixed(0)}%</span>
          <span className="weight">(weight: {(data.weight * 100).toFixed(0)}%)</span>
        </div>
      ))}
    </div>
  );
}
```

#### 2.4 Add Styling

`frontend/src/styles/domain-selector.css`:

```css
.domain-selector {
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 8px;
  margin-bottom: 30px;
}

.domain-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 15px;
  margin-top: 20px;
}

.domain-card {
  padding: 15px;
  background: rgba(255, 255, 255, 0.1);
  border: 2px solid transparent;
  border-radius: 8px;
  color: white;
  cursor: pointer;
  transition: all 0.3s ease;
}

.domain-card:hover {
  background: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.domain-card.selected {
  border-color: #fff;
  background: rgba(255, 255, 255, 0.3);
}

.alert-card {
  border-left: 4px solid;
  padding: 15px;
  margin-bottom: 15px;
  border-radius: 4px;
  background: #f8f9fa;
}

.alert-card.alert-critical {
  border-left-color: #dc3545;
}

.alert-card.alert-high {
  border-left-color: #fd7e14;
}

.alert-card.alert-medium {
  border-left-color: #ffc107;
}

.alert-card.alert-low {
  border-left-color: #28a745;
}
```

**Files to create/update:**
- `frontend/src/components/DomainSelector.jsx` (new)
- `frontend/src/components/AlertCard.jsx` (new)
- `frontend/src/pages/DashboardPage.jsx` (update)
- `frontend/src/styles/domain-selector.css` (new)
- `frontend/src/api.js` (add fetchDomains, fetchAlerts methods)

#### 2.5 Update API client

`frontend/src/api.js`:

```javascript
const API_BASE = 'http://localhost:8000/api/v1';

export async function fetchDomains() {
  const response = await fetch(`${API_BASE}/domains`);
  if (!response.ok) throw new Error('Failed to fetch domains');
  return response.json();
}

export async function fetchAlerts(params = {}) {
  const query = new URLSearchParams();
  if (params.domain) query.append('domain', params.domain);
  if (params.min_level) query.append('min_level', params.min_level);
  if (params.limit) query.append('limit', params.limit);

  const response = await fetch(`${API_BASE}/alerts?${query}`);
  if (!response.ok) throw new Error('Failed to fetch alerts');
  return response.json();
}

export async function fetchEventExplanation(eventId) {
  const response = await fetch(`${API_BASE}/events/${eventId}/explain`);
  if (!response.ok) throw new Error('Failed to fetch explanation');
  return response.json();
}
```

**Acceptance:** Domain selector appears; selecting domain filters alerts; alert cards show source links and mitigation.

---

### Phase 3: Databricks Integration (Weeks 6-8)

**Goal:** Orchestrate model training and evaluation on Databricks so ML is scalable and reproducible.

#### 3.1 Set Up Databricks Authentication

Update `backend/app/core/config.py`:

```python
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # ... existing settings ...
    
    databricks_host: str = os.getenv("DATABRICKS_HOST", "")
    databricks_token: str = os.getenv("DATABRICKS_TOKEN", "")
    databricks_default_job_id: int = int(os.getenv("DATABRICKS_DEFAULT_JOB_ID", "0"))
    databricks_workspace_path: str = "/Workspace/scout"
    
    class Config:
        env_file = ".env"
```

#### 3.2 Implement Databricks Job Orchestration

Update `backend/app/integration/databricks.py`:

```python
import requests
from backend.app.core.config import settings

class DatabricksClient:
    def __init__(self):
        self.host = settings.databricks_host
        self.token = settings.databricks_token
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def run_job(self, job_id: int, parameters: dict = None) -> str:
        """Trigger a Databricks job and return run_id."""
        if not self.host or not self.token:
            raise RuntimeError("Databricks credentials not configured")
        
        url = f"{self.host}/api/2.0/jobs/run-now"
        payload = {
            "job_id": job_id
        }
        if parameters:
            payload["notebook_params"] = parameters
        
        response = requests.post(url, json=payload, headers=self.headers)
        response.raise_for_status()
        
        run_data = response.json()
        run_id = run_data.get('run_id')
        return run_id
    
    def get_run_status(self, run_id: str) -> dict:
        """Get status of a Databricks job run."""
        url = f"{self.host}/api/2.0/jobs/runs/get"
        response = requests.get(url, params={"run_id": run_id}, headers=self.headers)
        response.raise_for_status()
        return response.json()
    
    def trigger_classifier_training(self) -> str:
        """Trigger DistilBERT classifier fine-tuning job."""
        run_id = self.run_job(
            settings.databricks_default_job_id,
            {"task": "train_classifier"}
        )
        return run_id
    
    def trigger_batch_evaluation(self) -> str:
        """Trigger batch evaluation of classifier."""
        run_id = self.run_job(
            settings.databricks_default_job_id,
            {"task": "batch_evaluate"}
        )
        return run_id

databricks_client = DatabricksClient() if settings.databricks_host else None
```

#### 3.3 Add ML Ops API Endpoint

In `backend/app/api/ml_routes.py`:

```python
from backend.app.integration.databricks import databricks_client
from fastapi import HTTPException

@router.post("/ml/train-classifier")
def trigger_classifier_training():
    """Trigger DistilBERT classifier fine-tuning on Databricks."""
    if not databricks_client:
        raise HTTPException(status_code=503, detail="Databricks not configured")
    
    try:
        run_id = databricks_client.trigger_classifier_training()
        return {
            "status": "training_started",
            "run_id": run_id,
            "message": f"Classifier training job {run_id} started on Databricks"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/ml/training-status/{run_id}")
def get_training_status(run_id: str):
    """Poll Databricks for training job status."""
    if not databricks_client:
        raise HTTPException(status_code=503)
    
    try:
        run_data = databricks_client.get_run_status(run_id)
        state = run_data.get('state_message', 'Unknown')
        return {
            "run_id": run_id,
            "state": state,
            "start_time": run_data.get('start_time'),
            "end_time": run_data.get('end_time')
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

#### 3.4 Create Databricks Notebook for Training

Document where notebooks should live: `/Workspace/scout/train_classifier.py`

```python
# Databricks notebook source

# COMMAND ----------

import os
import sys
import json
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification, Trainer, TrainingArguments
from datasets import load_dataset

# COMMAND ----------

# Retrieve parameters from job
dbutils.widgets.text("task", "train_classifier")
task = dbutils.widgets.get("task")

# COMMAND ----------

if task == "train_classifier":
    # Load training data from mounted source
    train_data = load_dataset("json", data_files="/dbfs/mnt/scout/event_train.jsonl")
    
    # Load DistilBERT
    model_id = "distilbert-base-uncased"
    tokenizer = AutoTokenizer.from_pretrained(model_id)
    model = AutoModelForSequenceClassification.from_pretrained(model_id, num_labels=4)
    
    # Tokenize
    def tokenize_fn(batch):
        return tokenizer(batch['text'], truncation=True, padding=True)
    
    train_data = train_data.map(tokenize_fn, batched=True)
    
    # Train
    training_args = TrainingArguments(
        output_dir="/dbfs/mnt/scout/artifacts/classifier_v2",
        num_train_epochs=3,
        per_device_train_batch_size=16,
        save_steps=100,
        save_total_limit=2
    )
    
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_data['train']
    )
    
    trainer.train()
    
    # Save
    model.save_pretrained("/dbfs/mnt/scout/artifacts/classifier_v2")
    tokenizer.save_pretrained("/dbfs/mnt/scout/artifacts/classifier_v2")
    
    print(f"Classifier training complete. Saved to /dbfs/mnt/scout/artifacts/classifier_v2")

elif task == "batch_evaluate":
    # Load evaluation data
    eval_data = load_dataset("json", data_files="/dbfs/mnt/scout/event_eval.jsonl")
    
    # Load trained model
    model = AutoModelForSequenceClassification.from_pretrained("/dbfs/mnt/scout/artifacts/classifier_v2")
    tokenizer = AutoTokenizer.from_pretrained("/dbfs/mnt/scout/artifacts/classifier_v2")
    
    # Evaluate
    from sklearn.metrics import classification_report
    predictions = []
    for example in eval_data['train']:
        inputs = tokenizer(example['text'], truncation=True, return_tensors="pt")
        with torch.no_grad():
            logits = model(**inputs).logits
        pred_id = logits.argmax(-1).item()
        predictions.append(pred_id)
    
    print(classification_report(eval_data['train']['label'], predictions))
```

#### 3.5 Add Scheduling Endpoint

In `backend/app/api/routes.py`:

```python
@router.post("/api/v1/ml/schedule-training")
def schedule_training(schedule_days: int = 7):
    """Schedule periodic classifier training (future enhancement)."""
    # TODO: Use APScheduler to run training every N days
    return {
        "status": "scheduled",
        "interval_days": schedule_days,
        "message": f"Training scheduled every {schedule_days} days"
    }
```

**Files to update/create:**
- `backend/app/integration/databricks.py` — client implementation
- `backend/app/api/ml_routes.py` — training endpoints
- `backend/app/core/config.py` — Databricks settings

**Acceptance:** Training can be triggered via `/api/v1/ml/train-classifier`; status can be polled.

---

## Integration Checkpoints

### Checkpoint 1: Domain Filtering Backend (End of Week 4)

**Deliver:**
- Domain profiles defined
- Backend endpoints filter by domain
- /api/v1/domains endpoint works

**Sync with:** Frontend team (start building UI)

### Checkpoint 2: Frontend Domain Selector (End of Week 5)

**Deliver:**
- Domain selector UI appears
- Selecting domain filters alerts
- Alert cards display source links and mitigation

**Sync with:** Ankit (risk engine provides mitigation), Shashank/Morya (NLP provides confidence)

### Checkpoint 3: Databricks Integration (End of Week 7)

**Deliver:**
- Databricks client works
- Training can be triggered and status polled
- Notebook structure documented

**Sync with:** Person 4 (testing/CI)

### Checkpoint 4: Production Ready (End of Week 8)

**Deliver:**
- Dashboard is demo-ready
- Domain filtering works end-to-end
- Databricks jobs run successfully

**Sync with:** Everyone for final demo

---

## File Structure & Key Paths

```
frontend/
├── src/
│   ├── components/
│   │   ├── DomainSelector.jsx      ← NEW
│   │   ├── AlertCard.jsx           ← NEW
│   │   ├── AlertLevel.jsx          ← NEW (badge showing alert level)
│   │   └── RiskFactorChart.jsx     ← NEW
│   ├── pages/
│   │   └── DashboardPage.jsx       ← Update
│   ├── styles/
│   │   └── domain-selector.css     ← NEW
│   └── api.js                      ← Add domain endpoints
│
backend/
├── app/
│   ├── core/
│   │   └── domains.py              ← NEW: Domain profiles
│   ├── integration/
│   │   └── databricks.py           ← Implement client
│   ├── api/
│   │   ├── ml_routes.py            ← Add training endpoints
│   │   └── routes.py               ← Add domain filtering
│   └── db/
│       └── models.py               ← Add event.domain field
└── notebooks/
    └── train_classifier.py         ← NEW: Databricks notebook

MORYA_FRONTEND_DATABRICKS.md        ← NEW: This file
```

---

## Quick Start Checklist

**This Week (May 9-15):**
- [ ] Define domain profiles in `domains.py`
- [ ] Implement domain filtering logic in risk API
- [ ] Create Domain Selector React component
- [ ] Style alert cards with level colors

**Next Week (May 16-22):**
- [ ] Update DashboardPage to use domain filter
- [ ] Add "View Source" links to alert cards
- [ ] Display mitigation (layman + policy)
- [ ] Add risk factor visualization

**Week After (May 23-29):**
- [ ] Implement Databricks client
- [ ] Create training and evaluation endpoints
- [ ] Document notebook requirements
- [ ] Test end-to-end training trigger

**Final Week (May 30-Jun 5):**
- [ ] Polish UI and fix bugs
- [ ] Performance tuning for large result sets
- [ ] Finalize demo flow
- [ ] Documentation

---

## Success Metrics

By the end of your work:

1. **Domain Focus:** SMEs can select industry and see only relevant risks
2. **Transparency:** Every alert shows "View Source" link and source outlet
3. **Actionability:** Mitigation advice appears for every High+ alert
4. **Explainability:** Users can expand alerts to see risk factor breakdown
5. **Reproducibility:** Classifier training can be triggered on Databricks
6. **Performance:** Dashboard loads in <2 seconds; filtering takes <500ms

---

## Key Principles

- **SME-centric:** The UI is for decision makers, not data scientists
- **Transparency:** Show sources and confidence, not just scores
- **Actionability:** Every alert includes "what to do"
- **Explainability:** Users can drill down to understand decisions
- **Scalability:** ML training happens on Databricks, not in the web server

Good luck! Your work is what makes the platform usable.
