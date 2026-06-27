// store.js

// `createWithEqualityFn` keeps support for the `useStore(selector, shallow)`
// equality-function form (the plain `create` deprecated it in zustand v4.4+).
import { createWithEqualityFn as create } from "zustand/traditional";
import {
    addEdge,
    applyNodeChanges,
    applyEdgeChanges,
    MarkerType,
  } from 'reactflow';

export const useStore = create((set, get) => ({
    nodes: [],
    edges: [],
    nodeIDs: {},
    getNodeID: (type) => {
        const newIDs = {...get().nodeIDs};
        if (newIDs[type] === undefined) {
            newIDs[type] = 0;
        }
        newIDs[type] += 1;
        set({nodeIDs: newIDs});
        return `${type}-${newIDs[type]}`;
    },
    addNode: (node) => {
        set({
            nodes: [...get().nodes, node]
        });
    },
    // Replace the whole canvas from an imported pipeline. Rebuilds the per-type id
    // counter from the imported ids so newly added nodes never collide with
    // imported ones (import `customInput-3`, then drag a new Input -> `customInput-4`,
    // not `customInput-1`). Ids that don't match the `${type}-${n}` convention are
    // ignored when seeding the counter.
    importPipeline: ({ nodes, edges }) => {
      const nodeIDs = {};
      for (const node of nodes) {
        const id = node?.id ?? '';
        const dash = id.lastIndexOf('-');
        if (dash === -1) continue;
        const type = id.slice(0, dash);
        const num = parseInt(id.slice(dash + 1), 10);
        if (Number.isNaN(num)) continue;
        nodeIDs[type] = Math.max(nodeIDs[type] ?? 0, num);
      }
      set({ nodes, edges, nodeIDs });
    },
    onNodesChange: (changes) => {
      set({
        nodes: applyNodeChanges(changes, get().nodes),
      });
    },
    onEdgesChange: (changes) => {
      set({
        edges: applyEdgeChanges(changes, get().edges),
      });
    },
    onConnect: (connection) => {
      set({
        edges: addEdge({...connection, type: 'smoothstep', animated: true, markerEnd: {type: MarkerType.Arrow, height: '20px', width: '20px'}}, get().edges),
      });
    },
    updateNodeField: (nodeId, fieldName, fieldValue) => {
      set({
        nodes: get().nodes.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, [fieldName]: fieldValue } }
            : node
        ),
      });
    },
    removeNode: (nodeId) => {
      set({
        nodes: get().nodes.filter((n) => n.id !== nodeId),
        edges: get().edges.filter(
          (e) => e.source !== nodeId && e.target !== nodeId
        ),
      });
    },
    syncNodeHandles: (nodeId, validHandleIds) => {
      const valid = new Set(validHandleIds);
      set({
        edges: get().edges.filter((e) => {
          if (e.source === nodeId && e.sourceHandle && !valid.has(e.sourceHandle)) {
            return false;
          }
          if (e.target === nodeId && e.targetHandle && !valid.has(e.targetHandle)) {
            return false;
          }
          return true;
        }),
      });
    },
  }));
