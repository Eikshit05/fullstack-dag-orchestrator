# VectorShift Pipeline Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a node-based pipeline editor (React/ReactFlow + FastAPI) satisfying all four parts of the VectorShift assessment: config-driven node abstraction, unified styling, text-node auto-resize + variable handles, and backend DAG integration.

**Architecture:** A single `BaseNode` renders every node from a declarative config (fields + handles), with function-valued fields/handles and a `render()` escape hatch for special cases. State lives in zustand. The backend exposes `POST /pipelines/parse` computing node/edge counts and a DAG check via Kahn's algorithm. Network boundaries use an env seam with local fallbacks.

**Tech Stack:** React 18 (Create React App / react-scripts 5), ReactFlow 11, zustand, Tailwind CSS v3 via CRACO, FastAPI + Pydantic v2, pytest, Jest (via react-scripts).

## Global Constraints

- Frontend: JavaScript/React. Backend: Python/FastAPI. (Spec requirement.)
- Tailwind **v3** wired via **CRACO** — never Tailwind v4 (Vite-first, fights CRA).
- Node abstraction is **config-driven**; of the 5 new demo nodes, **at most one** (`Note`) may use the `render()` escape hatch. The other four are pure config.
- Backend endpoint is **`POST /pipelines/parse`** returning exactly `{num_nodes: int, num_edges: int, is_dag: bool}`.
- Submit feedback: native `window.alert()` (deferred via `setTimeout(…, 0)`) **and** a styled `ResultCard`.
- `updateNodeInternals` effects key on a **primitive string** (joined handle ids), never an array reference.
- Variable recompute is **debounced (~300ms)**; the debounce is `.cancel()`-ed in `useEffect` cleanup.
- `ReactFlow` node `id` namespacing for handles: `${nodeId}-${handle.id}`; variable handles use `${nodeId}-var-${name}`.
- Env seam: frontend `REACT_APP_API_URL` (fallback `http://localhost:8000`); backend `CORS_ORIGINS` (fallback `http://localhost:3000`). Cloud deployment is out of scope.
- Commit per task. Use feature branches per part; merge to `main`.
- Working directory root: the monorepo root (contains `frontend/` and `backend/`).

---

## File Structure

**Created:**
- `frontend/craco.config.js`, `frontend/tailwind.config.js`, `frontend/postcss.config.js`, `frontend/.env.example`
- `frontend/src/nodes/BaseNode.jsx` — the single node renderer
- `frontend/src/nodes/createNodeComponent.js` — binds a config to BaseNode
- `frontend/src/nodes/fields/{index.js,TextField.jsx,TextAreaField.jsx,SelectField.jsx,NumberField.jsx,CheckboxField.jsx}`
- `frontend/src/nodes/configs/{index.js,input.js,output.js,llm.js,text.js,filter.js,math.js,http.js,conditional.js,note.js}`
- `frontend/src/nodes/TextNodeBody.jsx` — auto-resize textarea + mirror + variable handles
- `frontend/src/lib/{parseVariables.js,api.js}`
- `frontend/src/lib/parseVariables.test.js`
- `frontend/src/components/ResultCard.jsx`
- `frontend/src/styles/index.css`
- `backend/tests/test_dag.py`, `backend/requirements.txt`

**Modified:**
- `frontend/src/{store.js,ui.js,toolbar.js,submit.js,App.js,index.js,index.css}`
- `frontend/package.json` (scripts → craco; new deps)
- `backend/main.py`

---

## Task 1: Baseline scaffold import

**Files:**
- Modify: repository (commit the existing `frontend/` + `backend/` scaffold as the first code commit)

**Interfaces:**
- Consumes: nothing (first code task).
- Produces: a committed baseline so later diffs are reviewable.

- [ ] **Step 1: Confirm clean state and create the part branch**

```bash
cd <repo-root>
git status -s
git checkout -b feat/foundation
```

- [ ] **Step 2: Stage the scaffold (node_modules is gitignored)**

```bash
git add frontend backend
git status -s   # expect frontend/src/*, backend/main.py, package.json, public/*
```

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: import assessment scaffold (frontend + backend baseline)"
```

Expected: commit succeeds; `git ls-files frontend backend | head` lists source files, no `node_modules`.

---

## Task 2: Tailwind v3 + CRACO build gate

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/craco.config.js`, `frontend/postcss.config.js`, `frontend/tailwind.config.js`, `frontend/.env.example`
- Modify: `frontend/src/index.css`

**Interfaces:**
- Consumes: nothing.
- Produces: Tailwind utility classes + design tokens available app-wide; `npm start`/`npm run build` go through CRACO.

- [ ] **Step 1: Install deps**

```bash
cd frontend
npm i
npm i -D @craco/craco@^7 tailwindcss@^3 postcss@^8 autoprefixer@^10
```

- [ ] **Step 2: Point npm scripts at CRACO**

In `frontend/package.json`, change `scripts` to:

```json
"scripts": {
  "start": "craco start",
  "build": "craco build",
  "test": "craco test",
  "eject": "react-scripts eject"
}
```

- [ ] **Step 3: Create `frontend/craco.config.js`**

```js
module.exports = {
  style: {
    postcss: {
      plugins: [require('tailwindcss'), require('autoprefixer')],
    },
  },
};
```

- [ ] **Step 4: Create `frontend/postcss.config.js`**

```js
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 5: Create `frontend/tailwind.config.js` (design tokens)**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        canvas: '#f6f7fb',
        node: '#ffffff',
        accent: {
          io: '#2563eb',
          ai: '#7c3aed',
          logic: '#d97706',
          text: '#059669',
          neutral: '#64748b',
        },
      },
      borderRadius: { node: '12px' },
      boxShadow: { node: '0 2px 8px rgba(15,23,42,0.12)' },
      fontFamily: { sans: ['Inter', 'system-ui', 'sans-serif'] },
    },
  },
  plugins: [],
};
```

