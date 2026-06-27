from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


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
