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
  saveSupplier: (payload) =>
    request(
      `/suppliers?name=${encodeURIComponent(payload.name)}&country=${encodeURIComponent(payload.country || "")}&importance=${payload.importance}`,
      { method: "POST" }
    ),
};