- [ ] **Step 6: Replace `frontend/src/index.css` with Tailwind directives + a probe**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  margin: 0;
  font-family: theme('fontFamily.sans');
  background: theme('colors.canvas');
}
```

- [ ] **Step 7: Add a temporary probe element to verify Tailwind compiles**

In `frontend/src/App.js`, temporarily wrap the return in a styled banner:

```jsx
<div className="p-2 text-white bg-accent-ai font-semibold">Tailwind OK</div>
```

- [ ] **Step 8: Create `frontend/.env.example`**

```bash
REACT_APP_API_URL=http://localhost:8000
```

- [ ] **Step 9: Run the build gate**

```bash
cd frontend
npm run build
```

Expected: `Compiled successfully`. If CRACO/Tailwind misconfigured, it fails here — fix before proceeding.

- [ ] **Step 10: Visually confirm dev server renders the probe (purple banner)**

```bash
npm start
```

Expected: app loads at `http://localhost:3000` with a purple "Tailwind OK" banner. Then stop the server and **remove the probe banner** from `App.js`.

- [ ] **Step 11: Commit**

```bash
cd <repo-root>
git add frontend/craco.config.js frontend/postcss.config.js frontend/tailwind.config.js \
        frontend/.env.example frontend/package.json frontend/package-lock.json frontend/src/index.css frontend/src/App.js
git commit -m "build: wire Tailwind v3 via CRACO with design tokens"
```

---

## Task 3: Field-renderer registry

**Files:**
- Create: `frontend/src/nodes/fields/{TextField.jsx,TextAreaField.jsx,SelectField.jsx,NumberField.jsx,CheckboxField.jsx,index.js}`

**Interfaces:**
- Consumes: nothing.
- Produces: `FIELD_COMPONENTS` — a map `kind -> Component`. Each field component has props `{ field, value, onChange }`, where `field = { name, label, kind, options?, default? }` and `onChange(newValue)`.

- [ ] **Step 1: Create `frontend/src/nodes/fields/TextField.jsx`**

```jsx
export function TextField({ field, value, onChange }) {
  return (
    <label className="vs-field">
      <span className="vs-field__label">{field.label}</span>
      <input
        className="vs-field__control"
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
```

- [ ] **Step 2: Create `frontend/src/nodes/fields/TextAreaField.jsx`**

```jsx
export function TextAreaField({ field, value, onChange }) {
  return (
    <label className="vs-field">
      <span className="vs-field__label">{field.label}</span>
      <textarea
        className="vs-field__control"
        rows={field.rows || 2}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
```

- [ ] **Step 3: Create `frontend/src/nodes/fields/SelectField.jsx`**

```jsx
export function SelectField({ field, value, onChange }) {
  return (
    <label className="vs-field">
      <span className="vs-field__label">{field.label}</span>
      <select
        className="vs-field__control"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {(field.options || []).map((opt) => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
    </label>
  );
}
```

- [ ] **Step 4: Create `frontend/src/nodes/fields/NumberField.jsx`**

```jsx
export function NumberField({ field, value, onChange }) {
  return (
    <label className="vs-field">
      <span className="vs-field__label">{field.label}</span>
      <input
        className="vs-field__control"
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
```

- [ ] **Step 5: Create `frontend/src/nodes/fields/CheckboxField.jsx`**

```jsx
export function CheckboxField({ field, value, onChange }) {
  return (
    <label className="vs-field vs-field--inline">
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="vs-field__label">{field.label}</span>
    </label>
  );
}
```

- [ ] **Step 6: Create `frontend/src/nodes/fields/index.js`**

```js
import { TextField } from './TextField';
import { TextAreaField } from './TextAreaField';
import { SelectField } from './SelectField';
import { NumberField } from './NumberField';
import { CheckboxField } from './CheckboxField';

export const FIELD_COMPONENTS = {
  text: TextField,
  textarea: TextAreaField,
  select: SelectField,
  number: NumberField,
  checkbox: CheckboxField,
};
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/nodes/fields
git commit -m "feat: add field-renderer registry for node abstraction"
```

---

## Task 4: BaseNode renderer

**Files:**
- Create: `frontend/src/nodes/BaseNode.jsx`, `frontend/src/nodes/createNodeComponent.js`

**Interfaces:**
- Consumes: `FIELD_COMPONENTS` (Task 3); `useStore` selector `updateNodeField(nodeId, fieldName, value)` (Task 6 — define a temporary inline fallback if running out of order, but Task 6 precedes usage in the app).
- Produces:
  - `BaseNode({ id, data, config })` — renders header, fields (or `config.render`), and handles.
  - `createNodeComponent(config)` → a component `(props) => <BaseNode {...props} config={config} />`.
  - Config shape: `{ type, title, category, fields?, handles?, render? }` where `fields`/`handles` are arrays **or** `(data) => array`. Handle = `{ id, type: 'source'|'target', position: 'left'|'right'|'top'|'bottom' }`.

- [ ] **Step 1: Create `frontend/src/nodes/BaseNode.jsx`**

