# Fullstack DAG Orchestrator (Pipeline Builder)

[![CI](https://github.com/Eikshit05/fullstack-dag-orchestrator/actions/workflows/ci.yml/badge.svg)](https://github.com/Eikshit05/fullstack-dag-orchestrator/actions/workflows/ci.yml)

A node-based pipeline editor built with a **React + ReactFlow** frontend and a **FastAPI** backend. This repository was engineered to fulfill the VectorShift frontend technical assessment, prioritizing scalable node abstractions, deterministic state management, and robust graph validation.

**Author:** Eikshit Singhal

---

## 🚀 Quick Start

### Prerequisites

* **Node.js**: v18+
* **Python**: 3.10+

### 1. Start the Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload
```

*The API will be available at `http://localhost:8000`.*

### 2. Start the Frontend (New Terminal)

```bash
cd frontend
npm install
npm start
```

*The application will open at `http://localhost:3000`.*

*(Note: `npm start` automatically triggers a `prestart` hook to compile the Tailwind CSS via CLI before launching the React development server. See "Styling Pipeline" below for architectural details.)*

---

## 🏗️ Architecture & Technical Decisions

### Part 1: Config-Driven Node Abstraction

Nodes are treated as declarative data rather than hardcoded React components. Every node is defined by a configuration file in `src/nodes/configs/` (e.g., `llm.js`), which is rendered by a singular `BaseNode.jsx`.

* **Field Registry:** Input fields map to a renderer registry (`src/nodes/fields/`) via a `kind` property (`text`, `select`, `checkbox`, etc.). Adding a new field type requires exactly one registry entry.
* **Dynamic Handles:** Handles distribute evenly per side automatically. Both `fields` and `handles` can accept functions of node data for dynamic rendering, and a config may supply a `render()` escape hatch for fully custom bodies.
* **Demonstration:** Five custom nodes (`filter`, `math`, `http`, `conditional`, `note`) are included to showcase the abstraction's flexibility; only `note` uses the `render()` escape hatch.

### Part 2: Unified Design System

The UI utilizes a token-driven Tailwind design system configured in `tailwind.config.js`. Category accent colors, radii, and shadows are centralized. Modifying a category token updates all corresponding nodes and toolbar elements globally.

### Part 3: Text Node Mechanics

The text node (`src/nodes/TextNodeBody.jsx`) is hardened against common canvas UI bugs:

* **Auto-Resize via Hidden Mirror:** Instead of brittle JavaScript text-width calculations, the node utilizes a hidden-mirror `<div>` combined with an rAF-throttled `ResizeObserver`. The browser's native layout engine computes the geometry, preventing layout thrashing during canvas zoom/pan.
* **Variable Extraction:** `{{variable}}` handles are extracted via `src/lib/parseVariables.js`, which filters for valid, unique, non-reserved JavaScript identifiers.
* **Debounced State:** Recomputation is debounced (~300ms) to prevent transient typos from destroying existing edges. `updateNodeInternals` is tightly controlled to keep edges visually anchored as the node resizes.

### Part 4: Backend Integration & Graph Validation

The backend exposes `POST /pipelines/parse`, accepting a JSON payload of nodes and edges.

* **Referential Integrity:** A Pydantic validator intercepts edges referencing non-existent nodes, returning a clean `422 Unprocessable Entity` rather than throwing a `500 Internal Server Error`.
* **Kahn’s Algorithm:** Directed Acyclic Graph (DAG) validation is computed linearly. The algorithm initializes the in-degree array for *all* nodes in the payload, ensuring disconnected subgraphs and isolated nodes do not falsely trigger cycle detections.
* **Submit Feedback:** Pipeline submission triggers both a native `window.alert()` (satisfying strict assessment criteria) and a polished UI modal (`ResultCard`). The alert is deferred via `setTimeout(..., 0)` to prevent main-thread blocking before the React commit/paint cycle completes.

---

## ✨ Beyond the Brief

Five production-grade capabilities were layered on top of the assessment requirements. Each reuses the existing config-driven architecture without disrupting it, ships on its own branch, and is covered by tests and an in-browser verification.

| Feature | What it does | Notable decision |
| --- | --- | --- |
| **Live cycle validation** | Edges that form a cycle render red + dashed the instant the loop closes, and clear themselves when an edge is removed. | Styling is **derived at render** (`useMemo`) from a pure `src/lib/graph.js` reachability check — store edges stay pristine, so cycle styling never leaks into the JSON export. |
| **Export / Import JSON** | Export the canvas to `pipeline.json`; import one back to fully rehydrate it. | Import runs through a `store.importPipeline` action that **rebuilds the per-type id counter** from the imported ids, so a node added after import can't collide with an imported id. |
| **Command palette (⌘K)** | Add any node type from a searchable, keyboard-driven palette ([`cmdk`](https://github.com/pacocoursey/cmdk)) — dropped at the center of the current viewport. | Uses `project()` (the method actually present on `useReactFlow` in the pinned reactflow `11.8.3`) against the canvas pane, and `getNodeID` to preserve the `${type}-${n}` convention. |
| **Copy / paste (⌘C / ⌘V)** | Duplicate the current selection, including the edges *between* selected nodes, offset diagonally and re-selected (Figma-style). | A two-pass clone remaps `source`/`target` **and** the `${nodeId}-${handleId}` handle strings via prefix swap, so duplicated subgraphs keep their wiring. A focus guard ignores the shortcut while typing in a field. |
| **Node deletion** | A contextual **✕** button on every node removes it and prunes its orphaned edges. | Native `Backspace`/`Delete` only fires when the node element itself holds focus (verified in-browser); the button is the focus- and zoom-independent primary path. Carries reactflow's `nodrag` class so the click isn't swallowed by a drag. |

### Keyboard shortcuts

| Shortcut | Action |
| --- | --- |
| `⌘K` / `Ctrl+K` | Open the command palette to add a node |
| `⌘C` / `Ctrl+C` | Copy the selected node(s) |
| `⌘V` / `Ctrl+V` | Paste the copied selection |
| `Backspace` / `Delete` | Delete the focused node (or use the ✕ button) |
| `Shift` + drag | Box-select multiple nodes |

---

## ⚙️ Configuration & Tooling

### Styling Pipeline

`react-scripts@5` silently drops external PostCSS plugins injected via CRACO, breaking Tailwind compilation in standard CRA setups. To maintain build determinism without ejecting or fighting Webpack internals, Tailwind is **precompiled via its own CLI**.

* `src/styles/index.css` is compiled to `src/styles/tailwind-out.css` (gitignored) prior to Webpack bundling.
* Standard `npm start` and `npm run build` commands function seamlessly via `concurrently`.

### Environment Variables

* **Frontend:** Copy `frontend/.env.example` to `frontend/.env` to override `REACT_APP_API_URL`.
* **Backend:** Define `CORS_ORIGINS` (comma-separated) to authorize external frontend deployments.

---

## 🧪 Testing

The logic-heavy surfaces are covered by focused test suites (32 frontend + 14 backend), run on every push via GitHub Actions.

**Frontend (32 tests):** variable parsing, store mechanics (immutable updates, edge pruning, import counter rebuild, copy/paste subgraph rewiring), graph cycle detection, the submit flow, and the API client.

```bash
cd frontend
CI=true npm test -- --watchAll=false
```

**Backend (DAG Algorithm):**
*Tests cover empty graphs, simple chains, self-loops, standard cycles, diamond patterns, disconnected components, and isolated nodes.*

```bash
cd backend
source .venv/bin/activate
python -m pytest -v
```
