# LORE publication security scan

Date: July 29, 2026

Status: `REMEDIATION_IMPLEMENTED_EXACT_HEAD_VERIFICATION_PENDING`

This report covers the source repository proposed for public visibility in PR #2. It does not authorize npm publication or publication of private offline execution capsules.

## Scope

The scan reviewed repository source, schemas, tests, generated documentation, maintenance protocols, GitHub configuration, filesystem and Git trust boundaries, current tracked paths, known pull-request discussion, indexed content, reachable commit messages, license provenance, and the publication workflow. Repository documents, paths, revisions, tasks, proposals, evidence references, and transaction targets were treated as untrusted.

## Findings and remediation

### LORE-PUB-001: Repository boundary escape through path indirection

Severity: High impact with a local attack precondition.

Lexical containment could still follow a symbolic-link component outside the selected repository. Remediation centralizes lexical and real-filesystem containment, rejects linked roots and components, creates directories component by component, guards authoritative reads and writes, protects transaction backup and rollback paths, detects normalized collisions, and excludes LORE's backup namespace. Cross-platform filesystem regressions cover roots, files, directories, reads, writes, extraction, proposals, and initialization.

### LORE-PUB-002: Untrusted Git revision option handling

Severity: Medium.

Option-shaped or malformed revisions could alter Git interpretation, and semantic diff assumed a repository identifier. Remediation rejects invalid revision input, resolves revisions to exact commit IDs, validates Git object paths, bounds subprocess time and output, preserves exact historical file bytes, and derives matching repository identities from both historical manifests.

### LORE-PUB-003: Initialization template and force semantics

Severity: Low security impact; material public usability defect.

Clean initialization could source templates from the target repository and did not consistently honor `--force`. Templates now come only from LORE's source or built package root, destinations use containment helpers, existing files are preserved by default, and replacement requires explicit force.

### LORE-PUB-004: Self-hosting and release convergence defects

Severity: Release-integrity defect.

Strict schemas did not compile their own contracts, nested Vitest declarations were omitted, Git historical reads trimmed exact bytes, JavaScript release scripts entered the TypeScript project lint lane, and generated snapshots embedded volatile `HEAD` values. These defects are remediated with strict-schema, extraction, byte-preservation, lint-lane, and deterministic-snapshot regressions.

### LORE-PUB-005: Exact dependency graph transport

Severity: Release-integrity control.

The approved lockfile could not be safely transcribed through the connected environment. It is now committed as eight content-addressed gzip members. Restoration verifies every member and the reconstructed lockfile's 62,769-byte length, SHA-256 `e5e1747bac45b623c375226759fce20857b50ee615926dce1aefd282104ee57d`, and Git blob `7aec11b06bef06188262e0ca8ae44b8e35f158c9`. Tampering, overwrite refusal, and idempotency are covered by regressions.

## Verification performed

A networked public runner independently reproduced the approved lockfile identities and packaged the official pnpm 10.14.0 executable plus Linux x64 store. The artifact was downloaded into the VM, all bridge checksums passed, and pnpm restored 162 packages offline with zero downloads.

The intended release tree passed:

- typecheck;
- lint;
- 10 Vitest files and 29 tests;
- production build;
- deterministic extraction check;
- repository validation;
- deterministic projection check;
- LORE self-verification for manifest, extraction, records, evidence, skill, proposals, projections, hydration, history, and determinism; and
- final clean-tree verification after removing the reconstructed lockfile.

The temporary ferry branch was reset to its original product tree and closed without merge.

## Disclosure and provenance results

Connected-GitHub searches found no obvious credentials, private keys, personal machine paths, private orchestration material, private archives, package stores, or intentional runtime binaries in reviewed current content and commit messages. Known pull-request discussion was sanitized to evidence-only wording. Apache License 2.0 is committed using canonical text. The committed gzip members are explicitly allowlisted by manifest identity; arbitrary tracked binaries remain rejected by the gate.

A complete visibility decision still requires the exact final-head gate, review of every public commit identity and reachable ref, and confirmation of repository security settings.

## Decision

Current outcome: `REMEDIATION_IMPLEMENTED_EXACT_HEAD_VERIFICATION_PENDING`.

Do not merge PR #2 or change repository visibility until the unchanged exact head emits `VERIFIED_PUBLICATION_READY` and the public-setting review is recorded.