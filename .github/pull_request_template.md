## Problem

Describe the behavior, invariant, or documentation gap this change addresses.

## Change

Describe the exact contract or behavior changed. Identify authoritative inputs and any regenerated outputs.

## Verification

List the commands run and their results. Include the exact proposed head when reporting verification evidence.

```text
node scripts/restore-verified-lockfile.mjs
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm lore extract --check
pnpm lore validate
pnpm lore project --check
pnpm lore verify-self
git diff --exit-code
```

## Risk and compatibility

Describe security, compatibility, migration, rollback, performance, or data-integrity implications. State `none identified` only after considering each category.

## Generated and durable state

- [ ] I did not directly edit generated documentation without updating its authoritative source.
- [ ] Semantic record changes preserve append-only history.
- [ ] Proposal, transaction, schema, or public CLI changes include appropriate tests and documentation.
- [ ] No credentials, private repository contents, machine-specific paths, or incompatible third-party material are included.