# VectorShift Pipeline Builder

A node-based pipeline editor — **React + ReactFlow** frontend, **FastAPI** backend.
Built for the VectorShift frontend technical assessment.

## Run

**Backend** (Python 3.10+):

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload          # http://localhost:8000
```

**Frontend** (Node 18+):

```bash
cd frontend
npm install
npm start                          # http://localhost:3000
```

`npm start` compiles Tailwind to a static stylesheet (via `prestart`/`build:css`)
and runs the watcher alongside `react-scripts` (see "Styling pipeline" below).

## Architecture

### Part 1 — Config-driven node abstraction
Every node is a **declarative config** in `src/nodes/configs/` (e.g. `llm.js`), rendered
by a single `src/nodes/BaseNode.jsx`. A config declares `title`, `category`, `fields`,
and `handles`:

- **Fields** map to a renderer registry (`src/nodes/fields/`) by `kind`
  (`text`, `textarea`, `select`, `number`, `checkbox`). Adding a field type = one entry.
- **Handles** distribute evenly per side automatically.
- `fields`/`handles` may be **functions of node data** for dynamic nodes, and a config
  may supply a `render()` **escape hatch** for fully custom bodies.

Adding a node ≈ a ~15-line config + one toolbar entry. Five demo nodes (`filter`,
`math`, `http`, `conditional`, `note`) showcase the range; only `note` uses `render()`.

### Part 2 — Unified design
A token-driven Tailwind design system (`tailwind.config.js`): per-category accent colors,
radii, shadows. Changing a category color updates every node and toolbar chip in one place.

### Part 3 — Text node
`src/nodes/TextNodeBody.jsx`:
- **Auto-resize** via a hidden-mirror `<div>` + `ResizeObserver` (rAF-throttled), so the
  browser's layout engine computes width/height — no brittle JS text measurement.
- **`{{variable}}` handles**: `src/lib/parseVariables.js` extracts valid, unique,
  non-reserved identifiers; each becomes a left-side input handle. Recomputation is
  **debounced (~300ms)** (so transient typos don't thrash), orphaned edges are pruned on
  genuine removal, and `updateNodeInternals` keeps edges anchored as handles/size change.

### Part 4 — Backend integration
`POST /pipelines/parse` accepts `{nodes, edges}` and returns
`{num_nodes, num_edges, is_dag}`. The DAG check uses **Kahn's algorithm** (in-degree-0
nodes — including isolated/disconnected ones — seed the queue). A Pydantic validator
rejects edges referencing unknown nodes with a clean `422` (never a `500`). CORS origins
come from the `CORS_ORIGINS` env var (defaults to `http://localhost:3000`).

**Submit feedback:** clicking Submit fires a native `window.alert()` with the results
(the assessment's literal requirement) **and** shows a styled result modal
(`ResultCard`) for a user-friendly presentation. The alert is deferred via
`setTimeout(0)` so the modal paints first.

## Styling pipeline (note)

react-scripts 5 silently drops PostCSS plugins injected through CRACO, so Tailwind never
ran in the webpack bundle. Rather than fight that black box, Tailwind is **precompiled
with its own CLI** (`src/styles/index.css` → `src/styles/tailwind-out.css`, gitignored)
and imported as plain CSS — deterministic, and the app still runs with standard
`npm start` / `npm run build`.

## Configuration

- Frontend: `frontend/.env.example` → copy to `.env` to override `REACT_APP_API_URL`.
- Backend: `CORS_ORIGINS` env var (comma-separated) to allow additional origins.

## Tests

```bash
# Frontend — parseVariables
cd frontend && CI=true npm test -- --watchAll=false

# Backend — DAG algorithm (empty, chain, self-loop, cycle, diamond, disconnected, isolated)
cd backend && source .venv/bin/activate && python -m pytest -v
```
