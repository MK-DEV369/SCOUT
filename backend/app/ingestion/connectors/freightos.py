from typing import Any

import httpx

from app.core.config import settings


class FreightosConnector:
    """Minimal Freightos helper for emissions and route-risk simulation."""

    base_url = "https://api.freightos.com/api/v1"

    def _auth_headers(self) -> dict:
        if not settings.freightos_api_key:
            raise RuntimeError("FREIGHTOS_API_KEY is not configured")
        return {"x-apikey": settings.freightos_api_key, "Content-Type": "application/json"}

    async def calculate_emissions(self, shipment: dict[str, Any]) -> dict[str, Any]:
        """Call Freightos `/co2calc` endpoint with a shipment payload and return the API response.

        Example payloads (FCL / LCL) are supported as provided in the API docs.
        """
        headers = self._auth_headers()
        url = f"{self.base_url}/co2calc"

        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(url, headers=headers, json=shipment)
            response.raise_for_status()
            return response.json()

    async def simulate_route_risk(
        self,
        *,
        origin: str,
        destination: str,
        mode: str,
        disruption_severity: float,
    ) -> dict[str, Any]:
        """Return a simple mitigation simulation record for a route.

        This is intentionally lightweight: it estimates delay and risk from the
        route description and disruption severity, then suggests a mitigation mode.
        """
        severity = max(0.0, min(1.0, float(disruption_severity)))
        mode_key = mode.strip().lower()

        base_delay_days = {
            "air": 2,
            "fcl": 7,
            "fcl_reefer": 8,
            "lcl": 6,
            "ltl": 4,
            "rail": 5,
            "barge": 6,
            "roro": 6,
            "express": 1,
        }.get(mode_key, 5)

        estimated_delay_days = max(1, round(base_delay_days * (1.0 + severity * 1.5)))

        if severity >= 0.75:
            risk_level = "high"
            alternative_mode = "air" if mode_key not in {"air", "express"} else "express"
            mitigation_recommendation = "Use expedited routing, buffer inventory, and pre-book alternative capacity."
            emission_impact = "increased"
        elif severity >= 0.4:
            risk_level = "medium"
            alternative_mode = "rail" if mode_key in {"fcl", "lcl", "ltl"} else "air"
            mitigation_recommendation = "Monitor capacity, split shipments where possible, and prepare fallback routing."
            emission_impact = "slightly increased"
        else:
            risk_level = "low"
            alternative_mode = mode
            mitigation_recommendation = "Maintain current routing with standard monitoring."
            emission_impact = "stable"

        return {
            "route": f"{origin} → {destination}",
            "origin": origin,
            "destination": destination,
            "mode": mode,
            "estimated_delay_days": estimated_delay_days,
            "risk_level": risk_level,
            "alternative_mode": alternative_mode,
            "mitigation_recommendation": mitigation_recommendation,
            "emission_impact": emission_impact,
            "disruption_severity": severity,
        }
