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
node scripts/restore-verified-lockfile.mjs
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

## Public release verification

Maintainers preparing a public release must use the repository's unified gate rather than assembling an informal checklist.

The repository stores the approved `pnpm-lock.yaml` as independently checksummed gzip members under `artifacts/verified-lockfile/`. The release gate reconstructs the standard lockfile, verifies its SHA-256 and Git blob identity, and removes a gate-created copy before the clean-tree check.

To refresh deterministic outputs after authoritative changes:

```bash
corepack pnpm release:refresh
```

Review and commit the resulting generated changes. Then fetch all refs and run the exact-head gate from a clean checkout:

```bash
git fetch --all --tags --prune
corepack pnpm release:verify
```

The gate verifies the approved lockfile identity, scans reachable history for high-confidence disclosures, reports public commit emails, rejects unreviewed tracked links and binaries, restores the frozen dependency graph, and runs every code and LORE verification command. Publication evidence is valid only when it emits `VERIFIED_PUBLICATION_READY` for the unchanged exact head.

## Licensing

LORE is licensed under the Apache License 2.0. Unless you explicitly state otherwise, a contribution intentionally submitted for inclusion in LORE is provided under the same license without additional terms or conditions.

Do not submit third-party code, documentation, data, images, or generated assets unless their provenance is explicit and their redistribution terms are compatible with Apache-2.0.