```jsx
import { useEffect, useMemo } from 'react';
import { Handle, Position, useUpdateNodeInternals } from 'reactflow';
import { useStore } from '../store';
import { FIELD_COMPONENTS } from './fields';

const POSITION_MAP = {
  left: Position.Left,
  right: Position.Right,
  top: Position.Top,
  bottom: Position.Bottom,
};

const ACCENT = {
  io: 'border-accent-io',
  ai: 'border-accent-ai',
  logic: 'border-accent-logic',
  text: 'border-accent-text',
};

const resolve = (value, data) =>
  typeof value === 'function' ? value(data) : value || [];

export function BaseNode({ id, data, config }) {
  const updateNodeInternals = useUpdateNodeInternals();
  const updateNodeField = useStore((s) => s.updateNodeField);

  const fields = useMemo(() => resolve(config.fields, data), [config, data]);
  const handles = useMemo(() => resolve(config.handles, data), [config, data]);

  // Primitive key — never an array reference (prevents infinite re-render loop).
  const handleKey = handles
    .map((h) => `${h.type}:${h.position}:${h.id}`)
    .join('|');

  useEffect(() => {
    updateNodeInternals(id);
  }, [id, handleKey, updateNodeInternals]);

  // Group handles per side so multiples distribute evenly.
  const grouped = handles.reduce((acc, h) => {
    (acc[h.position] = acc[h.position] || []).push(h);
    return acc;
  }, {});

  const accent = ACCENT[config.category] || 'border-accent-neutral';

  return (
    <div className={`vs-node ${accent}`}>
      <div className="vs-node__header">{config.title}</div>
      <div className="vs-node__body">
        {config.render
          ? config.render({ id, data, updateNodeField })
          : fields.map((f) => {
              const Field = FIELD_COMPONENTS[f.kind];
              if (!Field) return null;
              return (
                <Field
                  key={f.name}
                  field={f}
                  value={data[f.name] ?? f.default ?? ''}
                  onChange={(v) => updateNodeField(id, f.name, v)}
                />
              );
            })}
      </div>
      {Object.entries(grouped).map(([side, list]) =>
        list.map((h, i) => (
          <Handle
            key={h.id}
            type={h.type}
            position={POSITION_MAP[side]}
            id={`${id}-${h.id}`}
            style={{ top: `${((i + 1) * 100) / (list.length + 1)}%` }}
          />
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/src/nodes/createNodeComponent.js`**

```js
import { BaseNode } from './BaseNode';

export const createNodeComponent = (config) => {
  const NodeComponent = (props) => <BaseNode {...props} config={config} />;
  NodeComponent.displayName = `Node(${config.type})`;
  return NodeComponent;
};
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/nodes/BaseNode.jsx frontend/src/nodes/createNodeComponent.js
git commit -m "feat: add BaseNode renderer with even handle distribution + safe re-measure"
```

---

## Task 5: Store cleanup (immutability, removeNode, handle sync)

**Files:**
- Modify: `frontend/src/store.js`

**Interfaces:**
- Consumes: existing zustand store actions.
- Produces:
  - `updateNodeField(nodeId, fieldName, value)` — immutable update (new node objects).
  - `removeNode(nodeId)` — removes node and its connected edges.
  - `syncNodeHandles(nodeId, validHandleIds)` — prunes edges on `nodeId` whose `sourceHandle`/`targetHandle` is not in `validHandleIds` (array of full handle ids).

- [ ] **Step 1: Replace `updateNodeField` with an immutable version**

In `frontend/src/store.js`, replace the existing `updateNodeField` with:

```js
    updateNodeField: (nodeId, fieldName, fieldValue) => {
      set({
        nodes: get().nodes.map((node) =>
          node.id === nodeId
            ? { ...node, data: { ...node.data, [fieldName]: fieldValue } }
            : node
        ),
      });
    },
```

- [ ] **Step 2: Add `removeNode` and `syncNodeHandles` to the store object**

```js
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
```

- [ ] **Step 3: Build to verify no syntax errors**

```bash
cd frontend && npm run build
```

Expected: `Compiled successfully` (BaseNode + store compile together).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/store.js
git commit -m "fix: immutable updateNodeField; add removeNode and syncNodeHandles"
```

---

## Task 6: Node configs (original 4) + dynamic registration

**Files:**
- Create: `frontend/src/nodes/configs/{input.js,output.js,llm.js,text.js,index.js}`
- Modify: `frontend/src/ui.js`, `frontend/src/toolbar.js`
- (Text node body is added in Task 11; for now `text.js` uses a simple textarea field.)

**Interfaces:**
- Consumes: `createNodeComponent` (Task 4).
- Produces: `NODE_CONFIGS` — map `type -> config`. `ui.js` derives `nodeTypes`; `toolbar.js` derives draggable chips.

- [ ] **Step 1: Create `frontend/src/nodes/configs/input.js`**

```js
export const inputConfig = {
  type: 'customInput',
  title: 'Input',
  category: 'io',
  fields: [
    { name: 'inputName', label: 'Name', kind: 'text', default: '' },
    { name: 'inputType', label: 'Type', kind: 'select', options: ['Text', 'File'], default: 'Text' },
  ],
  handles: [{ id: 'value', type: 'source', position: 'right' }],
};
```

- [ ] **Step 2: Create `frontend/src/nodes/configs/output.js`**

```js
export const outputConfig = {
  type: 'customOutput',
  title: 'Output',
  category: 'io',
  fields: [
    { name: 'outputName', label: 'Name', kind: 'text', default: '' },
    { name: 'outputType', label: 'Type', kind: 'select', options: ['Text', 'Image'], default: 'Text' },
  ],
  handles: [{ id: 'value', type: 'target', position: 'left' }],
};
```

- [ ] **Step 3: Create `frontend/src/nodes/configs/llm.js`**

```js
export const llmConfig = {
  type: 'llm',
  title: 'LLM',
  category: 'ai',
  fields: [
    { name: 'model', label: 'Model', kind: 'select', options: ['gpt-4o', 'claude-opus-4'], default: 'gpt-4o' },
  ],
  handles: [
    { id: 'system', type: 'target', position: 'left' },
    { id: 'prompt', type: 'target', position: 'left' },
    { id: 'response', type: 'source', position: 'right' },
  ],
};
```

- [ ] **Step 4: Create `frontend/src/nodes/configs/text.js` (interim — upgraded in Task 11)**

```js
export const textConfig = {
  type: 'text',
  title: 'Text',
  category: 'text',
  fields: [
    { name: 'text', label: 'Text', kind: 'textarea', default: '{{input}}' },
  ],
  handles: [{ id: 'output', type: 'source', position: 'right' }],
};
```

- [ ] **Step 5: Create `frontend/src/nodes/configs/index.js`**

```js
import { inputConfig } from './input';
import { outputConfig } from './output';
import { llmConfig } from './llm';
import { textConfig } from './text';

