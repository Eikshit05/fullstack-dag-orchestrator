import html as html_lib
import json
import os
import re
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
    apiKeys: dict = {}  # one key per provider: {openai, anthropic, google}


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


def _resolve(context, source, source_suffix):
    """Read a source node's output. Most nodes store a single value; multi-output
    nodes (e.g. Extract Data) store a {handle_suffix: value} dict, so we pick the
    value produced on the specific source handle the edge connects from."""
    raw = context.get(source)
    if isinstance(raw, dict):
        return raw.get(source_suffix, "")
    return raw if raw is not None else ""


def _input_by_suffix(ins, target_suffix, context):
    """Pull the upstream value feeding a specific input handle (by its suffix)."""
    for t_suffix, source, s_suffix in ins:
        if t_suffix == target_suffix:
            return _resolve(context, source, s_suffix)
    return None


_SCRIPT_STYLE_RE = re.compile(r"<(script|style)\b[^>]*>.*?</\1>", re.DOTALL | re.IGNORECASE)
_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


def _strip_html(markup):
    """Reduce an HTML document to readable text: drop script/style, strip tags,
    unescape entities, collapse whitespace. Pure + unit-tested."""
    text = _SCRIPT_STYLE_RE.sub(" ", markup)
    text = _TAG_RE.sub(" ", text)
    text = _WS_RE.sub(" ", text)
    return html_lib.unescape(text).strip()


def _scrape_url(url):
    """Fetch a URL and return its readable text (JSON passes through verbatim)."""
    if not url or url.strip() in ("", "https://", "http://"):
        raise HTTPException(status_code=400, detail="Scrape node has no URL to fetch.")
    try:
        import httpx
    except ImportError:
        raise HTTPException(status_code=500, detail="The 'httpx' package is not installed on the server.")
    try:
        resp = httpx.get(
            url, timeout=10.0, follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (pipeline-scraper)"},
        )
        resp.raise_for_status()
    except HTTPException:
        raise
    except Exception as exc:  # DNS, timeout, HTTP error — surface cleanly
        raise HTTPException(status_code=502, detail=f"Scrape failed for {url}: {exc}")
    content_type = resp.headers.get("content-type", "")
    body = resp.text if "application/json" in content_type else _strip_html(resp.text)
    return body[:8000]  # cap payload so a huge page can't flood the graph


def _provider_and_key(node, api_keys):
    """An AI node's selected provider (lowercased) and the matching global key.
    Phase 1 wires OpenAI; Anthropic/Google are validated but routed in Phase 2."""
    provider = ((node.data or {}).get("provider") or "OpenAI").lower()
    key = (api_keys or {}).get(provider)
    return provider, key


PROVIDER_LABELS = {"openai": "OpenAI", "anthropic": "Anthropic", "google": "Google"}


def _require_ai(node, api_keys, action):
    """Shared guard for AI nodes: resolve provider + key, fail cleanly on an
    unknown provider, a missing key, or a malformed key."""
    provider, api_key = _provider_and_key(node, api_keys)
    label = PROVIDER_LABELS.get(provider, provider.title())
    if provider not in PROVIDERS:
        raise HTTPException(status_code=400, detail=f"Unknown provider '{provider}'.")
    if not api_key:
        raise HTTPException(
            status_code=400,
            detail=f"Execution paused: add your {label} API key in Settings (⚙️) to {action}.",
        )
    # A real key is short, plain ASCII. Reject pasted prose/garbage cleanly rather
    # than letting it blow up header encoding deep in the HTTP client.
    if not api_key.isascii() or len(api_key) > 300:
        raise HTTPException(
            status_code=400,
            detail=f"That {label} API key looks invalid (non-text characters or too long) — re-enter it in Settings (⚙️).",
        )
    return provider, api_key


_AUTH_SIGNS = (
    "invalid api key", "incorrect api key", "api key not valid",
    "authentication", "unauthenticated", "permission denied", "401",
)


def _is_auth_error(exc):
    """True when a provider rejected the key. Works across SDKs: OpenAI/Anthropic
    errors expose .status_code; Google raises message-only errors, so we also
    sniff the text."""
    if getattr(exc, "status_code", None) in (401, 403):
        return True
    msg = str(exc).lower()
    return any(sign in msg for sign in _AUTH_SIGNS)


def _ai_http_error(provider, exc, kind="API"):
    """Map an adapter exception to a clean HTTP error: missing SDK -> 500,
    rejected key -> friendly 401, anything else -> 502."""
    label = PROVIDER_LABELS.get(provider, provider.title())
    if isinstance(exc, ImportError):
        return HTTPException(status_code=500, detail=f"The {label} SDK isn't installed on the server ({exc}).")
    if _is_auth_error(exc):
        return HTTPException(
            status_code=401,
            detail=f"Your {label} API key was rejected — double-check it's a valid {label} key in Settings (⚙️).",
        )
    return HTTPException(status_code=502, detail=f"{label} {kind} error: {exc}")


