# Fullstack DAG Orchestrator — Visual AI Pipeline Engine

[![CI](https://github.com/Eikshit05/fullstack-dag-orchestrator/actions/workflows/ci.yml/badge.svg)](https://github.com/Eikshit05/fullstack-dag-orchestrator/actions/workflows/ci.yml)

A node-based, **executable** AI pipeline builder — **React + ReactFlow** on the front, **FastAPI** on the back. You wire up a graph on a canvas and actually **run** it: ingest live data, reason with an LLM, force the result into a typed schema, and deliver structured output.

It began as the VectorShift frontend technical assessment (config-driven node abstraction, styling, the text node's `{{variable}}` handles, and a `/pipelines/parse` DAG check) and was then evolved into a **specialized AI orchestration engine** with a live execution backend and per-node multi-provider routing.

**Author:** Eikshit Singhal

> **The flagship flow** — an "Investment Committee analyst" pipeline:
> ```
> Scrape URL ─┐
>             ├─► Text (prompt) ─► LLM ─► Extract Data ─┬─► company
> Input ──────┘                                          ├─► segments (List)
>                                                         └─► risks   (List)
> ```
> Ingest → reason → structure → deliver, end-to-end, with live OpenAI calls.

---

## 🚀 Quick Start

**Prerequisites:** Node.js 18+, Python 3.10+

### 1. Backend
```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt   # includes openai + httpx for execution
uvicorn main:app --reload
```
API at `http://localhost:8000`.

### 2. Frontend (new terminal)
```bash
cd frontend
npm install
npm start
```
App at `http://localhost:3000`. (`npm start` runs a `prestart` hook that compiles Tailwind via its CLI — see *Styling Pipeline*.)

### 3. Run a live pipeline
Open **⚙️ Keys** in the toolbar, paste an **OpenAI** key (stored only in your browser), wire `Scrape/Input → Text → LLM → Extract → Output`, and hit **Run Pipeline**.

---

## 🧩 The Nodes (6)

| Node | Role | Notes |
| --- | --- | --- |
| **Input** | Inject a typed value (`Text` / `Number` / `Boolean` / `JSON`) | The chosen type flows onto its output handle |
| **Text** | Prompt template with `{{variable}}` interpolation | Each `{{var}}` spawns a left input handle dynamically |
| **Scrape URL** | Fetch a page → readable text | `httpx`, 10s timeout, zero-dep HTML→text, 8k cap |
| **LLM** | Generative step | Per-node **Provider → Model** selection |
| **Extract Data** | Force unstructured text into a typed schema | Schema builder → one **typed output handle per field** via LLM structured output |
| **Output** | Terminal sink, captures a value | — |

---

## 🏗️ Architecture & Technical Decisions

### 1. Config-Driven Node Abstraction
Every node is declarative data (`src/nodes/configs/*.js`) rendered by a single `BaseNode`. Adding a node is a config file, not a component.

* **Field registry** (`src/nodes/fields/`): fields map to a renderer by `kind` — `text`, `select`, **`schema`** (the Extract schema builder), **`providerModel`** (the compound provider→model selector). New input types = one registry entry.
* **Dynamic handles**: `handles` can be a function of node data — the Text node grows a handle per `{{variable}}`; the Extract node grows a typed handle per schema row.
* **Escape hatch**: a config may supply `render()` for a fully custom body (the Text node delegates to `TextNodeBody` for auto-resize + variable parsing).

### 2. A Real Type System
Handles carry a `dataType` (`Text` / `Number` / `Boolean` / `JSON` / `Any`). Validity is enforced at **two layers**:

* **Connection-time (hard block):** `onConnect` rejects incompatible wires — same type, or either side `Any`, or the target is `Text` (everything safely widens to text); a Text→Number wire is refused with a toast.
* **Execution-time (runtime guard):** even when `Any` lets a value through, executors validate at the node and fail loudly rather than silently coercing.

### 3. The Execution Engine — `POST /pipelines/run`
The backend turns the graph into a running computation:

* **Topological order** via Kahn's algorithm (reused from the DAG check); a cycle returns `400` before anything runs.
* **A "memory bus"** maps each node to its output. Multi-output nodes (Extract Data) store a `{handle: value}` dict, so distinct typed values fan out to distinct downstream nodes.
* **Per-node executors**: `customInput`, `text` (interpolation), `scrape` (live fetch), `llm`, `extract` (structured output), `customOutput`.

### 4. Multi-Provider, Node-Level Routing
Each AI node picks its own brain — cheap model for triage, a heavier one for synthesis — all in one graph.

* **Provider → Model on the node** (pipeline logic, exported with the graph): a `providerModel` compound field; the model list follows the provider and resets to a valid option on change.
* **Keys are global, not per-node** (credentials): one key per provider in the **⚙️ Settings** vault, persisted to `localStorage`, injected into the run payload only at execution time — **never written into a node**, so they can't leak through Export.
* **Backend:** a provider-adapter registry (`PROVIDERS`) — each provider exposes `chat()` and `extract()`, dispatched by the node's selected provider. SDKs are lazy-imported; errors normalize to clean `400/502`. Structured output is per-provider: OpenAI `response_format`, Anthropic forced tool-use, Google `response_schema`. OpenAI is verified live end-to-end; Anthropic and Google are wired and unit-routed (live calls need those keys).

### 5. Scrape URL & Extract Data
* **Scrape:** `httpx.get` with timeout + redirects; JSON passes through, otherwise a regex stripper reduces HTML to text (no BeautifulSoup). DNS/timeout/HTTP errors → clean `502`.
* **Extract:** builds a strict **JSON Schema** from the schema-builder rows and calls the model in structured-output mode (`response_format: json_schema`), then pushes each value to its `field-<name>` handle. Type map: `Decimal→number`, `List→array`, `Boolean→boolean`, `Text→string`.

### 6. DAG Validation — `POST /pipelines/parse`
The original assessment endpoint, intact: returns `{num_nodes, num_edges, is_dag}` (Kahn's, seeding all in-degree-0 nodes so isolated/disconnected nodes don't false-trigger), with a Pydantic validator rejecting edges to unknown nodes (`422`). **Submit** shows the result in a styled card.

### 7. Observability — "Explain this run" (`POST /pipelines/explain`)
After a successful run, an on-demand **✨ Explain this run** button turns the black box into a glass box. It feeds the graph **plus the actual execution log** — the memory-bus `context` the run already returned — to an LLM (structured output) and gets back a plain-English **summary** + an execution-ordered, per-node **play-by-play** (*"Scraped the page… used a language model to summarize… produced the final output"*).

* **Provider-agnostic** — the explainer auto-picks whichever key is in the vault by a deterministic priority (OpenAI → Anthropic → Google) and narrates via that provider's default model through the shared `STRUCTURED` layer that Extract uses. A user on *any single* provider gets a working explanation — no OpenAI required.
* **Grounded, not generic** — it narrates the *real* outputs each node produced this run, not a hypothetical description of the diagram. This mirrors VectorShift's enterprise pitch: every result traceable back to the step that produced it.
* **No truncation engineering needed** — the Scrape node's 8 KB cap keeps the whole context naturally bounded, so the raw log fits the model's window by design.
* **On-demand** keeps the core Run loop fast and avoids a second model call on every execution.

---

## 🔐 Security

* **API keys never touch the graph** — held in the store + `localStorage`, sent top-level at run time only, and stripped from exports by `sanitizeNodesForExport` as defense-in-depth.
* **Malformed-key guard** — a non-ASCII or absurdly long value pasted into a key field is rejected with a clear `400` instead of crashing the HTTP client.

---

## ✨ Canvas UX

| Feature | How |
| --- | --- |
| **Command palette** | `⌘K` / `Ctrl+K` — searchable node add, dropped at viewport center |
| **Copy / paste** | `⌘C` / `⌘V` — duplicates the selection *and* the edges between them (handles remapped), focus-guarded so it never hijacks text editing |
| **Delete** | `✕` button per node (focus-independent) or `Backspace`/`Delete` |
| **Live cycle validation** | Edges that form a cycle render red + dashed instantly; clears itself when broken (derived, never mutates store edges) |
| **Export / Import** | Download/round-trip the pipeline as JSON (keys scrubbed; id counter rebuilt on import) |

---

## ⚙️ Tooling

### Styling Pipeline
`react-scripts@5` silently drops external PostCSS plugins (the CRACO trap), so Tailwind is **precompiled via its own CLI**: `src/styles/index.css` → `src/styles/tailwind-out.css` (gitignored) before Webpack, wired through `prestart` + `concurrently`. Standard `npm start` / `npm run build` work unchanged.

### Environment
* **Frontend:** copy `frontend/.env.example` → `frontend/.env` to override `REACT_APP_API_URL`.
* **Backend:** `CORS_ORIGINS` (comma-separated) to authorize external frontends.

---

## 🧪 Testing

**33 backend + 48 frontend**, run on every push via GitHub Actions.

* **Backend (pytest):** DAG algorithm (cycles, diamonds, isolated nodes), referential integrity, the execution engine (interpolation, scrape HTML-stripping, Extract JSON-schema build, Gemini schema translation), multi-provider routing (mocked adapters), friendly auth-error / malformed-key / missing-key guards, and the provider-agnostic explain endpoint (provider selection + narration).
* **Frontend (jest):** variable parsing, store mechanics (immutable updates, edge pruning, import counter, copy/paste rewiring), type-compatibility rules, Extract dynamic handles, export sanitization, the submit flow.

```bash
# frontend
cd frontend && CI=true npm test -- --watchAll=false
# backend
cd backend && source .venv/bin/activate && python -m pytest -v
```

---

## 🗺️ Roadmap

* **Multi-SDK backend — done:** Anthropic (`anthropic`) and Google (`google-generativeai`) are wired alongside OpenAI via the adapter registry, each with its own structured-output mechanism. OpenAI is verified live; the other two need their respective keys to exercise end-to-end.
* Optional next: a "reader mode" for Scrape (Jina Reader), persisted pipelines, and live validation of the Anthropic/Google paths.
