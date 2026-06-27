const BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

export async function parsePipeline(nodes, edges) {
  const res = await fetch(`${BASE_URL}/pipelines/parse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nodes: nodes.map((n) => ({ id: n.id })),
      edges: edges.map((e) => ({ source: e.source, target: e.target })),
    }),
  });
  if (!res.ok) {
    throw new Error(`Backend responded ${res.status}`);
  }
  return res.json();
}

export async function runPipeline(nodes, edges) {
  const res = await fetch(`${BASE_URL}/pipelines/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Execution needs each node's type/data (incl. the apiKey) and the edge
    // handles, so the engine can resolve dependencies across the memory bus.
    body: JSON.stringify({
      nodes: nodes.map((n) => ({ id: n.id, type: n.type, data: n.data })),
      edges: edges.map((e) => ({
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      })),
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // The backend sends a human-readable reason in `detail` (missing key, cycle…).
    throw new Error(data.detail || `Backend responded ${res.status}`);
  }
  return data;
}
