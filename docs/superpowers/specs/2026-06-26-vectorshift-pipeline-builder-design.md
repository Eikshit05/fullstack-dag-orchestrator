# VectorShift Frontend Technical Assessment — Design Spec

**Date:** 2026-06-26
**Author:** Engineering (senior-level design)
**Status:** Approved for implementation planning

---

## 1. Purpose & Scope

Build a node-based pipeline editor that satisfies the four parts of the VectorShift
Frontend Technical Assessment:

1. **Node abstraction** — a reusable abstraction so new nodes are cheap to create and
   styles apply uniformly, demonstrated with 5 additional nodes.
2. **Styling** — an appealing, unified visual design.
3. **Text node logic** — auto-resize as the user types, and dynamic input handles
   generated from `{{ variable }}` syntax.
4. **Backend integration** — submit the pipeline to FastAPI, compute node/edge counts
   and whether the graph is a DAG, and report the result to the user.

The assessment is judged on **task completion, code architecture, and design**. This
spec optimizes for all three, and explicitly hardens the design against the failure
modes most likely to surface in a live demo.

Out of scope (YAGNI): authentication, persistence/localStorage, multi-pipeline
management, real LLM execution, deployment/CI. These are deliberately excluded to keep
the submission focused.

---

## 2. Confirmed Technical Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Node abstraction | **Config-driven + escape hatch** | Best showcases "flexibility/efficiency" — a new node is ~15 lines of data |
| Styling | **Tailwind CSS v3 via CRACO** | Chosen for speed/consistency; v3 + CRACO is the proven path on Create React App |
| Submit feedback | **Native `alert()` (primary) + styled result card (enhancement)** | `alert()` satisfies the spec verbatim; the card adds polish at zero grading risk |
| Backend transport | **`POST` with JSON body (Pydantic)** | Correct REST semantics for sending a pipeline payload |
| DAG check | **Kahn's algorithm (topological sort)** | Linear time, handles self-loops, multi-edges, disconnected components |
| Repo | **Single private monorepo via `gh`** | Replaces the corrupt `frontend/.git`; per-part feature branches |

---

## 3. Repository & Project Structure

A single monorepo at the project root. The existing `frontend/.git` is corrupt
(`bad object HEAD`, no recoverable history) and will be removed; a fresh root repo is
initialized in its place.

```
vectorshift-assessment/                # root monorepo (new git repo)
├── docs/superpowers/specs/            # this spec
├── frontend/
│   ├── craco.config.js               # enables Tailwind/PostCSS on CRA
│   ├── tailwind.config.js            # design tokens (colors, radii, shadows, spacing)
│   ├── postcss.config.js
│   └── src/
│       ├── components/               # shared, non-node UI
│       │   ├── ResultCard.jsx        # styled submit-result card
│       │   └── ...
│       ├── nodes/
│       │   ├── BaseNode.jsx          # the single renderer for all nodes
│       │   ├── fields/               # field-kind registry (one component per kind)
│       │   │   ├── index.js          # kind -> component map
│       │   │   ├── TextField.jsx
│       │   │   ├── TextAreaField.jsx
│       │   │   ├── SelectField.jsx
│       │   │   ├── NumberField.jsx
│       │   │   └── CheckboxField.jsx
│       │   ├── configs/              # one tiny file per node type
│       │   │   ├── index.js          # registry: type -> config
│       │   │   ├── input.js
│       │   │   ├── output.js
│       │   │   ├── llm.js
│       │   │   ├── text.js
│       │   │   └── (5 new) filter.js, math.js, http.js, conditional.js, note.js
│       │   └── createNodeComponent.js # binds a config to BaseNode for ReactFlow
│       ├── lib/
│       │   ├── parseVariables.js     # pure: text -> [valid, unique var names]
│       │   ├── api.js                # backend client
│       │   └── graph.js              # any frontend graph helpers (if needed)
│       ├── store.js                  # zustand (cleaned up)
│       ├── ui.jsx
│       ├── toolbar.jsx
│       ├── submit.jsx
│       ├── App.jsx
│       └── styles/
│           ├── index.css             # Tailwind directives + globals
│           └── reactflow-overrides.css
└── backend/
    ├── main.py                       # FastAPI: POST JSON, counts, DAG, CORS
    └── (optional) tests/test_dag.py  # pytest for the DAG check
```

---

## 4. Part 1 — Node Abstraction (core)

### 4.1 A node is declarative data

Each node type is described by a config object. Example:

```js
// nodes/configs/llm.js
export const llmConfig = {
  type: 'llm',
  title: 'LLM',
  category: 'ai',                       // drives accent color via tokens
  fields: [
    { name: 'model', label: 'Model', kind: 'select',
      options: ['gpt-4o', 'claude-opus-4'], default: 'gpt-4o' },
  ],
  handles: [                            // STATIC form
    { id: 'system',   type: 'target', position: 'left' },
    { id: 'prompt',   type: 'target', position: 'left' },
    { id: 'response', type: 'source', position: 'right' },
  ],
};
```

