# LORE Implementation Plans

LORE implementation plans are workflow-neutral specifications of work.

They may be executed by a human, a general coding agent, Superpowers, or another compatible orchestration workflow. References to a particular execution framework are optional guidance and never prerequisites.

## Execution contract

For every plan:

1. Read the task, its declared inputs and outputs, and the repository contracts it cites.
2. Implement the smallest independently testable change.
3. Run the stated verification commands.
4. Record the resulting Git commit and evidence.
5. Continue to the next task only after the current task's acceptance criteria pass.

An execution environment may provide additional planning, delegation, review, or checkpoint machinery, but it must not alter LORE's public schemas or maintenance protocol.

## Superpowers

Superpowers is a supported optional execution workflow. It is not required to build, run, test, use, maintain, or contribute to LORE. The normative boundary is recorded in [ADR-0001](../adr/0001-superpowers-compatibility.md).

The original detailed bootstrap plan currently lives under `docs/superpowers/plans/` because it was authored through that workflow. Its Superpowers-specific opening instruction is nonnormative and superseded by ADR-0001 and this execution contract. The implementation tasks and technical acceptance criteria remain valid.

Future canonical plans belong directly under `docs/plans/`. Optional framework adapters belong under `docs/integrations/`.
