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

export async function runPipeline(nodes, edges, apiKeys) {
  const res = await fetch(`${BASE_URL}/pipelines/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Execution needs each node's type/data and the edge handles, plus the keys by
    // provider (sent top-level, never stored in a node). The backend routes each AI
    // node to its selected provider/model using the matching key.
    body: JSON.stringify({
      apiKeys,
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

export async function explainPipeline(nodes, edges, context, apiKeys) {
  const res = await fetch(`${BASE_URL}/pipelines/explain`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      apiKeys,
      context, // the memory bus from the last run
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
    throw new Error(data.detail || `Backend responded ${res.status}`);
  }
  return data; // { summary, steps: [{ node_id, action }] }
}