### 4.2 `BaseNode` — the single renderer

`BaseNode` is the only component that renders node chrome. It:

1. Renders a **header** (title + category accent color from tokens).
2. Maps **`fields` → field-renderer registry**. Each `kind` resolves to one small
   component that reads its value from `data` and writes via `store.updateNodeField`.
   Adding a new field type = add one entry to the registry.
3. Renders **handles** with automatic even vertical distribution when multiple share a
   side (replaces the hand-tuned `top: 100/3%` math in the original `llmNode`).

### 4.3 Escape hatch (preserves flexibility)

Two levels, so the abstraction never becomes a straitjacket:

- **Dynamic `handles`/`fields`:** either may be a **function of node data**
  `(data) => [...]` instead of a static array. The Text node uses
  `handles: (data) => [...]` to grow input handles from `{{variables}}` — no special
  casing, same rendering path.
- **Custom `render(props)`:** a config may supply a full custom body for the rare node
  that needs it.

**Discipline rule (item 7):** Of the 5 demo nodes, **at most one** uses `render()`.
The rest stay pure config, so the abstraction proves itself. Planned demo nodes:

| Node | Demonstrates |
|---|---|
| Filter | text + select fields, 1 in / 1 out |
| Math | two number inputs, select operator, multi-handle |
| HTTP Request | text (URL) + select (method), source-only output |
| Conditional | multiple target + multiple source handles |
| Note | **the one `render()` escape-hatch case** — no handles, free-text only |

### 4.4 Registration

`configs/index.js` exports a `type -> config` registry. `ui.jsx` builds `nodeTypes`
by mapping each config through `createNodeComponent(config)`, eliminating the manual
`nodeTypes` map and the per-node `import`s. Adding a node = drop a config file + one
registry line + one `DraggableNode` in the toolbar.

---

## 5. Part 2 — Styling & Design System

- Tokens live in `tailwind.config.js` `theme.extend`: per-category accent colors
  (input/output/ai/logic/text), radii, shadows, spacing scale, font.
- One category color changes in **one place** and propagates to every node — this is
  the visible payoff of the Part 1 abstraction.
- Surfaces styled into a cohesive language: toolbar, canvas/background, node card,
  handles, draggable chips, submit button, result card.
- Light ReactFlow overrides for grid, edges, controls, and minimap in
  `reactflow-overrides.css`.

---

## 6. Part 3 — Text Node Logic

### 6.1 Auto-resize

A `<textarea>` (replacing the single-line `<input>`) grows with content: height
tracks `scrollHeight`; width tracks the longest line. Both are **clamped** to
min/max bounds so the canvas layout stays stable.

### 6.2 Variable handles

`parseVariables(text)` (pure function in `lib/`):

- Regex: `/\{\{\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\}\}/g`
- **Dedupe** repeated names (`{{x}} {{x}}` → one handle).
- Keep only **valid JS identifiers**; ignore reserved words and malformed tokens.
- Returns a stable, ordered, unique list.

These feed the Text config's `handles: (data) => [...]` → left-side **target** handles
appear/disappear live as the user types. The Text node writes `text` to the store so
handle recomputation is driven by state.

### 6.3 Pinned edge-case behavior (item 2)

| Case | Behavior |
|---|---|
| Duplicate `{{x}} {{x}}` | One handle |
| Invalid/reserved identifier | Ignored (no handle) |
| Whitespace inside braces | Trimmed; `{{ x }}` == `{{x}}` |
| Handle id collision | Namespaced as `${nodeId}-var-${name}` |
| **Variable deleted while an edge is connected** | **Store prunes orphaned edges** whose `targetHandle` no longer exists (see §8) |

---

## 7. Part 4 — Backend Integration

### 7.1 Frontend

- `submit.jsx` reads `nodes`/`edges` from the store and calls `lib/api.js`.
- `lib/api.js` `POST`s JSON `{ nodes, edges }` to
  `http://localhost:8000/pipelines/parse`, with try/catch error handling (backend down
  → friendly error in the result card, no uncaught rejection).
- On success: **fire `window.alert()`** with a user-friendly formatted message
  (`Nodes: 4 · Edges: 3 · Valid DAG: Yes`) **and** show the styled `ResultCard`.

### 7.2 Backend (`main.py`)

- Replace the `GET` + `Form(...)` stub with a **`POST`** endpoint taking a Pydantic
  model: `Pipeline { nodes: list[Node], edges: list[Edge] }`.
- Compute `num_nodes = len(nodes)`, `num_edges = len(edges)`.
- `is_dag`: build adjacency from edges (`source -> target`) and run **Kahn's
  algorithm**; `is_dag = True` iff all nodes are removed (no cycle remains).
  - Empty graph → `True`. Self-loop → `False`. Parallel edges tolerated.
- Add **CORS middleware** allowing `http://localhost:3000` (required for the
  cross-port request).
