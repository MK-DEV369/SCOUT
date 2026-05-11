async function request(path, options = {}) {
  const response = await fetch(`${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
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
  events: () => request("/events"),
  risk: () => request("/risk"),
  alerts: (minLevel = "Medium") => request(`/alerts?min_level=${encodeURIComponent(minLevel)}`),
  suppliers: () => request("/suppliers"),
  saveSupplier: (payload) =>
    request(
      `/suppliers?name=${encodeURIComponent(payload.name)}&country=${encodeURIComponent(payload.country || "")}&importance=${payload.importance}`,
      { method: "POST" }
    ),
};
