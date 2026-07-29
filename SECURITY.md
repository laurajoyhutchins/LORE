# Security Policy

## Supported versions

LORE is pre-1.0 software. Security fixes are applied to the latest commit on `main`; older revisions are not maintained as supported release lines.

## Reporting a vulnerability

Please do not disclose suspected vulnerabilities in a public issue, pull request, discussion, or commit message.

Use GitHub's private vulnerability-reporting or security-advisory flow for this repository. Include the affected revision, the smallest reproducible input, the observed impact, and any relevant operating-system or Node.js details. Avoid including unrelated repository contents, credentials, or personal data.

A report is especially useful when it identifies the untrusted input, the violated invariant, and the filesystem, Git, parser, validation, or transaction boundary involved.

## System and scope

LORE is a local, agent-neutral TypeScript CLI and library for extracting deterministic repository facts, validating reviewed semantic records, generating documentation projections, hydrating bounded task context, validating untrusted maintenance proposals, and applying accepted changes transactionally through Git-backed state.

The security boundary covers:

- the CLI and exported library code under `src/`;
- repository manifests, schemas, semantic records, proposals, tasks, transactions, generated projections, and extracted facts;
- filesystem and Git operations performed while processing a repository;
- the included maintenance skill and its public proposal protocol.

LORE does not host an LLM, provide a network service, execute autonomous schedules, or treat a maintainer identity, model name, or orchestration system as authorization.

## Threat model and trust boundaries

Treat repository contents and maintainer outputs as untrusted. This includes YAML and JSON documents, paths, Git revisions, evidence references, proposal operations, source files inspected by extractors, and generated-output locations.

Important assets are the integrity of the target repository, accepted semantic history, transaction receipts, evidence provenance, generated documentation, and files outside the repository root.

Git, the local operating system, and the explicitly selected repository root are trusted only to the extent required to perform local verification. A clean Git checkout is not proof that repository contents are safe to parse.

## Security invariants

The following properties must hold:

1. Paths derived from repository content remain inside the selected repository root. Traversal, absolute-path escape, and symlink-based escape must fail closed.
2. Untrusted YAML, JSON, manifests, records, tasks, and proposals are parsed with bounded behavior and validated against the applicable schema before use.
3. Proposal contents and producer metadata never grant authority. Mutations occur only after structural, semantic, evidence, revision, and transaction validation succeeds.
4. Evidence references resolve against the exact claimed Git revision and cannot be satisfied solely by generated documentation.
5. Accepted semantic history is append-only. Supersession creates new durable state rather than rewriting accepted records.
6. Transaction planning is side-effect free. Application is atomic from the repository's perspective, detects stale bases, records durable receipts, and rolls back partial filesystem changes on failure.
7. Generated outputs are deterministic projections and are never treated as authoritative inputs.
8. Repository content cannot cause LORE to execute arbitrary commands, load executable configuration, or access the network merely by being parsed, extracted, validated, projected, or hydrated.
9. Resource use for parsing, Git reads, traversal, hydration, and diffing remains bounded enough that ordinary malformed input cannot trivially exhaust the host.
10. Verification fails closed when a required schema, skill, evidence target, revision, generated output, or invariant cannot be proven.

## Reportable findings and severity context

Report findings that show a realistic path to repository escape, unintended file mutation, command execution, integrity loss, history or evidence forgery, validation bypass, unsafe deserialization, denial of service from ordinary untrusted input, or disclosure of repository data beyond the explicitly selected root.

Severity depends on reachability and impact. A defect reachable only through an already trusted maintainer editing source code is generally less severe than the same defect reachable through an untrusted proposal or repository document.

## Out of scope and known limitations

The following are not security guarantees:

- semantic correctness of a structurally valid human or model-authored proposal;
- confidentiality of a repository after an authorized user intentionally provides it to another tool or model;
- vulnerabilities in Git, Node.js, the operating system, or third-party packages without a LORE-specific reachable impact;
- security of arbitrary commands a user independently runs before or after LORE;
- backwards compatibility before the first stable release.

Generated prose is non-authoritative. Human review remains part of the bootstrap trust root and the acceptance of semantic changes.