export const NODE_CONFIGS = {
  [inputConfig.type]: inputConfig,
  [llmConfig.type]: llmConfig,
  [outputConfig.type]: outputConfig,
  [textConfig.type]: textConfig,
};
```

- [ ] **Step 6: Rewrite `frontend/src/ui.js` node-type wiring**

Replace the four node imports and the `nodeTypes` object with:

```js
import { NODE_CONFIGS } from './nodes/configs';
import { createNodeComponent } from './nodes/createNodeComponent';

const nodeTypes = Object.fromEntries(
  Object.entries(NODE_CONFIGS).map(([type, cfg]) => [type, createNodeComponent(cfg)])
);
```

Leave the rest of `ui.js` (store selector, `onDrop`, `ReactFlow` JSX) unchanged. Also fix the wrapper width typo `width: '100wv'` → `width: '100%'`.

- [ ] **Step 7: Rewrite `frontend/src/toolbar.js` to derive chips from configs**

```js
import { DraggableNode } from './draggableNode';
import { NODE_CONFIGS } from './nodes/configs';

export const PipelineToolbar = () => (
  <div className="vs-toolbar">
    <div className="vs-toolbar__chips">
      {Object.values(NODE_CONFIGS).map((cfg) => (
        <DraggableNode key={cfg.type} type={cfg.type} label={cfg.title} />
      ))}
    </div>
  </div>
);
```

- [ ] **Step 8: Build and drive**

```bash
cd frontend && npm run build && npm start
```

Expected: app loads; dragging Input/LLM/Output/Text onto the canvas renders each via BaseNode with the correct fields and handles. Connect Input→LLM to confirm handles work. Stop server.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/nodes/configs frontend/src/ui.js frontend/src/toolbar.js
git commit -m "feat: render original 4 nodes from configs via dynamic registry"
```

---

## Task 7: Five new demo nodes

**Files:**
- Create: `frontend/src/nodes/configs/{filter.js,math.js,http.js,conditional.js,note.js}`
- Modify: `frontend/src/nodes/configs/index.js`

**Interfaces:**
- Consumes: config shape (Task 4).
- Produces: 5 new entries in `NODE_CONFIGS`. Only `note.js` uses `render()`.

- [ ] **Step 1: Create `frontend/src/nodes/configs/filter.js`**

```js
export const filterConfig = {
  type: 'filter',
  title: 'Filter',
  category: 'logic',
  fields: [
    { name: 'condition', label: 'Keep where', kind: 'text', default: '' },
    { name: 'mode', label: 'Mode', kind: 'select', options: ['Include', 'Exclude'], default: 'Include' },
  ],
  handles: [
    { id: 'in', type: 'target', position: 'left' },
    { id: 'out', type: 'source', position: 'right' },
  ],
};
```

- [ ] **Step 2: Create `frontend/src/nodes/configs/math.js`**

```js
export const mathConfig = {
  type: 'math',
  title: 'Math',
  category: 'logic',
  fields: [
    { name: 'operator', label: 'Operator', kind: 'select', options: ['+', '-', '×', '÷'], default: '+' },
  ],
  handles: [
    { id: 'a', type: 'target', position: 'left' },
    { id: 'b', type: 'target', position: 'left' },
    { id: 'result', type: 'source', position: 'right' },
  ],
};
```

- [ ] **Step 3: Create `frontend/src/nodes/configs/http.js`**

```js
export const httpConfig = {
  type: 'http',
  title: 'HTTP Request',
  category: 'io',
  fields: [
    { name: 'url', label: 'URL', kind: 'text', default: 'https://' },
    { name: 'method', label: 'Method', kind: 'select', options: ['GET', 'POST', 'PUT', 'DELETE'], default: 'GET' },
  ],
  handles: [{ id: 'response', type: 'source', position: 'right' }],
};
```

- [ ] **Step 4: Create `frontend/src/nodes/configs/conditional.js`**

```js
export const conditionalConfig = {
  type: 'conditional',
  title: 'Conditional',
  category: 'logic',
  fields: [
    { name: 'expression', label: 'If', kind: 'text', default: '' },
  ],
  handles: [
    { id: 'input', type: 'target', position: 'left' },
    { id: 'true', type: 'source', position: 'right' },
    { id: 'false', type: 'source', position: 'right' },
  ],
};
```

- [ ] **Step 5: Create `frontend/src/nodes/configs/note.js` (the one `render()` escape hatch)**

```js
export const noteConfig = {
  type: 'note',
  title: 'Note',
  category: 'neutral',
  // Escape hatch: a free-form node with no handles and custom body.
  render: ({ id, data, updateNodeField }) => (
    <textarea
      className="vs-note"
      placeholder="Write a note…"
      value={data.note ?? ''}
      onChange={(e) => updateNodeField(id, 'note', e.target.value)}
    />
  ),
  handles: [],
};
```

- [ ] **Step 6: Register the 5 new configs in `frontend/src/nodes/configs/index.js`**

```js
import { inputConfig } from './input';
import { outputConfig } from './output';
import { llmConfig } from './llm';
import { textConfig } from './text';
import { filterConfig } from './filter';
import { mathConfig } from './math';
import { httpConfig } from './http';
import { conditionalConfig } from './conditional';
import { noteConfig } from './note';

export const NODE_CONFIGS = {
  [inputConfig.type]: inputConfig,
  [llmConfig.type]: llmConfig,
  [outputConfig.type]: outputConfig,
  [textConfig.type]: textConfig,
  [filterConfig.type]: filterConfig,
  [mathConfig.type]: mathConfig,
  [httpConfig.type]: httpConfig,
  [conditionalConfig.type]: conditionalConfig,
  [noteConfig.type]: noteConfig,
};
```

- [ ] **Step 7: Build and drive**

```bash
cd frontend && npm run build && npm start
```

Expected: toolbar now shows 9 node types; each of the 5 new nodes drops and renders. The Math/Conditional nodes show multiple evenly-spaced handles; Note has no handles. Stop server.

- [ ] **Step 8: Commit + merge foundation/part-1 branch**

