# LORE

LORE is a small, maintenance-mode repository documentation utility.

Its job is deliberately narrow: extract deterministic repository facts, validate a small body of reviewed repository knowledge, project concise current documentation, and optionally select bounded deterministic context for a task.

Repository truth remains in Git. Reviewed knowledge lives beside it. Generated prose is non-authoritative.

## Supported CLI

```text
lore init [root]
lore extract [root]
lore validate [root]
lore project [root] [--check]
lore context <query> [root] [--max-records N] [--max-bytes N]
```

All commands accept `--json` where a machine-readable result is useful.

`lore init` never writes or claims ownership of a repository `README.md`. It creates only `lore.yaml`, `.lore/knowledge/`, and the configured generated-docs directory. Generated documentation defaults to `docs/lore/`.

## Reviewed knowledge

Knowledge is YAML or JSON under `.lore/knowledge/`. A record has:

```yaml
id: decision.git-native-history
kind: decision
title: Git-native history
summary: Reviewed knowledge changes use normal Git commits and pull requests.
details:
  - LORE does not maintain a second transaction history.
evidence:
  - path: README.md
related:
  - repository.example
tags:
  - maintenance
```

Supported kinds are `overview`, `component`, `decision`, `constraint`, `procedure`, and `note`. `related` is a plain documentation relationship. LORE validates references but imposes no DAG or causal semantics.

Evidence paths must stay inside the repository and exist. Validation fails closed on unsupported fields, malformed records, duplicate IDs, broken relationships, or missing evidence paths.

## Normal workflow

```text
edit reviewed repository knowledge
        ↓
lore validate
        ↓
lore project            # only when this repository commits generated docs
        ↓
normal Git commit / PR review
        ↓
merge
```

There are no proposal files, apply transactions, transaction receipts, semantic-history protocol, causal traversal, hydration lifecycle, or Deciduous compatibility layer in the supported product.

## Consumer footprint

A normal consumer should need approximately:

```text
lore.yaml
.lore/knowledge/
docs/lore/              # optional committed projections
package dependency
one cheap validate/project check
```

Consumers verify their own documentation contract. They do not verify LORE's internal release or self-hosting machinery.

## Context

`lore context` is retained because it survives as a thin deterministic selector over reviewed knowledge and evidence references. Selection is lexical, explainable, bounded by record count and bytes, and uses no external model. It does not hydrate workspaces or create proposals.

## Maintenance mode

LORE is not an active knowledge-management platform. New features require a concrete consumer problem and measurable reduction in downstream work. See `MAINTENANCE.md`.