def _run_llm(node, prompt, system, api_keys=None):
    """Route an LLM node to its selected provider's chat adapter."""
    provider, api_key = _require_ai(node, api_keys, "run the LLM step")
    model = (node.data or {}).get("model") or DEFAULT_MODELS[provider]
    try:
        return PROVIDERS[provider]["chat"](api_key, model, system, prompt)
    except HTTPException:
        raise
    except Exception as exc:  # missing SDK / rejected key / network — classified
        raise _ai_http_error(provider, exc, "API")


_SCHEMA_TYPE_MAP = {"Text": "string", "Decimal": "number", "Boolean": "boolean", "List": "array"}


def build_extract_schema(fields):
    """Turn the node's schema rows into a strict JSON Schema object for the LLM's
    structured-output mode. Pure + unit-tested."""
    properties = {}
    required = []
    for f in fields:
        name = (f or {}).get("name")
        if not name:
            continue
        json_type = _SCHEMA_TYPE_MAP.get(f.get("type"), "string")
        prop = {"type": json_type}
        if json_type == "array":
            prop["items"] = {"type": "string"}
        if f.get("description"):
            prop["description"] = f["description"]
        properties[name] = prop
        required.append(name)
    return {
        "type": "object",
        "properties": properties,
        "required": required,
        "additionalProperties": False,
    }


_GEMINI_TYPES = {
    "string": "STRING", "number": "NUMBER", "integer": "INTEGER",
    "boolean": "BOOLEAN", "array": "ARRAY", "object": "OBJECT",
}


def _to_gemini_schema(schema):
    """Translate our JSON Schema to Gemini's OpenAPI-subset (uppercase type names,
    no additionalProperties). Pure + unit-tested."""
    if not isinstance(schema, dict):
        return schema
    out = {}
    if "type" in schema:
        out["type"] = _GEMINI_TYPES.get(schema["type"], str(schema["type"]).upper())
    if "description" in schema:
        out["description"] = schema["description"]
    if "properties" in schema:
        out["properties"] = {k: _to_gemini_schema(v) for k, v in schema["properties"].items()}
    if "items" in schema:
        out["items"] = _to_gemini_schema(schema["items"])
    if schema.get("required"):
        out["required"] = list(schema["required"])
    return out


# --- Provider adapters -----------------------------------------------------
# Each provider exposes the same two functions; SDKs are lazy-imported so the app
# and tests run without them installed. Structured output differs per provider:
# OpenAI uses response_format json_schema, Anthropic forces a tool call, Gemini
# uses response_schema.

EXTRACT_SYS = (
    "Extract the requested fields from the user's text. "
    "If a field is not present, use a sensible empty value."
)


def _openai_chat(api_key, model, system, prompt):
    from openai import OpenAI
    client = OpenAI(api_key=api_key)
    messages = []
    if system:
        messages.append({"role": "system", "content": str(system)})
    messages.append({"role": "user", "content": str(prompt or "")})
    resp = client.chat.completions.create(model=model, messages=messages)
    return resp.choices[0].message.content


def _openai_structured(api_key, model, system, user, schema, schema_name="result"):
    """OpenAI structured output via native response_format json_schema."""
    from openai import OpenAI
    client = OpenAI(api_key=api_key)
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "system", "content": str(system)}, {"role": "user", "content": str(user)}],
        response_format={"type": "json_schema", "json_schema": {"name": schema_name, "schema": schema, "strict": True}},
    )
    return json.loads(resp.choices[0].message.content)


def _openai_extract(api_key, model, text, schema):
    return _openai_structured(api_key, model, EXTRACT_SYS, text, schema, "extraction")


def _anthropic_chat(api_key, model, system, prompt):
    import anthropic
    client = anthropic.Anthropic(api_key=api_key)
    kwargs = {"model": model, "max_tokens": 2048, "messages": [{"role": "user", "content": str(prompt or "")}]}
    if system:
        kwargs["system"] = str(system)
    resp = client.messages.create(**kwargs)
    return "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")


def _anthropic_structured(api_key, model, system, user, schema, schema_name="result"):
    """Anthropic structured output: no json_schema param, so force a tool call
    whose input_schema is our schema and read the tool input back."""
    import anthropic
    client = anthropic.Anthropic(api_key=api_key)
    kwargs = {
        "model": model,
        "max_tokens": 2048,
        "tools": [{"name": schema_name, "description": "Return the structured result.", "input_schema": schema}],
        "tool_choice": {"type": "tool", "name": schema_name},
        "messages": [{"role": "user", "content": str(user)}],
    }
    if system:
        kwargs["system"] = str(system)
    resp = client.messages.create(**kwargs)
    for block in resp.content:
        if getattr(block, "type", None) == "tool_use":
            return block.input
    return {}


