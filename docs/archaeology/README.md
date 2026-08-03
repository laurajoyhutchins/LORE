# LORE archaeology baseline

This package is a readable, evidence-backed partial Deciduous reconstruction of LORE's causal history.

## What it establishes

- LORE exists to preserve accepted repository knowledge that cannot be recovered reliably from commits, chats, or ordinary prose alone.
- Git remains durable storage and evidence, but ancestry is not accepted semantic state.
- Deterministically extracted facts are distinct from reviewed semantic records.
- Maintainer and agent proposals remain untrusted until validated.
- Accepted changes are applied transactionally and recorded with receipts.
- Human-readable documentation is generated from canonical state and is not itself authoritative.
- LORE does not own causal archaeology, runtime execution, portfolio readiness, or agent identity.

## What it does not establish

- a complete history of every LORE feature, correction, release, or self-hosting milestone;
- a graph for the versioned CLI release work after the recorded base commit;
- production readiness or external adoption;
- authority over Deciduous repository-local causal history;
- any relationship to another repository that is not supported by exact reciprocal evidence.

## Canonical source

`.deciduous/source/lore-baseline.json` is the canonical readable source on this branch. `status-summary.json` is a derived review projection.

The graph contains 16 nodes and 17 typed edges across two arcs. Its `partial` field must remain true until the missing arcs are reconstructed and independently reviewed.

## Verification

```bash
python scripts/validate_archaeology.py
python -m unittest discover -s tests -p 'test_archaeology.py' -v
```

The validator deliberately fails if the graph is relabeled complete, if evidence becomes unresolved, if a non-native node/status/edge value is introduced, or if the committed summary becomes stale.

## Superseded transport

Draft PR #11 attempted to reconstruct a larger graph from opaque payload fragments. GitHub Actions proved that the reconstructed archive did not match the declared SHA-256 before extraction. That branch is superseded by this readable baseline and should remain closed rather than repaired in place.
