from fastapi.testclient import TestClient

import main
from main import app, _strip_html, build_extract_schema, _to_gemini_schema

client = TestClient(app)


def test_to_gemini_schema_uppercases_types_and_drops_extra_keys():
    schema = build_extract_schema([
        {"name": "company", "type": "Text"},
        {"name": "revenue", "type": "Decimal"},
        {"name": "risks", "type": "List"},
    ])
    g = _to_gemini_schema(schema)
    assert g["type"] == "OBJECT"
    assert g["properties"]["company"]["type"] == "STRING"
    assert g["properties"]["revenue"]["type"] == "NUMBER"
    assert g["properties"]["risks"] == {"type": "ARRAY", "items": {"type": "STRING"}}
    assert "additionalProperties" not in g  # Gemini rejects it
    assert g["required"] == ["company", "revenue", "risks"]


def test_llm_routes_to_selected_provider(monkeypatch):
    """An Anthropic-selected LLM node dispatches to the Anthropic chat adapter."""
    monkeypatch.setitem(main.PROVIDERS["anthropic"], "chat", lambda key, model, system, prompt: f"[{model}] analyzed")
    payload = {
        "apiKeys": {"anthropic": "sk-ant-fake"},
        "nodes": [
            node("customInput-1", "customInput", value="hello"),
            node("llm-1", "llm", provider="Anthropic", model="claude-sonnet-4-6"),
            node("customOutput-1", "customOutput", outputName="out"),
        ],
        "edges": [
            edge("customInput-1", "value", "llm-1", "prompt"),
            edge("llm-1", "response", "customOutput-1", "value"),
        ],
    }
    res = client.post("/pipelines/run", json=payload)
    assert res.status_code == 200
    assert res.json()["outputs"]["out"] == "[claude-sonnet-4-6] analyzed"


def test_extract_routes_to_selected_provider(monkeypatch):
    """A Google-selected Extract node dispatches to the Google extract adapter."""
    monkeypatch.setitem(main.PROVIDERS["google"], "extract", lambda key, model, text, schema: {"company": "Acme"})
    payload = {
        "apiKeys": {"google": "AIza-fake"},
        "nodes": [
            node("customInput-1", "customInput", value="Acme is a company."),
            node("extract-1", "extract", provider="Google", model="gemini-3.5-flash", fields=[{"name": "company", "type": "Text"}]),
            node("customOutput-1", "customOutput", outputName="company"),
        ],
        "edges": [
            edge("customInput-1", "value", "extract-1", "context"),
            edge("extract-1", "field-company", "customOutput-1", "value"),
        ],
    }
    res = client.post("/pipelines/run", json=payload)
    assert res.status_code == 200
    assert res.json()["outputs"]["company"] == "Acme"


def test_malformed_api_key_rejected_cleanly():
    """Prose/garbage pasted into the key field fails with a clear 400, not an
    httpx header-encoding crash."""
    payload = {
        "apiKeys": {"openai": "Exactly. This is not a key " + "x" * 400},
        "nodes": [
            node("customInput-1", "customInput", value="hi"),
            node("llm-1", "llm", provider="OpenAI", model="gpt-4o-mini"),
            node("customOutput-1", "customOutput", outputName="out"),
        ],
        "edges": [
            edge("customInput-1", "value", "llm-1", "prompt"),
            edge("llm-1", "response", "customOutput-1", "value"),
        ],
    }
    res = client.post("/pipelines/run", json=payload)
    assert res.status_code == 400
    assert "looks invalid" in res.json()["detail"]


def _llm_payload(provider, key):
    return {
        "apiKeys": {provider.lower(): key},
        "nodes": [
            node("customInput-1", "customInput", value="hi"),
            node("llm-1", "llm", provider=provider, model="gpt-4o-mini"),
            node("customOutput-1", "customOutput", outputName="out"),
        ],
        "edges": [
            edge("customInput-1", "value", "llm-1", "prompt"),
            edge("llm-1", "response", "customOutput-1", "value"),
        ],
    }


def test_rejected_key_returns_friendly_401(monkeypatch):
    """A provider rejecting the key (401) becomes a clean, friendly 401."""
    class FakeAuthError(Exception):
        status_code = 401

    def boom(*a, **k):
        raise FakeAuthError("Error code: 401 - Incorrect API key provided: sk-xxx")

    monkeypatch.setitem(main.PROVIDERS["openai"], "chat", boom)
    res = client.post("/pipelines/run", json=_llm_payload("OpenAI", "sk-wrong"))
    assert res.status_code == 401
    assert "was rejected" in res.json()["detail"]