```bash
git add frontend/src/nodes/configs
git commit -m "feat: add 5 demo nodes (filter, math, http, conditional, note) as configs"
git checkout main && git merge --no-ff feat/foundation -m "merge: foundation + node abstraction (Part 1)"
```

---

## Task 8: Unified styling (Part 2)

**Files:**
- Create: `frontend/src/styles/index.css`
- Modify: `frontend/src/index.js` (import styles), `frontend/src/index.css` (component classes), `frontend/src/draggableNode.js`, `frontend/src/App.js`, `frontend/src/submit.js`

**Interfaces:**
- Consumes: Tailwind tokens (Task 2). Provides the `vs-*` classes referenced by BaseNode/fields/toolbar.

- [ ] **Step 1: New branch**

```bash
git checkout -b feat/styling
```

- [ ] **Step 2: Add component classes to `frontend/src/index.css` (after the `@tailwind` lines)**

```css
@layer components {
  .vs-node {
    @apply bg-node rounded-node shadow-node border-t-4 min-w-[220px] text-sm text-slate-700;
  }
  .vs-node__header {
    @apply px-3 py-2 font-semibold text-slate-800 border-b border-slate-100;
  }
  .vs-node__body { @apply p-3 flex flex-col gap-2; }
  .vs-field { @apply flex flex-col gap-1 text-xs; }
  .vs-field--inline { @apply flex-row items-center gap-2; }
  .vs-field__label { @apply text-slate-500; }
  .vs-field__control {
    @apply border border-slate-200 rounded-md px-2 py-1 text-sm outline-none
           focus:border-accent-io focus:ring-1 focus:ring-accent-io;
  }
  .vs-note {
    @apply w-44 h-20 p-2 text-sm bg-amber-50 border border-amber-200 rounded-md outline-none resize-none;
  }
  .vs-toolbar { @apply px-4 py-3 bg-white border-b border-slate-200; }
  .vs-toolbar__chips { @apply flex flex-wrap gap-2; }
  .vs-chip {
    @apply px-3 py-2 rounded-lg text-white text-sm font-medium cursor-grab select-none
           shadow-sm hover:brightness-110 active:cursor-grabbing;
  }
  .vs-submit-bar { @apply flex justify-center py-4 bg-canvas; }
  .vs-submit-btn {
    @apply px-6 py-2 rounded-lg bg-accent-ai text-white font-semibold shadow
           hover:brightness-110 active:scale-[0.98] transition;
  }
}
```

- [ ] **Step 3: Style the draggable chip — replace inline styles in `frontend/src/draggableNode.js`**

```js
export const DraggableNode = ({ type, label }) => {
  const onDragStart = (event, nodeType) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify({ nodeType }));
    event.dataTransfer.effectAllowed = 'move';
  };
  return (
    <div
      className="vs-chip bg-accent-neutral"
      onDragStart={(event) => onDragStart(event, type)}
      draggable
    >
      {label}
    </div>
  );
};
```

- [ ] **Step 4: Style the submit bar — replace `frontend/src/submit.js` button wrapper**

```js
export const SubmitButton = () => (
  <div className="vs-submit-bar">
    <button type="submit" className="vs-submit-btn">Submit</button>
  </div>
);
```

(Functional submit logic is added in Task 14.)

- [ ] **Step 5: Build and drive**

```bash
cd frontend && npm run build && npm start
```

Expected: cohesive look — white toolbar with colored chips, soft canvas, rounded shadowed nodes with category-colored top borders, styled inputs. Stop server.

- [ ] **Step 6: Commit + merge**

```bash
git add frontend/src/index.css frontend/src/draggableNode.js frontend/src/submit.js
git commit -m "style: unified design system for toolbar, nodes, fields, submit"
git checkout main && git merge --no-ff feat/styling -m "merge: unified styling (Part 2)"
```

---

## Task 9: parseVariables (Part 3 — pure function, TDD)

**Files:**
- Create: `frontend/src/lib/parseVariables.js`, `frontend/src/lib/parseVariables.test.js`

**Interfaces:**
- Produces: `parseVariables(text: string) => string[]` — ordered, unique, valid-identifier, non-reserved variable names from `{{ name }}` tokens.

- [ ] **Step 1: New branch + write the failing test**

```bash
git checkout -b feat/text-node-logic
```

Create `frontend/src/lib/parseVariables.test.js`:

```js
import { parseVariables } from './parseVariables';

test('extracts a single variable', () => {
  expect(parseVariables('{{input}}')).toEqual(['input']);
});
test('trims whitespace inside braces', () => {
  expect(parseVariables('{{  name  }}')).toEqual(['name']);
});
test('dedupes repeated variables, keeping first-seen order', () => {
  expect(parseVariables('{{b}} {{a}} {{b}}')).toEqual(['b', 'a']);
});
test('ignores reserved words', () => {
  expect(parseVariables('{{function}} {{return}} {{ok}}')).toEqual(['ok']);
});
test('ignores tokens that are not valid identifiers', () => {
  expect(parseVariables('{{1bad}} {{good}}')).toEqual(['good']);
});
test('supports $ and _ identifiers', () => {
  expect(parseVariables('{{_x}} {{$y}}')).toEqual(['_x', '$y']);
});
test('returns empty for empty or no-match input', () => {
  expect(parseVariables('')).toEqual([]);
  expect(parseVariables('no vars here')).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd frontend && CI=true npm test -- --testPathPattern=parseVariables
```

Expected: FAIL — `Cannot find module './parseVariables'`.

- [ ] **Step 3: Implement `frontend/src/lib/parseVariables.js`**

