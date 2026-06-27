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


def test_math_two_plus_two_is_four():
    """Two Inputs -> Math(+) -> Output computes 2 + 2 = 4 deterministically."""
    payload = {
        "nodes": [
            node("customInput-1", "customInput", value="2"),
            node("customInput-2", "customInput", value="2"),
            node("math-1", "math", operator="+"),
            node("customOutput-1", "customOutput", outputName="sum"),
        ],
        "edges": [
            edge("customInput-1", "value", "math-1", "a"),
            edge("customInput-2", "value", "math-1", "b"),
            edge("math-1", "result", "customOutput-1", "value"),
        ],
    }
    res = client.post("/pipelines/run", json=payload)
    assert res.status_code == 200
    assert res.json()["outputs"]["sum"] == "4"


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


def test_math_with_non_numeric_input_raises_400():
    """The Jordan Belfort case: feeding text into Math fails loudly, not 'sum=2'."""
    payload = {
        "nodes": [
            node("customInput-1", "customInput", value="who is jordan belfort?"),
            node("customInput-2", "customInput", value="2"),
            node("math-1", "math", operator="+"),
            node("customOutput-1", "customOutput", outputName="sum"),
        ],
        "edges": [
            edge("customInput-1", "value", "math-1", "a"),
            edge("customInput-2", "value", "math-1", "b"),
            edge("math-1", "result", "customOutput-1", "value"),
        ],
    }
    res = client.post("/pipelines/run", json=payload)
    assert res.status_code == 400
    assert "expected a number" in res.json()["detail"]


def test_cycle_returns_400():
    payload = {
        "nodes": [
            node("math-1", "math", operator="+"),
            node("math-2", "math", operator="+"),
        ],
        "edges": [
            edge("math-1", "result", "math-2", "a"),
            edge("math-2", "result", "math-1", "a"),
        ],
    }
    res = client.post("/pipelines/run", json=payload)
    assert res.status_code == 400
    assert "Cycle" in res.json()["detail"]