def test_auth_error_detected_from_message_only(monkeypatch):
    """Google-style errors carry no status_code — detection falls back to text."""
    monkeypatch.setitem(main.PROVIDERS["google"], "chat",
                        lambda *a, **k: (_ for _ in ()).throw(Exception("API key not valid. Please pass a valid API key.")))
    payload = _llm_payload("OpenAI", "x")  # reshape for google
    payload = {
        "apiKeys": {"google": "AIza-bad"},
        "nodes": [
            node("customInput-1", "customInput", value="hi"),
            node("llm-1", "llm", provider="Google", model="gemini-3.5-flash"),
            node("customOutput-1", "customOutput", outputName="out"),
        ],
        "edges": [
            edge("customInput-1", "value", "llm-1", "prompt"),
            edge("llm-1", "response", "customOutput-1", "value"),
        ],
    }
    res = client.post("/pipelines/run", json=payload)
    assert res.status_code == 401
    assert "Google" in res.json()["detail"]


def test_non_auth_error_still_returns_502(monkeypatch):
    """A genuine network/other error stays a 502, not a misleading 401."""
    monkeypatch.setitem(main.PROVIDERS["openai"], "chat",
                        lambda *a, **k: (_ for _ in ()).throw(RuntimeError("connection reset by peer")))
    res = client.post("/pipelines/run", json=_llm_payload("OpenAI", "sk-realish"))
    assert res.status_code == 502
    assert "API error" in res.json()["detail"]


def _explain_doc_pipeline(api_keys):
    return {
        "apiKeys": api_keys,
        "nodes": [
            node("scrape-1", "scrape", url="https://example.com"),
            node("customOutput-1", "customOutput", outputName="page"),
        ],
        "edges": [edge("scrape-1", "content", "customOutput-1", "value")],
        "context": {"scrape-1": "Example Domain ...", "customOutput-1": "Example Domain ..."},
    }


def test_explain_summarizes_run(monkeypatch):
    """The explain endpoint feeds the execution log to the model and returns its
    structured {summary, steps}."""
    captured = {}

    def fake(api_key, model, system, user, schema, schema_name="result"):
        captured["user"] = user
        return {"summary": "Scraped a doc and extracted fields.",
                "steps": [{"node_id": "scrape-1", "action": "Fetched the document."}]}

    monkeypatch.setitem(main.STRUCTURED, "openai", fake)
    res = client.post("/pipelines/explain", json=_explain_doc_pipeline({"openai": "sk-ok"}))
    assert res.status_code == 200
    body = res.json()
    assert body["summary"].startswith("Scraped")
    assert body["steps"][0]["node_id"] == "scrape-1"
    assert "scrape-1" in captured["user"] and "Example Domain" in captured["user"]


def test_explain_uses_available_provider_when_no_openai(monkeypatch):
    """With only an Anthropic key, the explainer routes to Anthropic (not 'add OpenAI')."""
    captured = {}

    def fake(api_key, model, system, user, schema, schema_name="result"):
        captured["model"] = model
        return {"summary": "via claude", "steps": []}

    monkeypatch.setitem(main.STRUCTURED, "anthropic", fake)
    res = client.post("/pipelines/explain", json=_explain_doc_pipeline({"anthropic": "sk-ant-ok"}))
    assert res.status_code == 200
    assert res.json()["summary"] == "via claude"
    assert captured["model"] == main.DEFAULT_MODELS["anthropic"]


def test_explain_prefers_openai_when_multiple_keys(monkeypatch):
    monkeypatch.setitem(main.STRUCTURED, "openai", lambda *a, **k: {"summary": "openai", "steps": []})
    monkeypatch.setitem(main.STRUCTURED, "anthropic", lambda *a, **k: {"summary": "anthropic", "steps": []})
    res = client.post("/pipelines/explain", json=_explain_doc_pipeline({"openai": "sk-ok", "anthropic": "sk-ant-ok"}))
    assert res.json()["summary"] == "openai"


def test_explain_without_any_key_returns_400():
    res = client.post("/pipelines/explain", json={"nodes": [], "edges": [], "context": {}})
    assert res.status_code == 400
    assert "API key" in res.json()["detail"]