```js
const RESERVED = new Set([
  'abstract','arguments','await','boolean','break','byte','case','catch','char',
  'class','const','continue','debugger','default','delete','do','double','else',
  'enum','eval','export','extends','false','final','finally','float','for',
  'function','goto','if','implements','import','in','instanceof','int','interface',
  'let','long','native','new','null','package','private','protected','public',
  'return','short','static','super','switch','synchronized','this','throw','throws',
  'transient','true','try','typeof','var','void','volatile','while','with','yield',
]);

export function parseVariables(text) {
  if (!text) return [];
  const re = /\{\{\s*([A-Za-z_$][A-Za-z0-9_$]*)\s*\}\}/g;
  const seen = new Set();
  const result = [];
  for (const match of text.matchAll(re)) {
    const name = match[1];
    if (RESERVED.has(name) || seen.has(name)) continue;
    seen.add(name);
    result.push(name);
  }
  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd frontend && CI=true npm test -- --testPathPattern=parseVariables
```

Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/parseVariables.js frontend/src/lib/parseVariables.test.js
git commit -m "feat: parseVariables — ordered unique non-reserved {{var}} extraction"
```

---

## Task 10: Text node body — auto-resize + variable handles (Part 3)

**Files:**
- Create: `frontend/src/nodes/TextNodeBody.jsx`
- Modify: `frontend/src/nodes/configs/text.js`

**Interfaces:**
- Consumes: `parseVariables` (Task 9); store `updateNodeField`, `syncNodeHandles` (Task 5); `useUpdateNodeInternals`.
- Produces: an upgraded `textConfig` whose `handles` is a function of `data.text` (static `output` handle + one `var-<name>` target per variable) and whose body is `TextNodeBody` via `render()`.

- [ ] **Step 1: Create `frontend/src/nodes/TextNodeBody.jsx`**

```jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useReactFlow, useUpdateNodeInternals } from 'reactflow';
import { useStore } from '../store';
import { parseVariables } from '../lib/parseVariables';

const MIN_W = 200, MAX_W = 420, MIN_H = 48, MAX_H = 260;
const DEBOUNCE_MS = 300;

