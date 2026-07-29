# Public release readiness

This document records the evidence and unresolved gates for changing the GitHub repository visibility from private to public. It is a release ledger, not a declaration that the repository is already ready.

## Scope

The initial publication target is the source repository. npm publication is a separate release decision. `package.json` intentionally retains `"private": true` to prevent an accidental package release.

The public repository should expose only product source, tests, schemas, public maintenance protocols, generated documentation, and ordinary project governance. Private execution archives and dependency capsules remain outside this repository.

## Completed preparation

- Public-facing README generated from LORE's projection source.
- Repository description, homepage, issue URL, keywords, and source URL recorded in `package.json`.
- Security boundary and private vulnerability-reporting process documented in `SECURITY.md`.
- Contribution expectations and deterministic verification commands documented in `CONTRIBUTING.md`.
- Community conduct policy added.
- CI restricted to read-only repository permissions, bounded by a timeout, protected from redundant concurrent runs, and expanded to include the production build.
- Dependabot configured for npm and GitHub Actions updates.
- Project status identified as pre-1.0; compatibility is not promised before the first stable release.

## Blocking gates

Do not change repository visibility until every blocking gate below is closed with evidence tied to the exact proposed public head.

### 1. Adopt a license

No project license is currently committed. Public visibility without a license permits viewing and forking through GitHub's platform terms but does not grant ordinary rights to use, modify, or redistribute the project.

The owner must choose and approve the license. Apache License 2.0 is a strong default for infrastructure tooling because it includes an explicit patent grant; MIT is a simpler permissive alternative. The selected license must be committed before inviting external reuse or contributions.

### 2. Commit the verified lockfile

CI uses `pnpm install --frozen-lockfile`, but `pnpm-lock.yaml` is absent from the repository.

A clean-room run generated and verified a lockfile for source commit `465e4174cd4c61c9d45ccbfb4a4565c813cfb964` using pnpm 10.14.0. Its SHA-256 is:

```text
e5e1747bac45b623c375226759fce20857b50ee615926dce1aefd282104ee57d
```

The exact lockfile must be committed, or a new lockfile must be generated and independently verified against the final package manifest. Once committed, CI must demonstrate that `pnpm install --frozen-lockfile` succeeds.

### 3. Promote the clean-room verification fixes

The successful clean-room verification applied a recorded patch to the exact source archive before running typecheck, lint, tests, and build. That patch contained source-quality fixes needed to make the gates pass. The fixes must be reviewed and promoted into the repository, or replaced by equivalent verified changes.

A clean-room pass on a patched working tree is not proof that the unpatched repository head passes.

### 4. Regenerate LORE outputs

After source, package metadata, governance files, records, or projection templates change, regenerate deterministic extracted facts and generated projections. The exact proposed public head must pass:

```bash
pnpm lore extract
pnpm lore project
pnpm lore extract --check
pnpm lore validate
pnpm lore project --check
pnpm lore verify-self
git diff --exit-code
```

Generated files must correspond byte-for-byte to their authoritative inputs.

### 5. Run the exact-head release gate

The final proposed public head must pass, from a clean checkout:

```bash
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

Record the exact commit SHA, Node version, Corepack version, pnpm version, test count, operating system, and whether network isolation was used. A result from a different commit is supporting evidence, not exact-head verification.

### 6. Review current files and reachable history for disclosure

Before visibility changes, review the complete reachable Git history and every current file for:

- credentials, tokens, private keys, connection strings, or sensitive endpoints;
- personal data, private correspondence, internal-only business information, or machine-specific paths;
- copied third-party source, documentation, images, generated assets, or datasets without compatible redistribution rights;
- private repository snapshots, package stores, runtime binaries, or execution artifacts;
- public commit messages, issues, and pull requests that expose non-product internal operations.

Do not rely only on current-tree secret scanning. Making a private repository public exposes reachable historical commits and existing pull-request discussions.

## Repository settings at publication

Immediately before or after the visibility change, confirm:

- private vulnerability reporting is enabled;
- Dependabot alerts and security updates are enabled;
- secret scanning and push protection are enabled when available;
- the default branch is `main`;
- branch protection or rulesets require the intended CI gate before merging;
- workflow permissions default to read-only;
- force pushes and branch deletion are restricted for `main`;
- issue and discussion features reflect the desired support surface;
- repository description, topics, and social preview accurately represent LORE;
- no release, package, or deployment automation can publish merely because visibility changed.

## Publication decision

Visibility should change only after the owner records the selected license and an exact-head reviewer records one of these outcomes:

- `VERIFIED_PUBLICATION_READY`
- `REMEDIATION_REQUIRED`
- `PUBLICATION_BLOCKED`

The visibility change itself should identify the exact verified commit. Any subsequent commit requires a new publication assessment before the first public release announcement.