def test_build_extract_schema_maps_types():
    fields = [
        {"name": "company", "type": "Text"},
        {"name": "revenue", "type": "Decimal", "description": "annual revenue"},
        {"name": "is_public", "type": "Boolean"},
        {"name": "risks", "type": "List"},
        {"name": "", "type": "Text"},  # blank name is skipped
    ]
    schema = build_extract_schema(fields)
    assert schema["properties"]["company"]["type"] == "string"
    assert schema["properties"]["revenue"]["type"] == "number"
    assert schema["properties"]["revenue"]["description"] == "annual revenue"
    assert schema["properties"]["is_public"]["type"] == "boolean"
    assert schema["properties"]["risks"] == {"type": "array", "items": {"type": "string"}}
    assert "" not in schema["properties"]
    assert schema["required"] == ["company", "revenue", "is_public", "risks"]
    assert schema["additionalProperties"] is False


def test_extract_without_fields_returns_400():
    payload = {
        "nodes": [
            node("customInput-1", "customInput", value="some text"),
            node("extract-1", "extract", model="gpt-4o-mini", apiKey="sk-x", fields=[]),
            node("customOutput-1", "customOutput", outputName="out"),
        ],
        "edges": [edge("customInput-1", "value", "extract-1", "context")],
    }
    res = client.post("/pipelines/run", json=payload)
    assert res.status_code == 400
    assert "no schema fields" in res.json()["detail"]


def test_extract_without_api_key_returns_400():
    payload = {
        "nodes": [
            node("extract-1", "extract", model="gpt-4o-mini", fields=[{"name": "x", "type": "Text"}]),
        ],
        "edges": [],
    }
    res = client.post("/pipelines/run", json=payload)
    assert res.status_code == 400
    assert "API key" in res.json()["detail"]


def test_strip_html_extracts_readable_text():
    markup = (
        "<html><head><style>.x{color:red}</style></head>"
        "<body><h1>Title</h1><p>Hello &amp; welcome</p>"
        "<script>track()</script></body></html>"
    )
    assert _strip_html(markup) == "Title Hello & welcome"


def test_scrape_without_url_returns_400():
    payload = {
        "nodes": [
            node("scrape-1", "scrape", url="https://"),
            node("customOutput-1", "customOutput", outputName="out"),
        ],
        "edges": [edge("scrape-1", "content", "customOutput-1", "value")],
    }
    res = client.post("/pipelines/run", json=payload)
    assert res.status_code == 400
    assert "no URL" in res.json()["detail"]


def node(nid, ntype, **data):
    return {"id": nid, "type": ntype, "data": data}


def edge(source, sh, target, th):
    return {
        "source": source,
        "sourceHandle": f"{source}-{sh}",
        "target": target,
        "targetHandle": f"{target}-{th}",
    }


def test_input_text_output_interpolation():
    """Input -> Text({{name}}) -> Output runs end-to-end with no API key."""
    payload = {
        "nodes": [
            node("customInput-1", "customInput", value="world"),
            node("text-1", "text", text="Hello {{name}}!"),
            node("customOutput-1", "customOutput", outputName="greeting"),
        ],
        "edges": [
            edge("customInput-1", "value", "text-1", "var-name"),
            edge("text-1", "output", "customOutput-1", "value"),
        ],
    }
    res = client.post("/pipelines/run", json=payload)
    assert res.status_code == 200
    assert res.json()["outputs"]["greeting"] == "Hello world!"


def test_llm_without_api_key_returns_400():
    """An LLM node with no key fails gracefully (not a 500)."""
    payload = {
        "nodes": [
            node("customInput-1", "customInput", value="hi"),
            node("llm-1", "llm", model="gpt-4o-mini"),
            node("customOutput-1", "customOutput", outputName="out"),
        ],
        "edges": [
            edge("customInput-1", "value", "llm-1", "prompt"),
            edge("llm-1", "response", "customOutput-1", "value"),
        ],
    }
    res = client.post("/pipelines/run", json=payload)
    assert res.status_code == 400
    assert "API key" in res.json()["detail"]


def test_cycle_returns_400():
    """A cyclic graph is rejected before execution (node type is irrelevant)."""
    payload = {
        "nodes": [
            node("text-1", "text", text="{{a}}"),
            node("text-2", "text", text="{{b}}"),
        ],
        "edges": [
            edge("text-1", "output", "text-2", "var-b"),
            edge("text-2", "output", "text-1", "var-a"),
        ],
    }
    res = client.post("/pipelines/run", json=payload)
    assert res.status_code == 400
    assert "Cycle" in res.json()["detail"]
