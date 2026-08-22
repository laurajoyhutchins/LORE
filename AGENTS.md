# Agent guidance

LORE is maintenance-mode infrastructure. Prefer deletion and simplification over new platform behavior.

The public contract is `init`, `extract`, `validate`, `project`, and bounded deterministic `context`. Git owns change history and review. Do not reintroduce proposal/apply transactions, causal graph semantics, compatibility projections, hydration workflows, or generalized orchestration.

When changing LORE, ask what useful consumer failure the mechanism prevents and whether ordinary repository/Git behavior already prevents it. New features require a concrete consumer and measurable reduction in downstream work.

Run `pnpm ci` before merging.
