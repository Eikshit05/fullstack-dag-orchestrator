import os
from collections import deque

from fastapi import FastAPI, HTTPException
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
    """Return True iff the directed graph has no cycle (Kahn's algorithm)."""
    node_ids = [n.id for n in nodes]
    indegree = {nid: 0 for nid in node_ids}
    adj = {nid: [] for nid in node_ids}
    for e in edges:
        # Defensive: ignore endpoints not present in nodes (the API validates them).
        if e.source not in adj or e.target not in indegree:
            continue
        adj[e.source].append(e.target)
        indegree[e.target] += 1
    # Seed the queue with every in-degree-0 node, including isolated ones.
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


# ---------------------------------------------------------------------------
# Execution engine — POST /pipelines/run
# ---------------------------------------------------------------------------
# Richer models than the parse endpoint: execution needs each node's type/data
# and each edge's handles. Kept separate so the parse contract is untouched.


class RunNodeModel(BaseModel):
    id: str
    type: str | None = None
    data: dict = {}


class RunEdgeModel(BaseModel):
    source: str
    target: str
    sourceHandle: str | None = None
    targetHandle: str | None = None


class RunPipeline(BaseModel):
    nodes: list[RunNodeModel]
    edges: list[RunEdgeModel]


def topological_order(nodes, edges):
    """Kahn's algorithm returning execution order, or None if a cycle exists."""
    node_ids = [n.id for n in nodes]
    indegree = {nid: 0 for nid in node_ids}
    adj = {nid: [] for nid in node_ids}
    for e in edges:
        if e.source not in adj or e.target not in indegree:
            continue
        adj[e.source].append(e.target)
        indegree[e.target] += 1
    queue = deque(nid for nid in node_ids if indegree[nid] == 0)
    order = []
    while queue:
        nid = queue.popleft()
        order.append(nid)
        for nxt in adj[nid]:
            indegree[nxt] -= 1
            if indegree[nxt] == 0:
                queue.append(nxt)
    return order if len(order) == len(node_ids) else None


def _handle_suffix(node_id, handle):
    """`${nodeId}-${handleId}` -> `handleId` (e.g. 'text-1-var-name' -> 'var-name')."""
    if handle and handle.startswith(f"{node_id}-"):
        return handle[len(node_id) + 1:]
    return handle


def _input_by_suffix(ins, suffix, context):
    """Pull the upstream output feeding a specific handle (by its suffix)."""
    for handle, source in ins:
        if handle == suffix:
            return context.get(source, "")
    return None


def _to_number(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _apply_op(a, b, op):
    if op == "+":
        r = a + b
    elif op == "-":
        r = a - b
    elif op in ("×", "*"):
        r = a * b
    elif op in ("÷", "/"):
        r = a / b if b != 0 else 0.0
    else:
        r = 0.0
    # Render whole numbers without a trailing .0 (so 2 + 2 reads as "4").
    return str(int(r)) if r == int(r) else str(r)


def _run_llm(node, prompt, system):
    """Call OpenAI for an LLM node. Lazy-imports the SDK so the rest of the app
    (and the test suite) runs without `openai` installed or any key configured."""
    data = node.data or {}
    api_key = data.get("apiKey")
    model = data.get("model") or "gpt-4o-mini"
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail=f"Execution paused: add an OpenAI API key to node '{node.id}' to run the LLM step.",
        )
    try:
        from openai import OpenAI
    except ImportError:
        raise HTTPException(status_code=500, detail="The 'openai' package is not installed on the server.")
    messages = []
    if system:
        messages.append({"role": "system", "content": str(system)})
    messages.append({"role": "user", "content": str(prompt or "")})
    try:
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(model=model, messages=messages)
        return response.choices[0].message.content
    except HTTPException:
        raise
    except Exception as exc:  # network / auth / quota errors surface cleanly
        raise HTTPException(status_code=502, detail=f"OpenAI API error: {exc}")


@app.post("/pipelines/run")
def run_pipeline(pipeline: RunPipeline):
    order = topological_order(pipeline.nodes, pipeline.edges)
    if order is None:
        raise HTTPException(status_code=400, detail="Cycle detected — pipeline is not a DAG and cannot run.")

    nodes_by_id = {n.id: n for n in pipeline.nodes}

    # target node -> list of (incoming handle suffix, source node id)
    incoming = {}
    for e in pipeline.edges:
        suffix = _handle_suffix(e.target, e.targetHandle) if e.targetHandle else None
        incoming.setdefault(e.target, []).append((suffix, e.source))

    context = {}   # the "memory bus": node id -> its computed output
    outputs = {}   # output node label -> value (the user-facing result)

    for nid in order:
        node = nodes_by_id[nid]
        data = node.data or {}
        ins = incoming.get(nid, [])

        if node.type == "customInput":
            context[nid] = str(data.get("value", ""))

        elif node.type == "text":
            text = data.get("text", "")
            for suffix, source in ins:
                if suffix and suffix.startswith("var-"):
                    var = suffix[len("var-"):]
                    text = text.replace("{{" + var + "}}", str(context.get(source, "")))
            context[nid] = text

        elif node.type == "math":
            a = _to_number(_input_by_suffix(ins, "a", context))
            b = _to_number(_input_by_suffix(ins, "b", context))
            context[nid] = _apply_op(a, b, data.get("operator", "+"))

        elif node.type == "llm":
            prompt = _input_by_suffix(ins, "prompt", context)
            system = _input_by_suffix(ins, "system", context)
            context[nid] = _run_llm(node, prompt, system)

        elif node.type == "customOutput":
            value = _input_by_suffix(ins, "value", context)
            if value is None and ins:
                value = context.get(ins[0][1], "")
            context[nid] = value or ""
            outputs[data.get("outputName") or nid] = context[nid]

        else:
            # Unknown/passthrough node: forward its first input (or empty).
            context[nid] = context.get(ins[0][1], "") if ins else ""

    return {"status": "success", "outputs": outputs, "context": context}
