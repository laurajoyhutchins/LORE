# LORE Deciduous archaeology

The canonical source for this branch is the readable JSON under `.deciduous/source/`.

This is an explicitly **partial baseline**, not the complete LORE archaeology backfill. It preserves two evidence-backed arcs:

1. why LORE became a repository-local accepted-knowledge protocol rather than ordinary documentation or inferred Git intent;
2. why deterministic facts, reviewed semantic records, untrusted proposals, atomic transactions, and human projections became separate authority layers.

The earlier archaeology branch attempted to bootstrap a larger graph from opaque encoded payload fragments. The reconstructed archive did not match its declared SHA-256, so no graph was materialized or validated. This branch replaces that transport with reviewable source instead of carrying forward an unverifiable node-count claim.

Validate with:

```bash
python scripts/validate_archaeology.py
python -m unittest discover -s tests -p 'test_archaeology.py' -v
```

The validator checks canonical JSON, native Deciduous node/status/edge vocabulary, stable identifiers, evidence references, endpoint integrity, acyclicity, privacy patterns, and the committed status summary.

Repository-local source remains authoritative for this partial causal reconstruction. `docs/archaeology/status-summary.json` is a generated review projection. No SQLite database or opaque archive is committed.
