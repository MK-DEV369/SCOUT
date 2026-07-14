# Databricks notebook source
# COMMAND ----------

"""
Databricks Data Ingestion & Scraping Job

This script demonstrates how a scraping job running on a Databricks cluster
can extract supply chain disruption data, parse/format it, and ingest it
directly into the SCOUT FastAPI backend.
"""

import os
import json
import requests
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

# COMMAND ----------
# Configure variables / widgets
try:
    dbutils.widgets.text("backend_base_url", "https://scout-backend-um0t.onrender.com")
    dbutils.widgets.text("scrape_query", "semiconductor factory disruption OR port lockouts")
    backend_base_url = dbutils.widgets.get("backend_base_url").rstrip("/")
    scrape_query = dbutils.widgets.get("scrape_query")
except Exception:
    backend_base_url = os.getenv("BACKEND_BASE_URL", "https://scout-backend-um0t.onrender.com").rstrip("/")
    scrape_query = os.getenv("SCRAPE_QUERY", "semiconductor factory disruption OR port lockouts")

# COMMAND ----------
# Scrape external feed (e.g., Google News RSS feed for custom keywords)
print(f"Starting Databricks scrape job for query: '{scrape_query}'")
rss_url = "https://news.google.com/rss/search"
params = {
    "q": scrape_query,
    "hl": "en-US",
    "gl": "US",
    "ceid": "US:en"
}

response = requests.get(rss_url, params=params, timeout=30)
response.raise_for_status()

root = ET.fromstring(response.text)
scraped_records = []

for item in root.findall("./channel/item"):
    title = (item.findtext("title") or "").strip()
    description = (item.findtext("description") or "").strip()
    link = (item.findtext("link") or "").strip()
    source = (item.findtext("source") or "").strip() or "Google News Scraper"
    
    text = " ".join([title, description]).strip()
    if not text:
        continue
        
    scraped_records.append({
        "source": "databricks_scraper",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "text": text,
        "location": source,
        "source_id": link,
        "metadata": {
            "link": link,
            "origin": "Databricks Scraping Cluster",
            "query": scrape_query
        }
    })

print(f"Scraped {len(scraped_records)} records from RSS feed.")

# COMMAND ----------
# Push the scraped records to the SCOUT backend API
if scraped_records:
    # SCOUT unified ingest endpoint accepts records
    upload_url = f"{backend_base_url}/api/v1/records"
    print(f"Ingesting records into backend at {upload_url}...")
    
    # We can post to our records endpoint or a custom ingest endpoint
    # Let's post them in a batch or one-by-one.
    success_count = 0
    
    # Send records to backend (SCOUT records ingest accepts UnifiedRecord format)
    # Alternatively, you can save records directly to DBFS or mounted S3.
    try:
        # For demonstration, we save to DBFS/Delta Lake
        # spark_df = spark.createDataFrame(scraped_records)
        # spark_df.write.format("delta").mode("append").save("/mnt/scout/raw_scraped_data")
        print("Mock DBFS/Delta Lake Save: Delta write completed to /mnt/scout/raw_scraped_data")
        
        # Pushing to backend API
        headers = {"Content-Type": "application/json"}
        for record in scraped_records[:10]: # limit to top 10 for demonstration
            # Prepare payload for UnifiedRecord mapping
            # (FastAPI backend will deduplicate via content_hash)
            payload = {
                "source": record["source"],
                "timestamp": record["timestamp"],
                "text": record["text"],
                "location": record["location"],
                "metadata": record["metadata"],
                "source_id": record["source_id"]
            }
            resp = requests.post(f"{backend_base_url}/api/v1/records", json=payload, headers=headers, timeout=15)
            if resp.status_code in (200, 201):
                success_count += 1
                
        print(f"Successfully posted {success_count} records to FastAPI backend.")
    except Exception as e:
        print(f"Warning: Failed to ingest directly into API (Backend might be offline/local): {e}")
        print("Note: In cloud production, Databricks scrapes data directly into S3/Delta Lake or database mount.")
else:
    print("No records scraped. Check query parameters.")
