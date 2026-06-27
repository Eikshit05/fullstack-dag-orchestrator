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
import { checkConnection } from './lib/types';

// One API key per provider (openai/anthropic/google), persisted locally and held
// in the store — never written into a pipeline node, so keys can't leak via Export.
const API_KEYS_STORAGE = 'vs-api-keys';
const loadApiKeys = () => {
  try { return JSON.parse(localStorage.getItem(API_KEYS_STORAGE)) || {}; } catch { return {}; }
};

export const useStore = create((set, get) => ({
    nodes: [],
    edges: [],
    nodeIDs: {},
    clipboard: { nodes: [], edges: [] },
    connectionNotice: null,
    dismissNotice: () => set({ connectionNotice: null }),
    apiKeys: loadApiKeys(),
    setApiKey: (provider, key) => {
      const next = { ...get().apiKeys, [provider]: key };
      try { localStorage.setItem(API_KEYS_STORAGE, JSON.stringify(next)); } catch { /* storage unavailable */ }
      set({ apiKeys: next });
    },
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
    // Copy the current selection into the in-memory clipboard. Only edges whose
    // BOTH endpoints are selected travel with the copy, so a duplicated subgraph
    // keeps its internal wiring without dragging in dangling edges.
    copySelection: () => {
      const selected = get().nodes.filter((n) => n.selected);
      if (selected.length === 0) return;
      const ids = new Set(selected.map((n) => n.id));
      const internalEdges = get().edges.filter(
        (e) => ids.has(e.source) && ids.has(e.target)
      );
      set({
        clipboard: {
          nodes: selected.map((n) => ({ ...n, data: { ...n.data } })),
          edges: internalEdges.map((e) => ({ ...e })),
        },
      });
    },
    // Two-pass paste: (1) clone nodes with fresh ${type}-${n} ids + a diagonal
    // offset, building an old->new id map; (2) clone the internal edges, remapping
    // source/target AND the `${nodeId}-${handleId}` handle strings via prefix swap.
    // Originals are deselected and only the fresh paste ends up selected.
    pasteClipboard: () => {
      const { nodes: clipNodes, edges: clipEdges } = get().clipboard;
      if (!clipNodes || clipNodes.length === 0) return;

      const idMap = {};
      const newNodes = clipNodes.map((n) => {
        const newId = get().getNodeID(n.type);
        idMap[n.id] = newId;
        return {
          ...n,
          id: newId,
          selected: true,
          position: { x: n.position.x + 40, y: n.position.y + 40 },
          data: { ...n.data, id: newId },
        };
      });

      // `${oldId}-handle` -> `${newId}-handle` (prefix swap, not blind replace).
      const remapHandle = (handle, oldId, newId) =>
        handle && handle.startsWith(`${oldId}-`)
          ? `${newId}${handle.slice(oldId.length)}`
          : handle;

      const newEdges = clipEdges.map((e, i) => {
        const newSource = idMap[e.source];
        const newTarget = idMap[e.target];
        return {
          ...e,
          id: `pasted-edge-${newSource}-${newTarget}-${i}-${Date.now()}`,
          source: newSource,
          target: newTarget,
          sourceHandle: remapHandle(e.sourceHandle, e.source, newSource),
          targetHandle: remapHandle(e.targetHandle, e.target, newTarget),
        };
      });

      set({
        nodes: [
          ...get().nodes.map((n) => (n.selected ? { ...n, selected: false } : n)),
          ...newNodes,
        ],
        edges: [...get().edges, ...newEdges],
      });
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
      // Hard block: reject edges whose data types are incompatible (e.g. a Text
      // output into a Number-only Math input). A runtime guard still backstops Any.
      const { ok, sourceType, targetType } = checkConnection(connection, get().nodes);
      if (!ok) {
        set({
          connectionNotice: `Can't connect ${sourceType} → ${targetType}. A ${targetType} input only accepts ${targetType} or Any.`,
        });
        return;
      }
      set({
        edges: addEdge({...connection, type: 'smoothstep', animated: true, markerEnd: {type: MarkerType.Arrow, height: '20px', width: '20px'}}, get().edges),
        connectionNotice: null,
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