- Response: `{ "num_nodes": int, "num_edges": int, "is_dag": bool }`.

---

## 8. State (`store.js`)

Keep zustand. Changes:

- **Fix the immutability bug:** the original `updateNodeField` mutates `node.data` in
  place then returns the same object. Replace with a version that returns **new node
  objects** so React/ReactFlow re-render reliably.
- **Orphaned-edge pruning:** when a node's data changes such that a handle disappears
  (Text variable removed), drop edges referencing the missing `sourceHandle`/
  `targetHandle`. Centralizing this in the store keeps nodes dumb.
- Add a small `removeNode` (also prunes its edges) for basic editor hygiene.
- Selectors stay `shallow`.

---

## 9. Risk Register & Bug Mitigations (8.5 → 10)

These are first-class design requirements, not afterthoughts.

### 9.1 ReactFlow stale handle positions (item 1) — **highest risk**

**Problem:** ReactFlow caches node internals (handle geometry). When the Text node
adds/removes handles or auto-resizes, edges attach to **stale** positions until ReactFlow
re-measures.

**Mitigation (no architecture change):** `BaseNode` calls
`updateNodeInternals(nodeId)` (from `useUpdateNodeInternals`) inside a `useEffect`
keyed on **(a)** the serialized handle list and **(b)** the node's measured size. Any
handle or size change triggers exactly one re-measure. Because every node renders
through `BaseNode`, this fix is **written once and covers all nodes** — including the 5
new ones — for free.

**Verification:** type `{{a}}`, connect an edge to it, then add `{{b}}`; the first
edge must stay visually attached to `a`. Resize via long text; existing edges must
track the moved handles.

### 9.2 Variable edge cases (item 2)

**Mitigation:** fully pinned in §6.3 and enforced in `parseVariables` (pure, unit-tested)
plus store-level orphan pruning (§8). No ambiguity left to implementation time.

### 9.3 No tests (item 3)

**Mitigation:** add focused unit tests for the two pieces with real logic:

- **Frontend** `parseVariables`: dedupe, invalid identifiers, whitespace, multiple
  vars, empty string. (Jest — already present via `react-scripts test`.)
- **Backend** DAG check: empty graph, simple chain (DAG), self-loop, 2-cycle,
  diamond (DAG), disconnected components. (pytest.)

Small surface, high signal — demonstrates testing instinct without scope creep.

### 9.4 Tailwind-on-CRA config risk (item 4)

**Mitigation:** pin **Tailwind v3 + CRACO** (v4 is Vite-first and fights CRA). Wire
`craco.config.js`, `tailwind.config.js`, `postcss.config.js`, and update the npm
scripts to use `craco`. **Verify the build first**, before feature work, so config
issues surface immediately, not late.

### 9.5 `alert()` grading gamble (item 5) — **decided**

**Mitigation:** ship **both** — native `alert()` (spec-literal) as the source of truth
and a styled `ResultCard` as enhancement. Zero grading risk; full polish. README notes
the dual approach.

### 9.6 Backend REST semantics (item 6)

**Mitigation:** endpoint becomes `POST /pipelines/parse` with a JSON body (§7.2).

### 9.7 Escape-hatch discipline (item 7)

**Mitigation:** at most one demo node (`Note`) uses `render()`; the other four are pure
config (§4.3).

---

## 10. Git Workflow

- Remove corrupt `frontend/.git`; `git init` at the root; private repo via `gh`.
- One short-lived feature branch per part, merged back to `main`:
  - `feat/node-abstraction`
  - `feat/styling`
  - `feat/text-node-logic`
  - `feat/backend-integration`
- Small, well-described commits per logical change so the history narrates the build.
- Optional PR per part for a review paper trail.

---

## 11. Build, Run & Verification Plan

**Run:**
- Frontend: `cd frontend && npm i && npm start` (CRACO-backed).
- Backend: `cd backend && uvicorn main:app --reload`.

**Drive the app (acceptance):**
1. Build passes after Tailwind/CRACO wiring (gate before feature work).
2. Drag each node type onto the canvas; all render via `BaseNode`.
3. Create a new node from a config in ~15 lines (demonstrate efficiency).
4. Text node: type prose → it grows; type `{{x}}`/`{{y}}` → two left handles appear;
   delete one → its handle and any connected edge disappear (no stale edge).
5. Connect nodes into a pipeline; click **Submit** → `alert()` + `ResultCard` show
   correct `num_nodes`/`num_edges`/`is_dag`.
6. Build a deliberate cycle → `is_dag: false`.
7. `parseVariables` + DAG unit tests pass.

---

## 12. Definition of Done

- All four parts function as specified.
- All seven risk-register items mitigated and verified.
- App runs cleanly via the documented commands; no console errors.
- Unit tests pass (frontend `parseVariables`, backend DAG).
- README documents setup, the abstraction, and the `alert()`+card decision.
- Clean commit history on a private GitHub monorepo.
