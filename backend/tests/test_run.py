from fastapi.testclient import TestClient

from main import app, _strip_html, build_extract_schema

client = TestClient(app)


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


def test_anthropic_provider_not_wired_returns_501():
    """Selecting a not-yet-wired provider fails cleanly (501), even with a key."""
    payload = {
        "apiKeys": {"anthropic": "sk-ant-x"},
        "nodes": [
            node("customInput-1", "customInput", value="hi"),
            node("llm-1", "llm", provider="Anthropic", model="claude-sonnet-4-6"),
            node("customOutput-1", "customOutput", outputName="out"),
        ],
        "edges": [
            edge("customInput-1", "value", "llm-1", "prompt"),
            edge("llm-1", "response", "customOutput-1", "value"),
        ],
    }
    res = client.post("/pipelines/run", json=payload)
    assert res.status_code == 501
    assert "Anthropic" in res.json()["detail"]


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
