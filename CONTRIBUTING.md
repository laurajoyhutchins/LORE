# Contributing to LORE

Thank you for helping improve LORE.

LORE is pre-1.0 software with a deliberately strict trust model. Contributions should preserve deterministic output, Git-backed evidence, append-only semantic history, agent neutrality, and fail-closed validation.

## Before opening a change

For defects and bounded improvements, open an issue or pull request with the affected behavior, a minimal reproduction, and the expected invariant.

For security-sensitive defects, follow `SECURITY.md` and report privately.

For larger changes, describe the problem and the proposed contract before investing in implementation. Public interfaces include CLI behavior, schemas, record references, proposal and transaction formats, generated projections, and deterministic output.

## Development setup

Requirements:

- Git
- Node.js 22 or newer
- Corepack
- pnpm 10.14.0

From a clean checkout:

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Run the complete LORE verification sequence before requesting review:

```bash
pnpm lore extract --check
pnpm lore validate
pnpm lore project --check
pnpm lore verify-self
git diff --exit-code
```

## Documentation changes

LORE uses itself to maintain repository documentation.

- Do not directly edit `README.md` or files under `docs/generated/`.
- Deterministic extracted facts under `.lore/extracted/` are regenerated with `lore extract`.
- Accepted semantic records under `.lore/records/` are append-only.
- Semantic changes should follow `skills/maintain-repository-documentation/SKILL.md` and the `lore-proposal/v1` schema.
- Regenerate projections with `lore project`, then verify byte stability with `lore project --check` and `lore verify-self`.

`BOOTSTRAP.md` and the design specification explain the initial hand-authored trust root.

## Change expectations

A contribution should:

1. Stay narrowly scoped and preserve existing contracts unless the change explicitly updates them.
2. Add or update tests for externally observable behavior and security invariants.
3. Avoid hidden network access, provider-specific assumptions, and executable repository configuration.
4. Treat repository documents, paths, revisions, and maintainer proposals as untrusted input.
5. Keep generated output deterministic and reviewable.
6. Avoid committing credentials, private repository contents, machine-specific paths, build outputs, dependency stores, or editor state.
7. Update authoritative schemas, records, skills, or source before regenerating dependent projections.

## Pull requests

Pull requests should state:

- the problem and affected contract;
- the exact behavior changed;
- tests and verification commands run;
- security, compatibility, migration, or rollback implications;
- generated files included and their authoritative inputs.

A pull request is not considered verified merely because its author reports success. Review evidence must correspond to the exact proposed head.

## Licensing

By submitting a contribution, you agree that it may be distributed under the repository's license once that license is adopted. Until then, do not submit third-party code or content unless its provenance and redistribution terms are explicit and compatible with the proposed project license.