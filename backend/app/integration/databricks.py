"""Detailed Databricks REST API helper for running jobs from the backend.
"""
from typing import Any, Dict, Optional
import requests
import logging
from app.core.config import settings

logger = logging.getLogger(__name__)

class DatabricksClient:
    def __init__(self) -> None:
        self.host = settings.databricks_host
        self.token = settings.databricks_token
        if not self.host or not self.token:
            raise RuntimeError("Databricks host/token not configured in settings")
        self.base = self.host.rstrip("/")
        self.headers = {"Authorization": f"Bearer {self.token}", "Content-Type": "application/json"}

    def run_job(self, job_id: int, notebook_params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        url = f"{self.base}/api/2.1/jobs/run-now"
        payload: Dict[str, Any] = {"job_id": int(job_id)}
        if notebook_params:
            payload["notebook_params"] = notebook_params

        resp = requests.post(url, json=payload, headers=self.headers, timeout=30)
        resp.raise_for_status()
        return resp.json()

    def get_run_status(self, run_id: int) -> Dict[str, Any]:
        url = f"{self.base}/api/2.1/jobs/runs/get"
        resp = requests.get(url, params={"run_id": int(run_id)}, headers=self.headers, timeout=20)
        resp.raise_for_status()
        return resp.json()

    def trigger_classifier_training(self) -> str:
        """Trigger DistilBERT classifier fine-tuning job."""
        if not settings.databricks_default_job_id:
            raise RuntimeError("No default Databricks job id configured")
        res = self.run_job(
            int(settings.databricks_default_job_id),
            {"task": "train_classifier"}
        )
        return str(res.get("run_id", ""))

    def trigger_batch_evaluation(self) -> str:
        """Trigger batch evaluation of classifier."""
        if not settings.databricks_default_job_id:
            raise RuntimeError("No default Databricks job id configured")
        res = self.run_job(
            int(settings.databricks_default_job_id),
            {"task": "batch_evaluate"}
        )
        return str(res.get("run_id", ""))

    def trigger_scraping_job(self) -> str:
        """Trigger a data scraping job on Databricks."""
        if not settings.databricks_default_job_id:
            raise RuntimeError("No default Databricks job id configured")
        res = self.run_job(
            int(settings.databricks_default_job_id),
            {"task": "scrape_data"}
        )
        return str(res.get("run_id", ""))

# Global Databricks client instance if credentials exist
databricks_client = None
if settings.databricks_host and settings.databricks_token:
    try:
        databricks_client = DatabricksClient()
    except Exception as e:
        logger.warning("Failed to initialize DatabricksClient: %s", e)

def trigger_default_job() -> Dict[str, Any]:
    # Skip if Databricks credentials not configured
    if not settings.databricks_token:
        return {
            "triggered": False,
            "reason": "Databricks token not configured (set DATABRICKS_TOKEN env var)",
        }
    
    if not settings.databricks_default_job_id:
        raise RuntimeError("No default Databricks job id configured")
    
    try:
        client = DatabricksClient()
        res = client.run_job(int(settings.databricks_default_job_id))
        return {
            "triggered": True,
            "run_id": res.get("run_id"),
            "number_in_job": res.get("number_in_job"),
        }
    except requests.HTTPError as exc:
        response = exc.response
        return {
            "triggered": False,
            "job_id": settings.databricks_default_job_id,
            "status_code": getattr(response, "status_code", None),
            "error": str(exc),
        }
    except RuntimeError as exc:
        return {
            "triggered": False,
            "error": str(exc),
        }
