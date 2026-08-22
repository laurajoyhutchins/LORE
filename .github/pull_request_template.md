## Problem

Describe the concrete consumer or maintenance problem this change addresses.

## Change

Describe the smallest contract or behavior change and how it reduces downstream work, bookkeeping, or failure risk.

## Verification

List the exact commands run and their results. The repository verification contract is:

```text
corepack enable
pnpm install --no-frozen-lockfile
pnpm run ci
```

## Documentation impact

- [ ] Reviewed knowledge was updated if repository purpose, architecture, constraints, or procedures changed.
- [ ] `pnpm lore validate .` passes.
- [ ] `pnpm lore project . --check` passes when generated projections are committed.

## Scope check

- [ ] This change is justified by a concrete consumer problem and measurable benefit.
- [ ] It does not reintroduce proposal/apply transactions, semantic-history machinery, causal-graph platform features, compatibility projections, hydration workflows, or generalized orchestration.
- [ ] No credentials, private repository contents, machine-specific paths, or incompatible third-party material are included.
