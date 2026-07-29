# Public release readiness

This document records the evidence and unresolved gates for changing the GitHub repository visibility from private to public. npm publication is a separate decision, and `package.json` intentionally retains `"private": true`.

## Completed preparation

- Apache License 2.0 is adopted with the canonical license text, SPDX package metadata, and aligned contribution terms.
- The generated README, repository metadata, security policy, contribution guide, code of conduct, issue and pull-request templates, and Dependabot configuration are present.
- CI checks out full history, uses read-only repository permissions, cancels redundant runs, and invokes the unified publication gate.
- Repository path-indirection, Git revision-handling, initialization, strict-schema, nested-test extraction, exact historical-byte reading, JavaScript linting, and generated-state convergence defects are remediated with regressions.
- The approved pnpm 10.14.0 lockfile is stored as eight independently checksummed gzip members under `artifacts/verified-lockfile/`. Their manifest records each member identity and the reconstructed lockfile's exact byte count, SHA-256, and Git blob ID.
- `scripts/restore-verified-lockfile.mjs` reconstructs the standard `pnpm-lock.yaml` only after every committed member passes its byte-count, SHA-256, and Git-object checks. It refuses a different existing destination.
- `scripts/public-release-gate.mjs` restores the approved lockfile, scans reachable history and the current tree, reports public commit identities, installs the frozen graph, runs every code and LORE verification command, removes a gate-created lockfile, and requires a clean tree.
- A network-isolated VM restore installed 162 packages with zero downloads and passed typecheck, lint, 29 tests, build, extraction checks, repository validation, projection checks, and every self-verification category on the intended release tree.
- The temporary public artifact ferry was returned to its original tree and closed without merge. No LORE source, lockfile, store, or transport workflow remains in that product branch.

## Approved lockfile identity

```text
raw bytes: 62769
SHA-256: e5e1747bac45b623c375226759fce20857b50ee615926dce1aefd282104ee57d
Git blob: 7aec11b06bef06188262e0ca8ae44b8e35f158c9
```

A visually similar lockfile does not satisfy the release contract. The committed member manifest and the reconstructed file must match all three values.

## Exact-head publication gate

From a clean checkout with every reachable ref fetched:

```bash
git fetch --all --tags --prune
corepack pnpm release:verify
```

The only passing result is:

```text
VERIFIED_PUBLICATION_READY <unchanged-exact-head-sha>
```

Any commit after that result requires another complete run.

## Remaining publication decisions

Before changing visibility:

1. Review every commit email printed by the gate and accept it for public disclosure.
2. Review all branches and tags, deleting stale private-development refs or explicitly accepting their reachable history.
3. Confirm private vulnerability reporting, Dependabot alerts and security updates, secret scanning and push protection when available, read-only workflow defaults, and protection of `main`.
4. Confirm repository description, topics, social preview, issue and discussion surfaces, and that no publication or deployment can occur merely because visibility changes.

## Decision rule

Merge and visibility changes remain blocked until exact-head evidence records `VERIFIED_PUBLICATION_READY` and the repository-setting review is complete.