def _anthropic_extract(api_key, model, text, schema):
    return _anthropic_structured(api_key, model, EXTRACT_SYS, text, schema, "extract")


def _google_chat(api_key, model, system, prompt):
    import google.generativeai as genai
    genai.configure(api_key=api_key)
    gm = genai.GenerativeModel(model, system_instruction=str(system) if system else None)
    return gm.generate_content(str(prompt or "")).text


def _google_structured(api_key, model, system, user, schema, schema_name="result"):
    """Gemini structured output via response_schema (OpenAPI-subset)."""
    import google.generativeai as genai
    genai.configure(api_key=api_key)
    gm = genai.GenerativeModel(model, system_instruction=str(system) if system else None)
    resp = gm.generate_content(
        str(user),
        generation_config={"response_mime_type": "application/json", "response_schema": _to_gemini_schema(schema)},
    )
    return json.loads(resp.text)


def _google_extract(api_key, model, text, schema):
    return _google_structured(api_key, model, EXTRACT_SYS, text, schema, "extraction")


PROVIDERS = {
    "openai": {"chat": _openai_chat, "extract": _openai_extract},
    "anthropic": {"chat": _anthropic_chat, "extract": _anthropic_extract},
    "google": {"chat": _google_chat, "extract": _google_extract},
}

# Shared structured-output layer, reused by Extract and the Explain agent.
STRUCTURED = {
    "openai": _openai_structured,
    "anthropic": _anthropic_structured,
    "google": _google_structured,
}

DEFAULT_MODELS = {
    "openai": "gpt-4o-mini",
    "anthropic": "claude-sonnet-4-6",
    "google": "gemini-3.5-flash",
}


def _run_extract(node, text, api_keys=None):
    """Extract Data executor: build a JSON Schema from the node's fields, call the
    LLM in structured-output mode, and return a {field-<name>: value} dict so each
    value lands on its own typed output handle. BYOK, lazy OpenAI import."""
    data = node.data or {}
    fields = data.get("fields") or []
    if not fields:
        raise HTTPException(status_code=400, detail=f"Extract node '{node.id}' has no schema fields defined.")
    provider, api_key = _require_ai(node, api_keys, "run extraction")
    model = data.get("model") or DEFAULT_MODELS[provider]
    schema = build_extract_schema(fields)
    try:
        parsed = PROVIDERS[provider]["extract"](api_key, model, text, schema)
    except HTTPException:
        raise
    except Exception as exc:  # missing SDK / rejected key / parse — classified
        raise _ai_http_error(provider, exc, "extraction")
    # Push each extracted value onto its corresponding output handle.
    out = {}
    for f in fields:
        name = (f or {}).get("name")
        if name:
            out[f"field-{name}"] = parsed.get(name, "")
    return out


@app.post("/pipelines/run")
def run_pipeline(pipeline: RunPipeline):
    order = topological_order(pipeline.nodes, pipeline.edges)
    if order is None:
        raise HTTPException(status_code=400, detail="Cycle detected — pipeline is not a DAG and cannot run.")

    nodes_by_id = {n.id: n for n in pipeline.nodes}

    # target node -> list of (target handle suffix, source node id, source handle suffix)
    incoming = {}
    for e in pipeline.edges:
        t_suffix = _handle_suffix(e.target, e.targetHandle) if e.targetHandle else None
        s_suffix = _handle_suffix(e.source, e.sourceHandle) if e.sourceHandle else None
        incoming.setdefault(e.target, []).append((t_suffix, e.source, s_suffix))

    context = {}   # the "memory bus": node id -> value, or {handle: value} for multi-output
    outputs = {}   # output node label -> value (the user-facing result)

    for nid in order:
        node = nodes_by_id[nid]
        data = node.data or {}
        ins = incoming.get(nid, [])

        if node.type == "customInput":
            context[nid] = str(data.get("value", ""))

        elif node.type == "text":
            text = data.get("text", "")
            for t_suffix, source, s_suffix in ins:
                if t_suffix and t_suffix.startswith("var-"):
                    var = t_suffix[len("var-"):]
                    text = text.replace("{{" + var + "}}", str(_resolve(context, source, s_suffix)))
            context[nid] = text

        elif node.type == "scrape":
            url = _input_by_suffix(ins, "url", context) or data.get("url")
            context[nid] = _scrape_url(url)

        elif node.type == "llm":
            prompt = _input_by_suffix(ins, "prompt", context)
            system = _input_by_suffix(ins, "system", context)
            context[nid] = _run_llm(node, prompt, system, pipeline.apiKeys)

        elif node.type == "extract":
            text = _input_by_suffix(ins, "context", context) or ""
            context[nid] = _run_extract(node, text, pipeline.apiKeys)  # {f"field-{name}": value}

        elif node.type == "customOutput":
            value = _input_by_suffix(ins, "value", context)
            if value is None and ins:
                value = _resolve(context, ins[0][1], ins[0][2])
            context[nid] = "" if value is None else value
            outputs[data.get("outputName") or nid] = context[nid]

        else:
            # Unknown/passthrough node: forward its first input (or empty).
            context[nid] = _resolve(context, ins[0][1], ins[0][2]) if ins else ""

    return {"status": "success", "outputs": outputs, "context": context}


