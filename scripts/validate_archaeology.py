#!/usr/bin/env python3
"""Validate the readable, partial LORE Deciduous archaeology baseline."""
from __future__ import annotations

import collections
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / ".deciduous" / "source"
SUMMARY = ROOT / "docs" / "archaeology" / "status-summary.json"

NODE_TYPES = {"goal", "option", "decision", "action", "outcome", "observation", "revisit"}
STATUSES = {"pending", "active", "completed", "rejected", "superseded", "abandoned"}
EDGE_TYPES = {"leads_to", "chosen", "rejected", "requires", "blocks", "enables", "supersedes"}
EXPECTED_NODES = 16
EXPECTED_EDGES = 17
SHA_RE = re.compile(r"^[0-9a-f]{40}$")
FORBIDDEN = (
    re.compile(r"[A-Za-z]:\\(?:Users|Documents)\\", re.I),
    re.compile(r"/Users/[^/\s]+/"),
    re.compile(r"/home/[^/\s]+/"),
    re.compile(r"(api[_-]?key|secret|password)\s*[:=]\s*\S+", re.I),
    re.compile(r"sk-proj-"),
)


def fail(message: str) -> None:
    raise SystemExit(f"FAIL: {message}")


def load_source() -> tuple[list[dict], list[dict], set[str]]:
    paths = sorted(SOURCE.glob("*.json"))
    if not paths:
        fail("no canonical source files found")
    nodes: list[dict] = []
    edges: list[dict] = []
    arcs: set[str] = set()
    for path in paths:
        text = path.read_text(encoding="utf-8")
        data = json.loads(text)
        canonical = json.dumps(data, indent=2, ensure_ascii=False) + "\n"
        if text != canonical:
            fail(f"non-canonical JSON: {path.relative_to(ROOT)}")
        if data.get("schema") != "lore-deciduous-source-v1":
            fail(f"unexpected source schema: {path.relative_to(ROOT)}")
        if data.get("repository") != "laurajoyhutchins/LORE":
            fail(f"unexpected repository coordinate: {path.relative_to(ROOT)}")
        if data.get("partial") is not True:
            fail("baseline must remain explicitly partial")
        nodes.extend(data.get("nodes", []))
        edges.extend(data.get("edges", []))
        arcs.update(node.get("arc", "") for node in data.get("nodes", []))
        for pattern in FORBIDDEN:
            if pattern.search(text):
                fail(f"private path or credential pattern in {path.relative_to(ROOT)}")
    return nodes, edges, arcs


def evidence_exists(reference: str) -> bool:
    kind, _, target = reference.partition(":")
    coordinate = target.split("#", 1)[0]
    if kind == "path":
        return (ROOT / coordinate).exists()
    if kind == "commit":
        if not SHA_RE.fullmatch(coordinate):
            return False
        if not (ROOT / ".git").exists():
            return True
        result = subprocess.run(
            ["git", "cat-file", "-e", f"{coordinate}^{{commit}}"],
            cwd=ROOT,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            check=False,
        )
        return result.returncode == 0
    return False


def validate_graph(nodes: list[dict], edges: list[dict], arcs: set[str]) -> dict:
    if len(nodes) != EXPECTED_NODES or len(edges) != EXPECTED_EDGES:
        fail(f"expected {EXPECTED_NODES} nodes/{EXPECTED_EDGES} edges, got {len(nodes)}/{len(edges)}")
    node_ids = [node.get("id") for node in nodes]
    edge_ids = [edge.get("id") for edge in edges]
    if len(set(node_ids)) != len(node_ids):
        fail("duplicate node identifiers")
    if len(set(edge_ids)) != len(edge_ids):
        fail("duplicate edge identifiers")
    known = set(node_ids)
    for node in nodes:
        if node.get("type") not in NODE_TYPES:
            fail(f"unsupported node type: {node.get('id')}")
        if node.get("status") not in STATUSES:
            fail(f"unsupported native status: {node.get('id')}")
        if not node.get("lifecycle_status"):
            fail(f"missing lifecycle metadata: {node.get('id')}")
        if not isinstance(node.get("current"), bool):
            fail(f"missing current marker: {node.get('id')}")
        if node.get("current") and node.get("status") != "active":
            fail(f"current node is not active: {node.get('id')}")
        evidence = node.get("evidence")
        if not isinstance(evidence, list) or not evidence:
            fail(f"missing evidence: {node.get('id')}")
        for reference in evidence:
            if not evidence_exists(reference):
                fail(f"unresolved evidence {reference!r} on {node.get('id')}")
    adjacency = {node_id: [] for node_id in known}
    indegree = {node_id: 0 for node_id in known}
    for edge in edges:
        if edge.get("type") not in EDGE_TYPES:
            fail(f"unsupported edge type: {edge.get('id')}")
        source, target = edge.get("from"), edge.get("to")
        if source not in known or target not in known:
            fail(f"unresolved edge endpoint: {edge.get('id')}")
        if not edge.get("rationale"):
            fail(f"missing edge rationale: {edge.get('id')}")
        if edge.get("type") != "supersedes":
            adjacency[source].append(target)
            indegree[target] += 1
    queue = collections.deque(sorted(node_id for node_id, degree in indegree.items() if degree == 0))
    visited = 0
    while queue:
        source = queue.popleft()
        visited += 1
        for target in sorted(adjacency[source]):
            indegree[target] -= 1
            if indegree[target] == 0:
                queue.append(target)
    if visited != len(known):
        fail("forward causal graph contains a cycle")
    return {
        "schema": "lore-archaeology-status-v1",
        "partial": True,
        "node_count": len(nodes),
        "edge_count": len(edges),
        "arc_count": len(arcs),
        "current_node_count": sum(bool(node["current"]) for node in nodes),
        "native_node_types": dict(sorted(collections.Counter(node["type"] for node in nodes).items())),
        "native_statuses": dict(sorted(collections.Counter(node["status"] for node in nodes).items())),
        "edge_types": dict(sorted(collections.Counter(edge["type"] for edge in edges).items())),
    }


def main() -> int:
    nodes, edges, arcs = load_source()
    summary = validate_graph(nodes, edges, arcs)
    expected = json.dumps(summary, indent=2, sort_keys=True) + "\n"
    if not SUMMARY.exists():
        fail("missing committed status summary")
    if SUMMARY.read_text(encoding="utf-8") != expected:
        fail("stale status summary")
    print(
        f"LORE archaeology baseline valid: {summary['node_count']} nodes, "
        f"{summary['edge_count']} edges, {summary['arc_count']} partial arcs"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
