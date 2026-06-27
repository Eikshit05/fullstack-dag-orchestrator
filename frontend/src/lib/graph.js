// graph.js
// Pure, dependency-free graph utilities. No React, no Zustand — unit-testable in
// isolation and mirrors the backend's cycle-detection intent on the client so the
// canvas can flag invalid (cyclic) connections live, before the user hits Submit.

/** Build an adjacency map: nodeId -> array of directly reachable nodeIds. */
export function buildAdjacency(edges) {
  const adj = new Map();
  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source).push(e.target);
  }
  return adj;
}

/** BFS reachability: can we travel from `start` to `goal` following edge direction? */
export function isReachable(adj, start, goal) {
  const queue = [start];
  const seen = new Set();
  while (queue.length) {
    const node = queue.shift();
    if (node === goal) return true;
    if (seen.has(node)) continue;
    seen.add(node);
    const next = adj.get(node);
    if (next) queue.push(...next);
  }
  return false;
}

/**
 * Returns the Set of edge ids that lie on a cycle. An edge (u -> v) closes a loop
 * when v can already reach u; self-loops (u === v) count too. The whole cycle
 * lights up, not just the closing edge.
 *
 * Pure and derived: callers style edges from this without ever mutating store
 * state, so the canonical edge data (and any JSON export) stays clean.
 */
export function findCyclicEdgeIds(edges) {
  const adj = buildAdjacency(edges);
  const cyclic = new Set();
  for (const e of edges) {
    if (e.source === e.target || isReachable(adj, e.target, e.source)) {
      cyclic.add(e.id);
    }
  }
  return cyclic;
}