# ---------------------------------------------------------------------------
# Observability — POST /pipelines/explain
# ---------------------------------------------------------------------------
# A post-run "explain this run" agent: reads the execution log (the memory bus
# the run already produced) and narrates, in plain English, what each node did.


class ExplainPipeline(BaseModel):
    nodes: list[RunNodeModel]
    edges: list[RunEdgeModel]
    context: dict = {}      # the memory bus returned by /pipelines/run
    apiKeys: dict = {}


EXPLAIN_SYS = (
    "You are a technical observability agent. You are given the JSON execution "
    "graph of an AI pipeline and the actual data (context) each node produced "
    "during its run. Read this log and explain, plainly, what just happened.\n"
    "Return JSON with:\n"
    "1. \"summary\": one concise paragraph of plain English describing what the "
    "whole pipeline accomplished, grounded in the real data produced.\n"
    "2. \"steps\": an array, one object per node in execution order, each with "
    "\"node_id\" and \"action\" — a single clear sentence on what that node did "
    "(e.g. \"Scraped the résumé document and extracted ~8k characters of text.\")."
)

EXPLAIN_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "steps": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "node_id": {"type": "string"},
                    "action": {"type": "string"},
                },
                "required": ["node_id", "action"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["summary", "steps"],
    "additionalProperties": False,
}

_EXPLAIN_CONFIG_KEYS = ("inputName", "value", "inputType", "url", "text", "provider", "model", "outputName", "fields")

# The explainer auto-picks whichever key is in the vault, in this strict order.
_EXPLAIN_PRIORITY = ("openai", "anthropic", "google")


def resolve_explainer_provider(api_keys):
    """First available provider key, by priority. The explainer is provider-agnostic
    so a user on any one of the three can narrate a run."""
    for provider in _EXPLAIN_PRIORITY:
        if (api_keys or {}).get(provider):
            return provider
    raise HTTPException(
        status_code=400,
        detail="No API key found — add an OpenAI, Anthropic, or Google key in Settings (⚙️) to explain a run.",
    )


def _explain_payload(nodes, edges, context):
    """A compact, execution-ordered description of the run for the explainer:
    each node's type, key config, and what it produced (lightly capped)."""
    order = topological_order(nodes, edges) or [n.id for n in nodes]
    by_id = {n.id: n for n in nodes}
    lines = []
    for nid in order:
        node = by_id.get(nid)
        if not node:
            continue
        cfg = {k: v for k, v in (node.data or {}).items() if k in _EXPLAIN_CONFIG_KEYS}
        out = context.get(nid, "")
        out_str = out if isinstance(out, str) else json.dumps(out)
        lines.append(
            f"NODE {nid} (type={node.type})\n  config: {json.dumps(cfg)[:600]}\n  output: {out_str[:3000]}"
        )
    return "EXECUTION LOG (in run order):\n\n" + "\n\n".join(lines)


@app.post("/pipelines/explain")
def explain_pipeline(pipeline: ExplainPipeline):
    provider = resolve_explainer_provider(pipeline.apiKeys)
    api_key = pipeline.apiKeys[provider]
    label = PROVIDER_LABELS.get(provider, provider.title())
    if not api_key.isascii() or len(api_key) > 300:
        raise HTTPException(status_code=400, detail=f"That {label} API key looks invalid — re-enter it in Settings (⚙️).")
    user = _explain_payload(pipeline.nodes, pipeline.edges, pipeline.context)
    try:
        result = STRUCTURED[provider](api_key, DEFAULT_MODELS[provider], EXPLAIN_SYS, user, EXPLAIN_SCHEMA, "run_explanation")
    except Exception as exc:  # rejected key / network — classified like the run path
        raise _ai_http_error(provider, exc, "explain")
    return {"summary": result.get("summary", ""), "steps": result.get("steps", [])}