export function TextNodeBody({ id, data }) {
  const updateNodeField = useStore((s) => s.updateNodeField);
  const syncNodeHandles = useStore((s) => s.syncNodeHandles);
  const updateNodeInternals = useUpdateNodeInternals();

  const [text, setText] = useState(data.text ?? '{{input}}');
  const [size, setSize] = useState({ w: MIN_W, h: MIN_H });

  const mirrorRef = useRef(null);
  const rafRef = useRef(null);
  const debounceRef = useRef(null);

  // Hidden-mirror measurement, coalesced to one update per animation frame.
  useEffect(() => {
    const el = mirrorRef.current;
    if (!el) return;
    const measure = () => {
      const w = Math.min(MAX_W, Math.max(MIN_W, Math.ceil(el.scrollWidth) + 24));
      const h = Math.min(MAX_H, Math.max(MIN_H, Math.ceil(el.scrollHeight) + 16));
      setSize((prev) => (prev.w === w && prev.h === h ? prev : { w, h }));
    };
    const ro = new ResizeObserver(() => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(measure);
    });
    ro.observe(el);
    measure();
    return () => {
      ro.disconnect();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [text]);

  // Re-measure ReactFlow internals when the node size changes.
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, size.w, size.h, updateNodeInternals]);

  // Debounced commit of text → store, then prune orphaned variable edges.
  const onChange = (value) => {
    setText(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      updateNodeField(id, 'text', value);
      const vars = parseVariables(value);
      const valid = [`${id}-output`, ...vars.map((v) => `${id}-var-${v}`)];
      syncNodeHandles(id, valid);
    }, DEBOUNCE_MS);
  };

  // Cancel a pending debounce if the node unmounts mid-typing.
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return (
    <div style={{ width: size.w }}>
      <label className="vs-field">
        <span className="vs-field__label">Text</span>
        <textarea
          className="vs-field__control resize-none"
          style={{ height: size.h }}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <div
        ref={mirrorRef}
        aria-hidden
        style={{
          position: 'absolute',
          visibility: 'hidden',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          padding: '4px 8px',
          font: 'inherit',
          maxWidth: MAX_W,
          pointerEvents: 'none',
        }}
      >
        {text || ' '}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Upgrade `frontend/src/nodes/configs/text.js` to dynamic handles + custom body**

```js
import { TextNodeBody } from '../TextNodeBody';
import { parseVariables } from '../../lib/parseVariables';

export const textConfig = {
  type: 'text',
  title: 'Text',
  category: 'text',
  render: (props) => <TextNodeBody {...props} />,
  handles: (data) => [
    { id: 'output', type: 'source', position: 'right' },
    ...parseVariables(data.text ?? '{{input}}').map((name) => ({
      id: `var-${name}`,
      type: 'target',
      position: 'left',
    })),
  ],
};
```

- [ ] **Step 3: Build and drive (the key Part 3 acceptance)**

```bash
cd frontend && npm run build && npm start
```

Expected:
1. Drop a Text node; it shows the textarea.
2. Type a long line / multiple lines → the node grows in width and height, then stops at the max.
3. Type `{{a}}` → one left handle appears; add `{{b}}` → a second appears, evenly spaced.
4. Connect an edge to `a`'s handle, then add `{{c}}` → the edge to `a` stays visually attached (no stale position).
5. Delete `{{b}}` from the text → after ~300ms its handle disappears; any edge that targeted it is removed.
6. Rapidly type a typo and correct it within 300ms → no handle flicker, no lost edges.

Stop server.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/nodes/TextNodeBody.jsx frontend/src/nodes/configs/text.js
git commit -m "feat: text node auto-resize (mirror+RO) and live {{var}} handles"
git checkout main && git merge --no-ff feat/text-node-logic -m "merge: text node logic (Part 3)"
```

---

## Task 11: Backend DAG endpoint (Part 4 — TDD)

**Files:**
- Modify: `backend/main.py`
- Create: `backend/tests/test_dag.py`, `backend/requirements.txt`

**Interfaces:**
- Produces:
  - `is_dag(nodes, edges) -> bool` where `nodes` is a list of objects with `.id` and `edges` a list with `.source`/`.target`.
  - `POST /pipelines/parse` accepting `Pipeline{nodes:[{id}], edges:[{source,target}]}`, returning `{num_nodes, num_edges, is_dag}`; `422` on edges referencing unknown nodes.

- [ ] **Step 1: New branch + requirements**

```bash
git checkout -b feat/backend-integration
```

Create `backend/requirements.txt`:

```
fastapi
uvicorn
pydantic>=2
pytest
httpx
```

Install:

```bash
cd backend && pip install -r requirements.txt
```

- [ ] **Step 2: Write failing tests — `backend/tests/test_dag.py`**

```python
from main import is_dag, NodeModel, EdgeModel

def N(*ids):
    return [NodeModel(id=i) for i in ids]

def E(*pairs):
    return [EdgeModel(source=s, target=t) for s, t in pairs]

def test_empty_graph_is_dag():
    assert is_dag(N(), E()) is True

def test_simple_chain_is_dag():
    assert is_dag(N('a', 'b', 'c'), E(('a', 'b'), ('b', 'c'))) is True

def test_self_loop_is_not_dag():
    assert is_dag(N('a'), E(('a', 'a'))) is False

def test_two_cycle_is_not_dag():
    assert is_dag(N('a', 'b'), E(('a', 'b'), ('b', 'a'))) is False

def test_diamond_is_dag():
    assert is_dag(N('a', 'b', 'c', 'd'),
                  E(('a', 'b'), ('a', 'c'), ('b', 'd'), ('c', 'd'))) is True

def test_disconnected_components_is_dag():
    assert is_dag(N('a', 'b', 'c', 'd'), E(('a', 'b'), ('c', 'd'))) is True

def test_isolated_node_does_not_falsely_fail():
    assert is_dag(N('a', 'b', 'c'), E(('a', 'b'))) is True
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd backend && python -m pytest tests/test_dag.py -v
```

Expected: FAIL — `ImportError: cannot import name 'is_dag'`.

- [ ] **Step 4: Rewrite `backend/main.py`**

```python
import os
from collections import deque

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, model_validator

app = FastAPI()

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class NodeModel(BaseModel):
    id: str


class EdgeModel(BaseModel):
    source: str
    target: str


class Pipeline(BaseModel):
    nodes: list[NodeModel]
    edges: list[EdgeModel]

    @model_validator(mode="after")
    def edges_reference_existing_nodes(self):
        node_ids = {n.id for n in self.nodes}
        for e in self.edges:
            if e.source not in node_ids or e.target not in node_ids:
                raise ValueError(f"Edge references unknown node: {e.source} -> {e.target}")
        return self


def is_dag(nodes, edges) -> bool:
    node_ids = [n.id for n in nodes]
    indegree = {nid: 0 for nid in node_ids}
    adj = {nid: [] for nid in node_ids}
    for e in edges:
        # Defensive: ignore endpoints not present in nodes (validator already guards the API).
        if e.source not in adj or e.target not in indegree:
            continue
        adj[e.source].append(e.target)
        indegree[e.target] += 1
    queue = deque(nid for nid in node_ids if indegree[nid] == 0)
    visited = 0
    while queue:
        nid = queue.popleft()
        visited += 1
        for nxt in adj[nid]:
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                queue.append(nxt)
    return visited == len(node_ids)


@app.get("/")
def read_root():
    return {"Ping": "Pong"}


@app.post("/pipelines/parse")
def parse_pipeline(pipeline: Pipeline):
    return {
        "num_nodes": len(pipeline.nodes),
        "num_edges": len(pipeline.edges),
        "is_dag": is_dag(pipeline.nodes, pipeline.edges),
    }
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd backend && python -m pytest tests/test_dag.py -v
```

Expected: PASS — 7 tests.

- [ ] **Step 6: Smoke-test the endpoint**

```bash
cd backend && uvicorn main:app --reload &
sleep 2
curl -s -X POST http://localhost:8000/pipelines/parse \
  -H 'Content-Type: application/json' \
  -d '{"nodes":[{"id":"a"},{"id":"b"}],"edges":[{"source":"a","target":"b"}]}'
# expect: {"num_nodes":2,"num_edges":2... } -> actually num_edges:1, is_dag:true
kill %1
```

Expected: `{"num_nodes":2,"num_edges":1,"is_dag":true}`. A cyclic payload returns `is_dag:false`; an edge to a missing node returns HTTP `422`.

- [ ] **Step 7: Commit**

```bash
cd <repo-root>
git add backend/main.py backend/tests/test_dag.py backend/requirements.txt
git commit -m "feat: POST /pipelines/parse with Kahn DAG check + referential validation + CORS"
```

---

## Task 12: Frontend submit integration + ResultCard (Part 4)

**Files:**
- Create: `frontend/src/lib/api.js`, `frontend/src/components/ResultCard.jsx`
- Modify: `frontend/src/submit.js`, `frontend/src/App.js`

**Interfaces:**
- Consumes: store `nodes`/`edges`; backend `POST /pipelines/parse`.
- Produces: clicking Submit POSTs the pipeline, shows a `ResultCard` then a deferred `alert()`.

- [ ] **Step 1: Create `frontend/src/lib/api.js`**

```js
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
```

- [ ] **Step 2: Create `frontend/src/components/ResultCard.jsx`**

```jsx
export function ResultCard({ result, error, onClose }) {
  if (!result && !error) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/30 z-50">
      <div className="bg-white rounded-xl shadow-xl w-80 p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-slate-800">
            {error ? 'Submission Failed' : 'Pipeline Submitted'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">✕</button>
        </div>
        {error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between"><span>Nodes</span><span className="font-medium">{result.num_nodes}</span></li>
            <li className="flex justify-between"><span>Edges</span><span className="font-medium">{result.num_edges}</span></li>
            <li className="flex justify-between">
              <span>Valid DAG</span>
              <span className={`font-medium ${result.is_dag ? 'text-emerald-600' : 'text-red-600'}`}>
                {result.is_dag ? 'Yes' : 'No'}
              </span>
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Wire `frontend/src/submit.js`**

```js
import { useState } from 'react';
import { useStore } from './store';
import { shallow } from 'zustand/shallow';
import { parsePipeline } from './lib/api';
import { ResultCard } from './components/ResultCard';

const selector = (state) => ({ nodes: state.nodes, edges: state.edges });

export const SubmitButton = () => {
  const { nodes, edges } = useStore(selector, shallow);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const onSubmit = async () => {
    setError(null);
    setResult(null);
    try {
      const data = await parsePipeline(nodes, edges);
      setResult(data); // render the card first…
      const msg = `Nodes: ${data.num_nodes} · Edges: ${data.num_edges} · Valid DAG: ${data.is_dag ? 'Yes' : 'No'}`;
      setTimeout(() => window.alert(msg), 0); // …then the spec-required alert, after paint
    } catch (e) {
      setError('Could not reach the backend. Is it running on the configured URL?');
    }
  };

  return (
    <div className="vs-submit-bar">
      <button type="button" className="vs-submit-btn" onClick={onSubmit}>Submit</button>
      <ResultCard
        result={result}
        error={error}
        onClose={() => { setResult(null); setError(null); }}
      />
    </div>
  );
};
```

- [ ] **Step 4: Build and drive the full flow**

```bash
# Terminal 1
cd backend && uvicorn main:app --reload
# Terminal 2
cd frontend && npm start
```

Expected: build a pipeline (Input→LLM→Output), click **Submit** → `ResultCard` appears with correct counts and "Valid DAG: Yes", followed by a native `alert()` with the same data. Create a cycle (e.g. two text/LLM nodes feeding each other) → "Valid DAG: No". Stop the backend only → Submit shows the styled error. Stop servers.

- [ ] **Step 5: Commit + merge**

```bash
git add frontend/src/lib/api.js frontend/src/components/ResultCard.jsx frontend/src/submit.js
git commit -m "feat: submit pipeline to backend; ResultCard + deferred alert"
git checkout main && git merge --no-ff feat/backend-integration -m "merge: backend integration (Part 4)"
```

---

## Task 13: README + final verification + GitHub repo

**Files:**
- Create: `README.md`

**Interfaces:**
- Consumes: all prior work.
- Produces: documentation + a pushed private GitHub repo.

- [ ] **Step 1: Create `README.md`**

````markdown
# VectorShift Pipeline Builder

A node-based pipeline editor: React + ReactFlow frontend, FastAPI backend.

## Run

Backend:
```bash
cd backend && pip install -r requirements.txt && uvicorn main:app --reload
```
Frontend:
```bash
cd frontend && npm i && cp .env.example .env && npm start
```

## Architecture

- **Config-driven nodes:** every node is a declarative config in `src/nodes/configs/`
  rendered by a single `BaseNode`. `fields`/`handles` may be functions of node data; a
  `render()` escape hatch covers special cases (only `Note` uses it). Adding a node ≈ a
  small config file.
- **Text node:** auto-resizes via a hidden mirror + `ResizeObserver`; `{{variable}}`
  tokens become left-side input handles (debounced; orphaned edges pruned on removal).
- **Backend:** `POST /pipelines/parse` returns `{num_nodes, num_edges, is_dag}`; DAG via
  Kahn's algorithm; referential-integrity validated.

## Submit feedback

Per the assessment, Submit fires a native `window.alert()` with the results; a styled
`ResultCard` is shown as well for a user-friendly presentation.

## Tests
```bash
cd frontend && CI=true npm test      # parseVariables
cd backend && python -m pytest -v    # DAG check
```
````

- [ ] **Step 2: Full regression verification**

```bash
cd frontend && CI=true npm test -- --watchAll=false
cd ../backend && python -m pytest -v
cd ../frontend && npm run build
```

Expected: all tests pass; build compiles.

- [ ] **Step 3: Commit README**

```bash
cd <repo-root>
git add README.md
git commit -m "docs: add README (setup, architecture, submit-feedback rationale)"
```

- [ ] **Step 4: Install GitHub CLI and authenticate**

```bash
brew install gh
gh auth login
```

(User completes the interactive auth in their terminal via `! gh auth login` if needed.)

- [ ] **Step 5: Create the private repo and push**

```bash
cd <repo-root>
gh repo create vectorshift-assessment --private --source=. --remote=origin --push
git push -u origin main
```

Expected: repo created; `main` pushed with full commit history (spec → foundation → parts → docs).

- [ ] **Step 6: Confirm**

```bash
gh repo view --web
git log --oneline --graph -20
```

Expected: private repo online; history shows the per-part merge commits.

---

## Self-Review

**1. Spec coverage**

- Part 1 (abstraction + 5 nodes): Tasks 3–7. ✓
- Part 2 (styling): Task 8. ✓
- Part 3 (auto-resize + variable handles): Tasks 9–10. ✓
- Part 4 (submit + DAG + alert): Tasks 11–12. ✓
- Risk register §9.1 (re-measure): BaseNode Task 4 + TextNodeBody Task 10. ✓
- §6.1 mirror/RO + rAF throttle (items 8, 14): Task 10. ✓
- §6.2 reserved Set + debounce + memo (items 9, 13): Tasks 9, 10. ✓
- §7.2 referential validation + isolated-node in-degree (items 11, 3B): Task 11. ✓
- §7.1 deferred alert (item 12): Task 12. ✓
- §7.3 env seam (item 10): Tasks 2, 11, 12. ✓
- §8 immutable store + removeNode + syncNodeHandles + cancel cleanup (items 13, 15): Tasks 5, 10. ✓
- §9.4 Tailwind/CRACO gate: Task 2. ✓
- §10 git workflow: per-part branches throughout. ✓

**2. Placeholder scan:** No TBD/TODO; every code step shows complete code. ✓

**3. Type consistency:** `updateNodeField(nodeId, fieldName, value)`, `syncNodeHandles(nodeId, validHandleIds)`, `removeNode(nodeId)`, `parseVariables(text)`, `is_dag(nodes, edges)`, `parsePipeline(nodes, edges)` used consistently across tasks. Handle id namespacing `${id}-${handle.id}` (BaseNode) and `${id}-var-${name}` (text handles + syncNodeHandles valid list) match. ✓
