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
