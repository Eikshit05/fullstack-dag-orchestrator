// pipelineExport.js
// Strip secrets from nodes before they are written to an exported file. The LLM
// node's apiKey lives in node.data for the session, but must never be persisted
// into downloadable JSON. Pure + unit-tested.

const SECRET_FIELDS = ['apiKey'];

export function sanitizeNodesForExport(nodes) {
  return nodes.map((node) => {
    if (!node.data) return node;
    const hasSecret = SECRET_FIELDS.some((k) => k in node.data);
    if (!hasSecret) return node;
    const data = { ...node.data };
    for (const k of SECRET_FIELDS) delete data[k];
    return { ...node, data };
  });
}
