# LORE Repository Guidance

## Purpose

LORE, “LORE Organizes Repository Evidence,” is an agent-neutral, Git-backed system for transforming repository evidence and reviewed semantic knowledge into deterministic facts, append-only semantic records, immutable transaction receipts, generated documentation, bounded task context, and semantic revision comparisons.

## Non-goals

Do not turn LORE into an LLM host, agent runtime, scheduler, memory database, vector database, generic documentation generator, issue tracker, multi-tenant service, authorization system based on agent identity, or system that treats generated prose as authoritative knowledge.

## Trust model

```text
repository source and configuration -> deterministic extracted facts
reviewed semantic knowledge -> append-only semantic records
untrusted proposal -> validation -> transaction plan -> atomic apply -> immutable receipt
facts + records + receipts -> generated projections, hydration, diff, and explanation
```

- Repository source owns facts that can be proven deterministically.
- `lore.yaml` owns repository-level LORE configuration.
- Extracted facts are replaceable projections and must not contain unsupported intent.
- Accepted semantic records own reviewed knowledge that syntax cannot establish safely.
- Accepted records and receipts are append-only; supersede rather than overwrite.
- Proposals are untrusted input. Producer identity is descriptive, never authorizing.
- Generated Markdown and hydration output are non-authoritative projections.
- Git review remains the acceptance boundary after LORE prepares changes.

## Core invariants

- Evidence resolves against exact full Git SHAs and historical bytes.
- Path reads and writes remain inside the intended repository, including after symlink resolution.
- Validation, planning, and application are distinct phases.
- Planning is deterministic and mutation-free.
- Apply revalidates preconditions and fails cleanly without partial accepted history.
- Records have stable IDs, monotonic revisions, explicit supersession, and no cycles.
- Generated output is byte-stable where claimed and converges under check mode.
- Hydration is bounded, deterministic, explainable, and revision-specific.
- Internal TypeScript modules are not automatically a supported package API; the documented CLI is the public surface.
- Self-hosting proves mechanical coherence, not semantic truth without human review.

## Simplification

Code generation is cheap. Prefer fewer concepts, schemas, commands, generated files, compatibility paths, and duplicated validators. Remove ceremony that does not strengthen evidence, exact revision identity, append-only history, path safety, atomic transactions, determinism, or explainability.

## Skill routing

Read the current `using-lauras-skills` guidance first. Use `architecture-review` for trust boundaries, `ontology-design` for record semantics, `typescript-idiomatic` for implementation, `data-engineering-design` for extraction and receipts, `api-philosophy` for CLI and file protocols, `repo-config-governance` for package and release rules, and the testing, debugging, review, and verification skills for delivery.

## Working method

- Inspect bootstrap files, manifests, schemas, records, receipts, extracted facts, projections, CLI commands, release tooling, downstream adopters, open PRs, and recent decisions before editing.
- Use an isolated branch or worktree.
- Use test-driven development for behavioral changes.
- Do not edit accepted records, receipts, extracted facts, or generated documents directly. Use the LORE proposal and transaction workflow.
- Regenerate through repository-owned commands.
- Record compatibility and downstream migration impact.

## Testing

Verify manifest and bootstrap behavior, deterministic extraction, record invariants, historical evidence, proposal validation, transaction planning, atomic application, append-only history, projection convergence, bounded hydration, semantic diff and explanation, path and Git safety, CLI output and exit codes, self-hosting, offline lockfile restoration, package allowlists, installed-package smoke tests, and security against malicious repository input.

## Release and publication

Repository merge, npm publication, bootstrap version, stable release, tags, dist-tags, and downstream adoption are separate owner-controlled actions. Do not publish, tag, upload, or modify registry state without explicit authority. Release gates must operate on an exact clean head and package one canonical artifact.

## Verification

Use the repository-authoritative Node and pnpm versions. Restore the verified lockfile, install frozen dependencies, run typecheck, lint, tests, build, CLI smoke checks, extraction check, validation, projection check, self-verification, package inspection, installed-tarball smoke, and offline clean-room checks where the cache is available. Report precise limitations rather than calling ordinary online installation offline verification.

## Git and completion

Open a draft PR for substantive work. Keep its exact head SHA, trust-model changes, schemas, semantic records, receipts, projections, compatibility, deterministic and offline verification, package evidence, owner-controlled actions not performed, and downstream follow-up current. Do not merge stale or unverified heads. Any new commit invalidates exact-head clearance.
