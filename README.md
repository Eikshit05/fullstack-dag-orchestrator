# Fullstack DAG Orchestrator (Pipeline Builder)

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

The logic-heavy surfaces are covered by focused test suites.

**Frontend (Variable Parsing):**

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
