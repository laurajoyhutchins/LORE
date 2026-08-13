# Task

Document transaction recovery

# Repository revision

<repository-revision>

# Selected context

## lore://lore/component/component.transactions@1

Append-only proposal planning and transactional application.

Why: component match, tag match: bootstrap, audience match, record weight

## lore://lore/decision/decision.agent-neutral-maintainer-contract@1

Maintainers communicate through public context and proposal protocols.

Why: tag match: bootstrap, audience match, active decision, record weight

## lore://lore/decision/decision.git-backed-storage@1

Git is the durable store for facts, records, transactions, and projections.

Why: tag match: bootstrap, audience match, active decision, record weight

## lore://lore/finding/finding.bootstrap-kernel-is-hand-authored@1

The initial trust root must be reviewed before self-hosting begins.

Why: tag match: bootstrap, audience match, active finding, record weight

## lore://lore/component/component.cli@1

Command dispatcher for LORE workflows.

Why: tag match: bootstrap, audience match, record weight

## lore://lore/component/component.extraction@1

Deterministic repository fact extraction.

Why: tag match: bootstrap, audience match, record weight

## lore://lore/component/component.validation@1

Repository, record, evidence, and schema validation.

Why: tag match: bootstrap, audience match, record weight

## lore://lore/constraint/constraint.no-agent-direct-mutation@1

Maintainers cannot directly alter accepted history or generated outputs.

Why: tag match: bootstrap, audience match, record weight

## lore://lore/procedure/procedure.bootstrap-repository@1

Use lore init, extract, validate, project, and verify-self.

Why: tag match: bootstrap, audience match, record weight

## lore://lore/repository/repository.lore@1

Agent-neutral Git-backed repository documentation system.

Why: tag match: bootstrap, audience match, record weight

## lore://lore/decision/decision.repository-local-knowledge-protocol@1

LORE stores reviewed semantic knowledge, evidence, transactions, and deterministic views inside the repository under explicit contracts.

Why: audience match, active decision, record weight

## lore://lore/decision/decision.separate-authority-layers@1

LORE gives extracted facts, semantic records, proposals, transactions, and projections distinct mutation and authority rules.

Why: audience match, active decision, record weight

## lore://lore/finding/finding.collapsed-document-authority-is-insufficient@1

A single prose document cannot safely distinguish replaceable extracted facts from append-only reviewed semantic meaning.

Why: audience match, active finding, record weight

## lore://lore/finding/finding.generated-prose-is-not-authority@1

Human-readable Markdown is a generated view and cannot be the authoritative representation of accepted repository meaning.

Why: audience match, active finding, record weight

## lore://lore/finding/finding.git-history-is-not-semantic-knowledge@1

Git provides durable review and reconstruction, but accepted semantic records are still required to preserve architectural interpretation explicitly.

Why: audience match, active finding, record weight

## lore://lore/constraint/constraint.durable-repository-knowledge@1

Repository knowledge must persist as reviewable, versioned Git state and remain usable by arbitrary maintainers.

Why: audience match, record weight

## lore://lore/constraint/constraint.separate-facts-meaning-and-views@1

Deterministic observations, reviewed semantic meaning, and generated views must remain distinct authority layers.

Why: audience match, record weight

## lore://lore/relationship/relationship.bootstrap-exposes-hand-authored-kernel@1

Self-hosting begins from an explicit hand-authored bootstrap kernel that must be reviewed before generated self-description can be trusted.

Why: audience match, record weight

## lore://lore/relationship/relationship.collapse-finding-to-layer-decision@1

The inability of one document layer to preserve distinct authority semantics motivates separate validated layers.

Why: audience match, record weight

## lore://lore/relationship/relationship.durability-to-git-history-finding@1

Requiring durable repository knowledge exposes the need to represent accepted meaning explicitly rather than rely on Git history alone.

Why: audience match, record weight

# Evidence to inspect

- docs/superpowers/specs/2026-07-28-lore-design.md@f663e319ff85a24b2e67b29d55cf897785ce4dea
- docs/superpowers/specs/2026-07-28-lore-design.md@f663e319ff85a24b2e67b29d55cf897785ce4dea
- docs/superpowers/specs/2026-07-28-lore-design.md@f663e319ff85a24b2e67b29d55cf897785ce4dea
- docs/superpowers/specs/2026-07-28-lore-design.md@f663e319ff85a24b2e67b29d55cf897785ce4dea
- docs/superpowers/specs/2026-07-28-lore-design.md@f663e319ff85a24b2e67b29d55cf897785ce4dea
- docs/superpowers/specs/2026-07-28-lore-design.md@f663e319ff85a24b2e67b29d55cf897785ce4dea
- docs/superpowers/specs/2026-07-28-lore-design.md@f663e319ff85a24b2e67b29d55cf897785ce4dea
- docs/superpowers/specs/2026-07-28-lore-design.md@f663e319ff85a24b2e67b29d55cf897785ce4dea
- docs/superpowers/specs/2026-07-28-lore-design.md@f663e319ff85a24b2e67b29d55cf897785ce4dea
- docs/superpowers/specs/2026-07-28-lore-design.md@f663e319ff85a24b2e67b29d55cf897785ce4dea
- docs/superpowers/specs/2026-07-28-lore-design.md@febd06c201868fe16c0ffed3866b5cbf92c37abc
- docs/superpowers/specs/2026-07-28-lore-design.md@febd06c201868fe16c0ffed3866b5cbf92c37abc
- docs/superpowers/specs/2026-07-28-lore-design.md@febd06c201868fe16c0ffed3866b5cbf92c37abc
- docs/superpowers/specs/2026-07-28-lore-design.md@febd06c201868fe16c0ffed3866b5cbf92c37abc
- docs/superpowers/specs/2026-07-28-lore-design.md@febd06c201868fe16c0ffed3866b5cbf92c37abc
- docs/superpowers/specs/2026-07-28-lore-design.md@febd06c201868fe16c0ffed3866b5cbf92c37abc
- docs/superpowers/specs/2026-07-28-lore-design.md@febd06c201868fe16c0ffed3866b5cbf92c37abc
- docs/superpowers/specs/2026-07-28-lore-design.md@febd06c201868fe16c0ffed3866b5cbf92c37abc
- docs/superpowers/specs/2026-07-28-lore-design.md@febd06c201868fe16c0ffed3866b5cbf92c37abc
- docs/superpowers/specs/2026-07-28-lore-design.md@febd06c201868fe16c0ffed3866b5cbf92c37abc

# Validation commands

- `lore validate`
- `lore project --check`
- `lore verify-self`

# Omitted context summary

13 records omitted.
