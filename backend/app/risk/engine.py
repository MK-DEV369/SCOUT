from datetime import datetime, timezone

CREDIBILITY_BY_SOURCE = {
    "newsapi": 0.65,
    "gdelt": 0.7,
    "freightos": 0.8,
    "worldbank": 0.95,
    "acled": 0.9,
    "fred": 0.95,
}

CATEGORY_SEVERITY = {
    "conflict": 0.9,
    "sanctions": 0.85,
    "logistics_delay": 0.78,
    "labor_disruption": 0.76,
    "commodity_spike": 0.72,
    "weather": 0.7,
    "cyberattack": 0.84,
    "political_instability": 0.74,
    "infrastructure_failure": 0.82,
    "economic_stress": 0.66,
    # backward-compatible aliases
    "Geopolitical": 0.9,
    "Logistics": 0.78,
    "Environmental": 0.7,
    "Economic": 0.66,
}


def clamp_01(value: float) -> float:
    return max(0.0, min(1.0, value))


def compute_recency_score(timestamp: datetime) -> float:
    now = datetime.now(timezone.utc)
    delta_hours = max((now - timestamp.astimezone(timezone.utc)).total_seconds() / 3600.0, 0.0)
    # Score decays from 1.0 at now to 0.0 after 14 days.
    return clamp_01(1.0 - (delta_hours / (24 * 14)))


def compute_risk_score(
    *,
    category: str,
    timestamp: datetime,
    source: str,
    relevance: float,
    supplier_importance: float,
    severity_override: float | None = None,
) -> dict[str, float | str]:
    severity = severity_override if severity_override is not None else CATEGORY_SEVERITY.get(category, 0.5)
    recency = compute_recency_score(timestamp)
    credibility = CREDIBILITY_BY_SOURCE.get(source.lower(), 0.6)
    geo_relevance = clamp_01(relevance)
    supplier_weight = clamp_01(supplier_importance)

    risk = (
        severity * 0.3
        + recency * 0.2
        + credibility * 0.2
        + geo_relevance * 0.2
        + supplier_weight * 0.1
    )
    risk = clamp_01(risk)

    if risk < 0.4:
        alert = "Low"
    elif risk < 0.6:
        alert = "Medium"
    elif risk < 0.8:
        alert = "High"
    else:
        alert = "Critical"

    return {
        "risk_score": round(risk, 4),
        "alert_level": alert,
        "severity": round(severity, 4),
        "recency": round(recency, 4),
        "credibility": round(credibility, 4),
        "relevance": round(geo_relevance, 4),
        "supplier_importance": round(supplier_weight, 4),
    }
