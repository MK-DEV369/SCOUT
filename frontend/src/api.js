const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

async function request(path, options = {}) {
  const { body, headers, ...rest } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    body: body && typeof body !== "string"
      ? JSON.stringify(body)
      : body,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API error ${response.status}: ${text}`);
  }

  return response.json();
}

export const api = {
  ingest: () => request("/api/v1/ingest", { method: "POST" }),

  buildEvents: () => request("/api/v1/events", { method: "POST" }),

  scoreRisk: () => request("/api/v1/risk", { method: "POST" }),

  runPipeline: (payload) =>
    request("/api/v1/pipeline/onboard", {
      method: "POST",
      body: payload,
    }),

  events: () => request("/api/v1/events"),

  risk: () => request("/api/v1/risk"),

  alerts: (minLevel = "Medium") =>
    request(
      `/api/v1/alerts?min_level=${encodeURIComponent(minLevel)}`
    ),

  suppliers: () => request("/api/v1/suppliers"),

  graphSummary: () =>
    request("/api/v1/graph-summary"),

  graphImpact: ({
    eventId,
    manufacturerId,
    limit = 25,
  }) =>
    request(
      `/api/v1/impact/${encodeURIComponent(
        eventId
      )}?manufacturer_id=${encodeURIComponent(
        manufacturerId
      )}&limit=${encodeURIComponent(limit)}`
    ),

  supplierRisk: (supplierId, limit = 10) =>
    request(
      `/api/v1/supplier-risk/${encodeURIComponent(
        supplierId
      )}?limit=${encodeURIComponent(limit)}`
    ),

  saveSupplier: (payload) =>
    request(
      `/api/v1/suppliers?name=${encodeURIComponent(
        payload.name
      )}&country=${encodeURIComponent(
        payload.country || ""
      )}&importance=${payload.importance}`,
      {
        method: "POST",
      }
    ),
};