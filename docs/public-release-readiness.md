# Public release readiness

This document records the evidence and unresolved gates for changing the GitHub repository visibility from private to public. It is a release ledger, not a declaration that the repository is already ready.

## Scope

The initial publication target is the source repository. npm publication is a separate decision. `package.json` intentionally retains `"private": true` to prevent an accidental package release.

Private execution archives, package stores, runtime binaries, and dependency capsules remain outside this repository.

## Completed preparation

- The owner approved Apache License 2.0 for LORE on July 29, 2026. The complete canonical license text is committed in `LICENSE`, package metadata declares `Apache-2.0`, and contribution terms use the adopted license.
- The generated README has a substantive public-facing introduction, setup path, trust model, workflow, documentation map, contribution guidance, security guidance, and license disclosure.
- Repository metadata, security policy, contribution guide, code of conduct, pull-request template, bug-report form, and Dependabot configuration are present.
- CI has read-only repository permissions, full-history checkout, concurrency cancellation, and a bounded timeout.
- Source fixes from the successful clean-room verification patch are promoted, with bounded YAML alias expansion and narrowly scoped lint exceptions.
- Private orchestration names and internal execution speculation were removed from public source and pull-request discussion.
- An initial connected-GitHub disclosure review found no obvious credentials, private keys, personal machine paths, private orchestration material, package stores, private archives, or intentional runtime binaries in the reviewed current content and commit messages.
- The publication security scan identified and remediated repository path-indirection, Git revision-handling, and initialization defects. The durable report is `docs/security/publication-scan-2026-07-29.md`.
- Real-filesystem tests cover linked repository roots, linked files and directories, guarded reads and writes, extraction, proposals, and initialization.
- Git tests cover exact revision resolution, option-shaped revisions, invalid object paths, and semantic-diff failure behavior.
- `scripts/import-verified-lockfile.mjs` imports the private capsule lockfile only when both its SHA-256 and Git blob identity match the verified artifact.
- `scripts/public-release-gate.mjs` performs the full-history disclosure scan, current-tree provenance checks, exact lockfile verification, dependency restoration, typecheck, lint, tests, build, deterministic LORE checks, and clean-tree verification.
- The two release scripts pass Node syntax checking in the execution environment used for this preparation.

## Current status

Current outcome: `REMEDIATION_IMPLEMENTED_NOT_VERIFIED`.

The security remediations are committed but have not executed against the final publication head. Do not merge PR #2 or change repository visibility until the unified gate emits `VERIFIED_PUBLICATION_READY` for the same commit.

## Remaining gates

### 1. Import and commit the exact verified lockfile

The exact clean-room lockfile remains in the private offline capsule at:

```text
offline-execution/capsules/lore/465e4174cd4c61c9d45ccbfb4a4565c813cfb964/artifacts/pnpm-lock.yaml
```

From the LORE checkout, import it without transcription:

```bash
node scripts/import-verified-lockfile.mjs <path-to-private-capsule-pnpm-lock.yaml>
```

The importer requires both identities:

```text
SHA-256: e5e1747bac45b623c375226759fce20857b50ee615926dce1aefd282104ee57d
Git blob: 7aec11b06bef06188262e0ca8ae44b8e35f158c9
```

Review and commit the resulting `pnpm-lock.yaml`. A visually similar or regenerated lockfile does not close this gate without new independent verification.

### 2. Refresh and commit deterministic generated state

After committing the lockfile, run:

```bash
corepack pnpm release:refresh
```

Review the generated changes under `.lore/extracted/`, `README.md`, `docs/generated/`, and any affected snapshots. Commit only deterministic outputs that correspond to the authoritative source and record changes.

### 3. Run the exact-head publication gate

Fetch every reachable ref, start from a clean checkout, and run:

```bash
git fetch --all --tags --prune
corepack pnpm release:verify
```

The gate will:

- verify the exact lockfile identity;
- scan reachable Git history for sensitive filenames and high-confidence secret patterns;
- reject tracked symbolic links and unreviewed binary files;
- report commit email identities that will become public;
- restore dependencies using the frozen lockfile;
- run typecheck, lint, tests, build, extraction checks, repository validation, projection checks, and LORE self-verification; and
- require a clean working tree.

Record the complete output and exact commit SHA. The only passing publication result is:

```text
VERIFIED_PUBLICATION_READY <exact-head-sha>
```

### 4. Review disclosure output and stale refs

Review every commit email printed by the gate and confirm that it is acceptable for public disclosure.

Review all local and remote branches and tags returned by:

```bash
git for-each-ref --format='%(refname) %(objectname)' refs/heads refs/remotes refs/tags
```

Delete stale private-development refs or explicitly accept their reachable history before changing visibility. The connected branch-listing surface did not reliably enumerate every branch, so this must be completed from the trusted clone.

### 5. Confirm public repository settings

At publication, confirm:

- private vulnerability reporting is enabled;
- Dependabot alerts and security updates are enabled;
- secret scanning and push protection are enabled when available;
- the default branch is `main`;
- branch protection or rulesets require the unified CI gate;
- workflow permissions default to read-only;
- force pushes and deletion are restricted for `main`;
- issue and discussion features match the intended support surface;
- repository description, topics, and social preview accurately represent LORE; and
- no release, package, or deployment automation can publish merely because visibility changes.

## Publication decision

The license gate is closed. The current publication decision remains `REMEDIATION_IMPLEMENTED_NOT_VERIFIED` until exact-head execution closes every remaining gate.

Any commit after `VERIFIED_PUBLICATION_READY` requires a new exact-head run before the first public announcement or visibility change.