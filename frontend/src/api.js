async function request(path, options = {}) {
  const { body, headers, ...rest } = options;
  const response = await fetch(`${path}`, {
    ...rest,
    headers: {
      "Content-Type": "application/json",
      ...(headers || {}),
    },
    body: body && typeof body !== "string" ? JSON.stringify(body) : body,
  });
  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }
  return response.json();
}

export const api = {
  ingest: () => request("/ingest", { method: "POST" }),
  buildEvents: () => request("/events", { method: "POST" }),
  scoreRisk: () => request("/risk", { method: "POST" }),
  runPipeline: (payload) => request("/pipeline/onboard", { method: "POST", body: payload }),
  events: () => request("/events"),
  risk: () => request("/risk"),
  alerts: (minLevel = "Medium") => request(`/alerts?min_level=${encodeURIComponent(minLevel)}`),
  suppliers: () => request("/suppliers"),
  graphSummary: () => request("/graph/graph-summary"),
  graphImpact: ({ eventId, manufacturerId, limit = 25 }) =>
    request(
      `/graph/impact/${encodeURIComponent(eventId)}?manufacturer_id=${encodeURIComponent(manufacturerId)}&limit=${encodeURIComponent(limit)}`
    ),
  supplierRisk: (supplierId, limit = 10) => request(`/graph/supplier-risk/${encodeURIComponent(supplierId)}?limit=${encodeURIComponent(limit)}`),
  saveSupplier: (payload) =>
    request(
      `/suppliers?name=${encodeURIComponent(payload.name)}&country=${encodeURIComponent(payload.country || "")}&importance=${payload.importance}`,
      { method: "POST" }
    ),
};
