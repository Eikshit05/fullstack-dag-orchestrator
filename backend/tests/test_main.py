import pytest
from fastapi.testclient import TestClient
from main import app  # Ensure this matches your FastAPI app import path

client = TestClient(app)


# Helper function to rapidly generate standard payloads for tests
def create_payload(nodes, edges):
    return {
        "nodes": [{"id": n} for n in nodes],
        "edges": [{"source": s, "target": t} for s, t in edges]
    }


def test_empty_graph():
    """An empty graph is technically a valid DAG."""
    response = client.post("/pipelines/parse", json=create_payload([], []))
    assert response.status_code == 200
    assert response.json() == {"num_nodes": 0, "num_edges": 0, "is_dag": True}


def test_simple_chain_dag():
    """A standard linear pipeline: A -> B -> C."""
    payload = create_payload(["A", "B", "C"], [("A", "B"), ("B", "C")])
    response = client.post("/pipelines/parse", json=payload)
    assert response.status_code == 200
    assert response.json() == {"num_nodes": 3, "num_edges": 2, "is_dag": True}


def test_disconnected_subgraphs():
    """Two separate pipelines on the same canvas: A->B and C->D."""
    payload = create_payload(["A", "B", "C", "D"], [("A", "B"), ("C", "D")])
    response = client.post("/pipelines/parse", json=payload)
    assert response.status_code == 200
    assert response.json() == {"num_nodes": 4, "num_edges": 2, "is_dag": True}


def test_isolated_ghost_node():
    """A single node with no edges alongside a standard pipeline."""
    payload = create_payload(["A", "B", "C"], [("B", "C")])
    response = client.post("/pipelines/parse", json=payload)
    assert response.status_code == 200
    assert response.json() == {"num_nodes": 3, "num_edges": 1, "is_dag": True}


def test_referential_integrity_breach():
    """Edge references a node ('Z') that does not exist. Must return 422, not 500."""
    payload = create_payload(["A", "B"], [("A", "Z")])
    response = client.post("/pipelines/parse", json=payload)
    assert response.status_code == 422


def test_perfect_cycle():
    """A standard closed loop: A -> B -> C -> A."""
    payload = create_payload(["A", "B", "C"], [("A", "B"), ("B", "C"), ("C", "A")])
    response = client.post("/pipelines/parse", json=payload)
    assert response.status_code == 200
    assert response.json() == {"num_nodes": 3, "num_edges": 3, "is_dag": False}


def test_self_loop():
    """A node that outputs directly into itself: A -> A."""
    payload = create_payload(["A"], [("A", "A")])
    response = client.post("/pipelines/parse", json=payload)
    assert response.status_code == 200
    assert response.json() == {"num_nodes": 1, "num_edges": 1, "is_dag": False}
