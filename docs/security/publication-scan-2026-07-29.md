# LORE publication security scan

Date: July 29, 2026

Status: `REMEDIATION_IMPLEMENTED_NOT_VERIFIED`

This report covers the source repository proposed for public visibility in PR #2. It does not cover npm publication, private offline execution capsules, or third-party systems that may invoke LORE.

## Scope

The scan reviewed:

- repository source, schemas, tests, generated documentation, maintenance protocols, and GitHub configuration;
- filesystem and Git trust boundaries reachable from the CLI and exported library functions;
- current tracked paths, known pull-request discussion, indexed current content, and reachable commit messages for disclosure indicators;
- license and obvious redistribution provenance;
- the publication workflow and its ability to reproduce exact-head evidence.

The scan treated repository documents, paths, Git revisions, source files, task files, proposals, and transaction targets as untrusted input.

## Findings

### LORE-PUB-001: Repository boundary escape through path indirection

Severity: High impact with a local attack precondition.

Several repository reads and writes checked lexical path containment but could still follow a symbolic-link component. A user running LORE against an adversarial or unexpectedly linked repository could cause reads or mutations outside the selected repository root.

Remediation implemented on `release/public-readiness`:

- centralized lexical and real-filesystem containment helpers;
- rejection of symbolic-link repository roots and linked path components;
- component-by-component directory creation;
- guarded manifest, schema, task, proposal, record, extracted-fact, skill, snapshot, and receipt reads;
- guarded extraction, projection, initialization, transaction, backup, verification, rollback, and receipt writes;
- normalized transaction collision detection and exclusion of LORE's backup namespace;
- cross-platform real-filesystem regression tests for roots, files, directories, reads, writes, extraction, proposals, and initialization.

Verification status: implementation and tests are committed, but the exact PR head has not executed the complete test and build gate.

### LORE-PUB-002: Untrusted Git revision option handling

Severity: Medium.

Git revisions supplied to semantic history operations were passed to Git without first resolving them to exact commit IDs. Although commands used `execFile` rather than a shell, option-shaped or malformed revision input could alter Git command interpretation. Semantic diff also assumed the repository ID `lore` rather than deriving and comparing it from both revisions.

Remediation implemented on `release/public-readiness`:

- rejection of empty, option-shaped, newline-containing, and NUL-containing revision arguments;
- resolution of revisions to exact 40-character commit IDs before use;
- validation of repository tree paths used in Git object expressions;
- bounded Git subprocess time and output;
- repository identity derived from both historical manifests and required to match;
- regression tests for ordinary revisions, option-shaped input, invalid object paths, and semantic-diff failure behavior.

Verification status: implementation and tests are committed, but the exact PR head has not executed the complete test and build gate.

### LORE-PUB-003: Initialization template and force semantics

Severity: Low security impact; material public usability defect.

`lore init` could treat the target working directory as its template source and did not consistently honor the force option. This made clean installation behavior dependent on files already present in the repository being initialized.

Remediation implemented on `release/public-readiness`:

- templates are loaded only from LORE's own source or built package root;
- destination paths use the repository containment helpers;
- existing files are preserved by default and replaced only when force is enabled;
- initialization, preservation, force replacement, and linked-destination behavior have regression tests.

Verification status: implementation and tests are committed, but the exact PR head has not executed the complete test and build gate.

## Disclosure and provenance results

No obvious credential, private-key, personal-machine-path, or private-orchestration disclosure was found in the indexed current-content and commit-message searches performed through the connected GitHub surface.

Known pull-request discussion was reviewed. Internal execution speculation in the superseded verification PR was replaced with evidence-only wording.

The current repository inventory contains source, schemas, text fixtures, documentation, GitHub configuration, and package metadata. No intentional runtime binaries, package stores, private repository archives, images, or private offline capsules belong in the public tree. Apache License 2.0 is committed using the canonical license text, and package metadata identifies `Apache-2.0`.

These are bounded negative results. The connected GitHub surface does not provide a complete historical secret-scanning or repository-archive interface, so the full-history byte scan remains an execution gate rather than a completed claim.

## Publication gate added

`scripts/public-release-gate.mjs` and the `release:verify` package script now require one reproducible command to:

1. verify the exact approved `pnpm-lock.yaml` SHA-256 and Git blob identity;
2. scan every reachable Git ref for sensitive filenames and high-confidence secret patterns;
3. reject tracked symbolic links and unreviewed binary files;
4. report commit email identities that will become public;
5. restore dependencies with the frozen lockfile;
6. run typecheck, lint, tests, build, deterministic extraction and projection checks, repository validation, and LORE self-verification;
7. require a clean working tree; and
8. emit `VERIFIED_PUBLICATION_READY` bound to the exact commit only after every gate passes.

CI checks out full history and invokes the same gate.

## Remaining blockers

Publication remains blocked until all of the following are complete:

1. Copy the exact verified lockfile from the private offline capsule. It must have SHA-256 `e5e1747bac45b623c375226759fce20857b50ee615926dce1aefd282104ee57d` and Git blob SHA `7aec11b06bef06188262e0ca8ae44b8e35f158c9`.
2. Run `corepack pnpm release:refresh`, review the deterministic generated changes, and commit them.
3. Run `corepack pnpm release:verify` from a clean checkout with all refs fetched.
4. Review the commit email identities printed by the gate and confirm that each is acceptable for public disclosure.
5. Remove or deliberately retain stale non-publication branches after reviewing their reachable history.
6. Confirm public repository security settings, including private vulnerability reporting, Dependabot alerts, secret scanning, push protection when available, read-only workflow permissions, and protection of `main`.

## Decision

Current outcome: `REMEDIATION_IMPLEMENTED_NOT_VERIFIED`.

Do not merge PR #2 or change repository visibility until the exact-head gate emits `VERIFIED_PUBLICATION_READY` and that result is recorded against the same commit.