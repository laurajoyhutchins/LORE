# LORE Design Specification

**Status:** Approved  
**Date:** 2026-07-28  
**Name:** LORE, “LORE Organizes Repository Evidence”  
**Repository:** `laurajoyhutchins/LORE`

## 1. Executive summary

LORE is an agent-neutral, Git-backed documentation system for software repositories. It combines deterministic facts extracted from source code with reviewed semantic records that describe architectural intent, decisions, constraints, findings, and operating procedures. From those authoritative inputs, LORE generates human-readable documentation and bounded task context for humans or arbitrary LLM-based maintainers.

LORE does not require a particular model, agent identity, orchestration framework, memory system, or hosting provider. Its only agent-side assumption is that some human or LLM-based maintainer can read an included skill and return a proposal conforming to a public schema.

LORE is self-hosting. Its first complete demonstration is the LORE repository itself. LORE’s own records describe its purpose, architecture, contracts, constraints, known limitations, and maintenance process. Its generated README and supporting documentation are projections of those records. `lore verify-self` proves that the repository’s facts, records, skills, transactions, projections, and task hydration remain internally coherent and deterministic.

## 2. Product claim

> LORE is an agent-neutral, Git-backed documentation system that converts repository evidence and reviewed semantic records into human documentation and bounded agent context. LORE uses the same machinery to document and explain itself.

## 3. Goals

LORE must:

1. Preserve repository documentation as reviewable, versioned Git state.
2. Separate deterministically extracted facts from interpretive semantic knowledge.
3. Let arbitrary humans or LLM-based maintainers propose documentation changes through a stable, public protocol.
4. Prevent maintainers from directly rewriting accepted semantic history.
5. Ground factual and architectural claims in repository evidence.
6. Generate useful human documentation from authoritative inputs.
7. Generate bounded, explainable task context using progressive disclosure.
8. Explain semantic changes between repository revisions.
9. Bootstrap another repository without requiring a specific agent system.
10. Describe, maintain, and verify itself using its own mechanisms.
11. Produce byte-stable output when authoritative inputs have not changed.
12. Fail closed when evidence, identity, history, or revision invariants cannot be proven.

## 4. Non-goals for the first usable release

The first usable release will not:

- Run or host an LLM.
- Choose an LLM provider.
- Implement autonomous scheduling or orchestration.
- Require embeddings or a vector database.
- Provide a hosted multi-tenant service.
- Replace source control review.
- Infer architectural intent solely from code.
- Generate every Diátaxis document type.
- Support every programming language through full AST extraction.
- Guarantee semantic correctness merely because a proposal is structurally valid.
- Treat generated prose as authoritative knowledge.
- Maintain cross-repository federation.
- Provide a browser UI.

These may be added later without changing the core trust model.

## 5. Terminology

**Manifest**  
The repository-level `lore.yaml` file that declares the LORE schema version, repository identity, paths, projections, and enabled extractors.

**Extracted fact**  
Replaceable, deterministic information derived from repository contents, such as components, files, package scripts, imports, tests, and configuration.

**Semantic record**  
Reviewed, durable knowledge that cannot be safely inferred from syntax alone, such as a decision, constraint, finding, procedure, or component responsibility.

**Evidence reference**  
A commit-relative reference to a repository path and optionally a symbol or line range supporting a fact or semantic assertion.

**Projection**  
Generated human- or machine-readable output derived from the manifest, extracted facts, semantic records, and accepted transactions.

**Task context**  
A bounded, deterministic selection of records, evidence, commands, and related components relevant to a defined task.

**Maintainer**  
Any human or LLM-based actor assigned to inspect repository changes and propose documentation updates.

**Skill**  
An included, provider-neutral procedural document explaining how a maintainer should perform documentation maintenance and format its output.

**Proposal**  
Untrusted maintainer output describing candidate record additions, supersessions, or status transitions.

**Transaction**  
A validated and accepted proposal recorded as durable repository history.

**Bootstrap kernel**  
The minimal hand-authored trust root needed before LORE can describe itself.

## 6. Design principles

### 6.1 Agent neutrality

Validation depends on proposal contents, evidence, schemas, and repository state. It must not depend on a blessed agent name, persona, model vendor, cartridge format, hidden memory, or orchestration identity.

Producer metadata is optional descriptive provenance. It is never authorization.

### 6.2 Git is the durable store

Authoritative records, accepted transactions, schemas, skills, configuration, and generated projections are committed to Git. Git supplies review, history, reconstruction, branching, and collaboration.

LORE does not require an external database in the first release.

### 6.3 Facts and interpretation remain distinct

Deterministic extractors may replace their own outputs. Accepted semantic records are append-only. This prevents regenerated syntax facts from silently rewriting architectural intent.

### 6.4 Proposals are untrusted

A maintainer may produce a proposal but may not directly mutate accepted records, accepted transactions, or generated documentation. LORE validates and applies proposed operations.

### 6.5 Evidence precedes assertion

Every semantic record must contain at least one evidence reference unless its kind explicitly supports repository-level policy evidence, in which case the evidence must reference a manifest, schema, skill, accepted record, or other versioned repository artifact.

### 6.6 History is superseded, not erased

Accepted semantic record revisions are immutable. A correction or changed decision appends a new revision and points to the prior revision through `supersedes`.

Status transitions are recorded through new revisions or accepted transaction events. History remains reconstructable at every Git commit.

### 6.7 Generated prose is a view

Generated Markdown is useful but non-authoritative. The source of truth is the combination of source code, configuration, schemas, extracted facts, accepted semantic records, and accepted transactions.

### 6.8 Retrieval must be explainable

Task hydration uses explicit scoring and stable tie-breaking. Every selected record reports why it was included. Embeddings may later improve recall but may not become the sole selection mechanism.

### 6.9 Self-hosting is an acceptance criterion

LORE is not complete merely because it can process a toy fixture. It must use its own records, skill, projections, transactions, and verification commands to explain itself.

## 7. High-level architecture

```text
                        ┌──────────────────────────────┐
                        │ Repository source and config │
                        └──────────────┬───────────────┘
                                       │
                              deterministic extract
                                       │
                        ┌──────────────▼───────────────┐
                        │      Extracted facts         │
                        └──────────────┬───────────────┘
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
     ┌────────▼────────┐      ┌────────▼────────┐      ┌────────▼────────┐
     │ Semantic records│      │ Included skill │      │ Accepted history │
     └────────┬────────┘      └────────┬────────┘      └────────┬────────┘
              │                        │                        │
              │              arbitrary maintainer             │
              │                        │                        │
              │               ┌────────▼────────┐               │
              │               │ Untrusted       │               │
              │               │ proposal        │               │
              │               └────────┬────────┘               │
              │                        │                        │
              └────────────────────────▼────────────────────────┘
                              validate and apply
                                       │
                 ┌─────────────────────┼─────────────────────┐
                 │                     │                     │
        ┌────────▼────────┐   ┌────────▼────────┐   ┌────────▼────────┐
        │ Human docs      │   │ Task context    │   │ Semantic diff  │
        │ projections     │   │ hydration       │   │ and explain    │
        └─────────────────┘   └─────────────────┘   └─────────────────┘
```

## 8. Bootstrap trust boundary

A self-describing system requires a small seed. LORE declares this seed rather than disguising it.

The bootstrap kernel consists of:

- `lore.yaml`
- `BOOTSTRAP.md`
- schemas under `schemas/`
- the provider-neutral maintenance skill under `skills/`
- the implementation that parses, validates, projects, hydrates, and verifies
- the first reviewed self-description records

After initialization, all human-facing orientation documentation other than `BOOTSTRAP.md` is generated from authoritative inputs.

`BOOTSTRAP.md` must explain:

1. Which files form the trust root.
2. Which files are generated.
3. How to verify the system.
4. How to recover generated outputs.
5. How to propose a semantic change.
6. Why accepted history is append-only.
7. Which limitations remain hand-authored.

## 9. Repository layout

```text
lore/
├── README.md
├── BOOTSTRAP.md
├── lore.yaml
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vitest.config.ts
│
├── skills/
│   └── maintain-repository-documentation/
│       ├── SKILL.md
│       ├── INPUTS.md
│       ├── OUTPUTS.md
│       ├── examples/
│       │   ├── add-decision.yaml
│       │   ├── resolve-finding.yaml
│       │   └── no-documentation-change.yaml
│       └── schemas/
│           └── proposal.schema.json
│
├── schemas/
│   ├── manifest.schema.json
│   ├── record.schema.json
│   ├── proposal.schema.json
│   ├── task.schema.json
│   ├── hydration.schema.json
│   ├── extracted-facts.schema.json
│   └── transaction.schema.json
│
├── .lore/
│   ├── extracted/
│   │   ├── repository.yaml
│   │   ├── scripts.yaml
│   │   ├── components.yaml
│   │   ├── relationships.yaml
│   │   └── tests.yaml
│   ├── records/
│   │   ├── repository/
│   │   ├── component/
│   │   ├── relationship/
│   │   ├── decision/
│   │   ├── finding/
│   │   ├── constraint/
│   │   └── procedure/
│   ├── proposals/
│   ├── transactions/
│   └── snapshots/
│
├── docs/
│   ├── superpowers/
│   │   ├── specs/
│   │   └── plans/
│   └── generated/
│       ├── architecture.md
│       ├── component-catalog.md
│       ├── current-decisions.md
│       ├── maintainer-guide.md
│       └── repository-card.md
│
├── src/
│   ├── cli/
│   ├── config/
│   ├── domain/
│   ├── extraction/
│   ├── records/
│   ├── evidence/
│   ├── validation/
│   ├── proposals/
│   ├── transactions/
│   ├── projection/
│   ├── hydration/
│   ├── diff/
│   └── verification/
│
├── fixtures/
│   ├── repositories/
│   ├── invalid-records/
│   ├── invalid-proposals/
│   └── tasks/
│
└── tests/
    ├── unit/
    ├── integration/
    ├── invariants/
    └── self-hosting/
```

## 10. Manifest

`lore.yaml` is the root discovery and configuration file.

Initial shape:

```yaml
schema_version: 1

repository:
  id: lore
  name: LORE
  root: .

paths:
  extracted: .lore/extracted
  records: .lore/records
  proposals: .lore/proposals
  transactions: .lore/transactions
  generated_docs: docs/generated
  skills: skills

extractors:
  - id: repository-metadata
    enabled: true
  - id: package-scripts
    enabled: true
  - id: typescript-modules
    enabled: true
  - id: typescript-imports
    enabled: true
  - id: vitest-tests
    enabled: true

projections:
  - id: readme
    output: README.md
  - id: repository-card
    output: docs/generated/repository-card.md
  - id: architecture
    output: docs/generated/architecture.md
  - id: component-catalog
    output: docs/generated/component-catalog.md
  - id: current-decisions
    output: docs/generated/current-decisions.md
  - id: maintainer-guide
    output: docs/generated/maintainer-guide.md

maintenance:
  skill: skills/maintain-repository-documentation/SKILL.md
  proposal_schema: schemas/proposal.schema.json

hydration:
  max_records: 20
  max_characters: 40000
```

The manifest schema is versioned. Every loaded manifest is validated against it before use, and unknown schema versions fail closed. Extractor IDs may appear only once; duplicate or contradictory entries are invalid.

## 11. Stable identity and references

Every record has:

- a stable `id`
- a `kind`
- a positive integer `revision`
- a canonical reference

Record storage path:

```text
.lore/records/<kind>/<id>/<revision>.yaml
```

Example:

```text
.lore/records/decision/decision.git-backed-storage/1.yaml
.lore/records/decision/decision.git-backed-storage/2.yaml
```

Canonical reference:

```text
lore://<repository-id>/<kind>/<id>@<revision>
```

Example:

```text
lore://lore/decision/decision.git-backed-storage@2
```

The combination of repository ID, kind, record ID, and revision is unique.

Record IDs use lower-case dotted identifiers. Revisions are strictly monotonic per record ID and may not be reused.

## 12. Semantic record model

All record kinds share one envelope:

```yaml
schema_version: 1

id: decision.git-backed-storage
kind: decision
revision: 1
status: active

title: Git is the durable knowledge store
summary: >
  LORE stores accepted semantic records, transactions, schemas, skills,
  and generated projections in Git.

scope:
  repository: lore
  components:
    - component.records
    - component.transactions

evidence:
  - revision: "<git-commit-sha>"
    path: lore.yaml
  - revision: "<git-commit-sha>"
    path: src/records/store.ts
    symbol: FileRecordStore

disclosure:
  audiences:
    - architecture
    - maintainer
  tags:
    - git
    - storage
    - history
  weight: 90

provenance:
  source: bootstrap
  transaction: null
  producer: human-reviewed

supersedes: null

payload:
  rationale:
    - Git already supplies reviewable history and reconstruction.
  consequences:
    - Accepted record files are immutable.
    - Generated documentation is checked into Git.
```

Required envelope fields:

- `schema_version`
- `id`
- `kind`
- `revision`
- `status`
- `title`
- `summary`
- `scope`
- `evidence`
- `disclosure`
- `provenance`
- `supersedes`
- `payload`

### 12.1 Initial record kinds

**repository**  
Purpose, boundaries, primary language, entry points, and support status.

**component**  
Responsibilities, owned paths, public interfaces, dependencies, and invariants.

**relationship**  
A typed connection between records or extracted components.

**decision**  
A chosen design, rationale, consequences, alternatives, and status.

**finding**  
A verified limitation, defect, risk, or technical-debt item with severity and disposition.

**constraint**  
A rule that must remain true, including compatibility, safety, platform, or process boundaries.

**procedure**  
A repeatable workflow, prerequisites, commands, expected results, and failure handling.

Additional kinds require a schema version change or an extension mechanism added later.

### 12.2 Statuses

Common statuses:

- `draft`
- `active`
- `superseded`
- `deprecated`
- `resolved`
- `withdrawn`

Legal status combinations depend on record kind. The status stored in an accepted revision is immutable. Current or effective status is resolved from the revision graph: when a later revision supersedes an earlier revision, the earlier revision is treated as effectively `superseded` without editing its file. Other transitions append a new revision with the requested status and a `supersedes` reference.

## 13. Extracted facts

Extracted facts are generated under `.lore/extracted/` and may be replaced in place.

The first release extracts:

- repository metadata and package manager
- package scripts
- source files and TypeScript modules
- import relationships
- exported symbols
- Vitest test files and test names
- configuration files
- skill files
- schema files
- documentation projections

Each built-in extractor owns exactly one managed output:

- `repository-metadata` → `repository.yaml`
- `package-scripts` → `scripts.yaml`
- `typescript-modules` → `components.yaml`
- `typescript-imports` → `relationships.yaml`
- `vitest-tests` → `tests.yaml`

Extraction requirements:

1. Stable ordering.
2. Canonical repository-relative POSIX paths.
3. No timestamps in generated output.
4. No environment-specific absolute paths.
5. Same input tree produces byte-identical output.
6. Unsupported syntax is reported, not guessed.
7. Extracted facts identify their extractor and schema version.
8. Extractors do not create semantic records.

## 14. Evidence model

Evidence references use commit-relative paths and optional location hints.

```yaml
revision: 51d1d9761f66549dc0b9e244a8bd425a5b4a7fa9
path: src/transactions/validate.ts
symbol: validateProposal
lines:
  start: 42
  end: 118
```

Validation rules:

- `revision` must be a full commit SHA.
- `path` must exist at that revision.
- A line range must be valid for the referenced blob.
- A symbol is advisory in the first release but must be nonempty when provided.
- Evidence may refer to source, configuration, tests, schemas, skills, approved design specifications, or accepted records.
- Bootstrap component records may cite the approved design specification before implementation exists; later revisions should add implementation evidence.
- A record cannot cite generated prose as its sole evidence.
- Evidence from a different repository is not supported in the first release.

## 15. Neutral maintainer protocol

LORE provides a context artifact and expects a proposal artifact.

### 15.1 Maintainer context

```yaml
protocol: lore-maintainer-context/v1

assignment:
  id: docs-task-0042
  objective: Document transaction validation behavior.
  acceptance:
    - Explain fail-closed base revision handling.
    - Identify affected decisions or procedures.

repository:
  id: lore
  revision: "<full-git-sha>"
  manifest: lore.yaml

changes:
  base_revision: "<full-git-sha>"
  target_revision: "<full-git-sha>"
  changed_paths:
    - src/transactions/validate.ts
    - tests/transactions/validate.test.ts

context:
  extracted_fact_files:
    - .lore/extracted/components.yaml
  selected_records:
    - lore://lore/decision/decision.transaction-boundary@1
    - lore://lore/component/component.transaction-engine@1
  validation_commands:
    - pnpm test
    - pnpm lore validate

instructions:
  skill: skills/maintain-repository-documentation/SKILL.md
  output_schema: schemas/proposal.schema.json

output:
  destination: .lore/proposals/docs-task-0042.yaml
```

### 15.2 Maintainer proposal

```yaml
protocol: lore-proposal/v1

proposal_id: docs-task-0042
base_revision: "<full-git-sha>"

producer:
  type: llm
  name: optional-freeform-value
  model: optional-freeform-value

skill:
  path: skills/maintain-repository-documentation/SKILL.md
  digest: sha256:<digest>

result: changes_proposed

operations:
  - operation: append_record
    record:
      schema_version: 1
      id: decision.transaction-validation
      kind: decision
      revision: 1
      status: active
      title: Transaction validation fails closed
      summary: >
        LORE rejects stale or structurally invalid proposals before writing
        accepted records or generated projections.
      scope:
        repository: lore
        components:
          - component.transaction-engine
      evidence:
        - revision: "<full-git-sha>"
          path: src/transactions/validate.ts
          symbol: validateProposal
      disclosure:
        audiences:
          - architecture
          - maintainer
        tags:
          - transaction
          - validation
        weight: 85
      provenance:
        source: proposal
        transaction: null
        producer: arbitrary-maintainer
      supersedes: null
      payload:
        rationale:
          - Prevent partial or stale semantic updates.
        consequences:
          - Maintainers must regenerate stale proposals.

uncertainties: []
```

A proposal may instead report:

```yaml
result: no_documentation_change
reason: >
  The changed implementation preserves existing behavior, interfaces,
  architecture, constraints, and operating procedures.
```

LORE must treat a valid no-change result as a first-class outcome.

## 16. Included maintenance skill

The included skill is a public protocol, not a persona.

Required files:

- `SKILL.md`: complete procedure
- `INPUTS.md`: context artifact fields and evidence expectations
- `OUTPUTS.md`: proposal format and examples
- `examples/add-decision.yaml`
- `examples/resolve-finding.yaml`
- `examples/no-documentation-change.yaml`
- `schemas/proposal.schema.json`

The skill must instruct a maintainer to:

1. Read the supplied task and bounded context.
2. Inspect changed source and tests.
3. Distinguish extracted facts from semantic interpretation.
4. Reuse stable record identity where appropriate.
5. Append a new revision rather than modifying accepted history.
6. Attach evidence to each proposed assertion.
7. Avoid editing generated files.
8. Report uncertainty explicitly.
9. Return either a conforming proposal or a no-change result.
10. Fail closed when the base revision, evidence, or record identity is ambiguous.

The skill must not assume:

- a specific model
- a specific product
- hidden memory
- named agents
- orchestration queues
- network access
- GitHub access
- an ability to write directly to the repository

## 17. Proposal validation and transaction application

### 17.1 Validation sequence

LORE validates proposals in this order:

1. Parse YAML safely.
2. Validate proposal protocol version.
3. Validate proposal schema.
4. Confirm the repository is clean unless `--allow-dirty` is explicitly supplied for validation-only commands.
5. Load validation evidence and the referenced skill from `base_revision`; validation-only commands may inspect a historical proposal.
6. For transaction planning or application, confirm `base_revision` equals the current `HEAD`.
7. Confirm the referenced skill exists at `base_revision`.
8. Confirm the skill digest matches the skill bytes at `base_revision`.
9. Validate each proposed record schema.
10. Validate stable identity and next revision number.
11. Validate supersession references.
12. Validate status transitions.
13. Validate evidence references.
14. Validate cross-record references.
15. Check for conflicts with active decisions or constraints.
16. Construct the complete post-transaction state in memory.
17. Regenerate affected projections in memory.
18. Run semantic validation on the complete candidate state.
19. Report an application plan.
20. Write accepted record files and transaction receipt.
21. Write regenerated projections.
22. Verify the resulting working tree matches the candidate state.

Any failure before step 20 writes nothing.

A failure during steps 20–22 triggers rollback from a temporary backup. The command exits nonzero and records no accepted transaction.

### 17.2 Transaction receipt

Accepted transaction path:

```text
.lore/transactions/<timestamp>-<proposal-id>.yaml
```

The timestamp is derived from the source commit metadata or supplied explicitly in tests. It is never generated into deterministic projections.

Receipt fields:

```yaml
schema_version: 1
transaction_id: tx-<content-digest>
proposal_id: docs-task-0042
base_revision: "<sha>"
skill_digest: sha256:<digest>
proposal_digest: sha256:<digest>
operations_applied: 1
records_created:
  - lore://lore/decision/decision.transaction-validation@1
generated_outputs:
  - README.md
  - docs/generated/architecture.md
accepted_at: "2026-07-28T00:00:00Z"
```

`accepted_at` is historical transaction metadata. It must not affect projection determinism.

## 18. Projection system

The first release generates:

### 18.1 `README.md`

Purpose, key capabilities, installation, quick start, trust model, main commands, generated-file notice, and links to deeper projections.

### 18.2 Repository card

A concise orientation artifact with:

- purpose
- current version
- primary entry point
- major components
- important commands
- active constraints
- active findings
- documentation verification status

### 18.3 Architecture

Components, relationships, data flow, trust boundaries, decisions, and evidence links.

### 18.4 Component catalog

One section per active component record, including responsibilities, owned paths, dependencies, public interfaces, decisions, findings, and evidence.

### 18.5 Current decisions

All active decisions plus supersession links and current consequences.

### 18.6 Maintainer guide

How to generate context, follow the included skill, validate a proposal, apply a transaction, regenerate projections, and verify the repository.

Generated files begin with:

```markdown
<!-- Generated by LORE. Do not edit directly. -->
<!-- Sources: lore.yaml, .lore/extracted/, .lore/records/, .lore/transactions/ -->
```

Projection requirements:

- Stable record ordering.
- Stable heading generation.
- No current time.
- No environment-specific paths.
- No prose generated by a live LLM.
- Byte-identical output for unchanged authoritative inputs.
- `lore project --check` fails when checked-in projections are stale.

## 19. Task hydration

Task input:

```yaml
schema_version: 1
id: task.retry-recovery
title: Make recovery idempotent
description: Prevent duplicate side effects after a partial execution failure.
paths:
  - src/transactions/apply.ts
components:
  - component.transaction-engine
tags:
  - retry
  - recovery
  - idempotency
audiences:
  - runtime
history: false
```

Initial scoring:

```text
exact component match       +40
exact file match            +35
symbol match                +35
tag match                   +20 per distinct tag, capped at +40
direct dependency           +15
requested audience          +15
active decision             +10
active finding              +10
disclosure weight           +0 to +10
superseded record           -50
unrelated repository        -100
```

Selection rules:

1. Score all eligible records.
2. Exclude nonpositive scores.
3. Sort by descending score.
4. Break ties by canonical reference.
5. Include records until `max_records` or `max_characters` is reached.
6. Include direct evidence references and validation commands.
7. Report omitted record count.
8. Explain every selected record using machine-readable reasons.
9. Include superseded history only when `history: true`.

Hydration output supports YAML and Markdown. YAML is canonical; Markdown is a projection.

## 20. Semantic diff and explain

`lore diff <base> <target>` reports:

- added, superseded, deprecated, and resolved records
- changed extracted components and relationships
- evidence changes
- projection changes
- hydration changes for checked-in task fixtures
- active decision conflicts introduced or removed

`lore explain <record-ref>` reports:

- the selected revision
- current status
- supersession lineage
- scope
- evidence
- related components
- related decisions, findings, constraints, and procedures
- transactions that introduced or superseded it

Diff output is stable and supports text and JSON.

## 21. CLI

The first release exposes:

```text
lore init
lore extract
lore validate
lore project
lore context --task <task.yaml>
lore hydrate --task <task.yaml>
lore validate-proposal <proposal.yaml>
lore apply <proposal.yaml>
lore diff <base> <target>
lore explain <record-ref>
lore verify-self
lore demo
```

Global behavior:

- `--format text|json|yaml` where applicable
- `--root <path>` to select repository root
- `--check` for commands that compare generated state
- nonzero exit status on validation or freshness failure
- structured errors on stderr
- no network dependency for normal operation

Initial exit codes:

- `0`: success
- `1`: general failure
- `2`: invalid CLI usage
- `10`: schema validation failure
- `11`: semantic invariant failure
- `12`: stale base revision
- `13`: evidence failure
- `14`: stale generated output
- `15`: transaction rollback completed
- `16`: unsupported schema or protocol version

## 22. Self-hosting lifecycle

LORE reaches self-hosting in this order:

1. Hand-author the bootstrap kernel.
2. Add first reviewed semantic records describing LORE.
3. Implement deterministic extraction.
4. Generate LORE’s own README and supporting documentation.
5. Add a checked-in maintainer context fixture for a real LORE change.
6. Add a checked-in proposal conforming to the included skill.
7. Validate and apply the proposal.
8. Show the resulting semantic diff.
9. Verify task hydration before and after the change.
10. Run `lore verify-self`.
11. Run the complete sequence again and prove a clean Git diff.

The primary demo uses LORE itself. Small fixture repositories exist only for malformed inputs, language parsing, and adversarial tests.

## 23. `lore init`

`lore init` bootstraps another repository with:

- `lore.yaml`
- `BOOTSTRAP.md`
- the neutral maintenance skill
- schemas
- `.lore/records/` directories
- `.lore/extracted/` directories
- generated-document paths
- an initial repository record
- initial extracted facts
- a task asking a maintainer to complete semantic orientation
- CI instructions

It must not overwrite existing files without `--force`. With `--force`, it still refuses to overwrite accepted record or transaction history.

Initialization is deterministic for the same repository inputs and explicit repository ID.

## 24. Determinism requirements

LORE’s deterministic commands are:

- `extract`
- `validate`
- `project`
- `hydrate`
- `diff`
- `explain`
- `verify-self`

Determinism requires:

- sorted map keys
- normalized LF line endings
- UTF-8 output
- POSIX repository-relative paths
- stable YAML scalar and array formatting
- no wall-clock timestamps in extracted facts or projections
- no random identifiers
- content-derived transaction IDs
- explicit time injection in tests
- stable error ordering
- stable traversal order

A second complete run on unchanged inputs must leave the working tree clean.

## 25. Error handling

LORE reports errors with:

```json
{
  "code": "EVIDENCE_PATH_MISSING",
  "message": "Evidence path does not exist at the referenced revision.",
  "location": ".lore/records/decision/decision.transaction-validation/1.yaml",
  "record": "lore://lore/decision/decision.transaction-validation@1",
  "details": {
    "revision": "51d1...",
    "path": "src/missing.ts"
  }
}
```

Requirements:

- Errors have stable codes.
- Multiple errors are reported in stable order.
- Human output includes corrective guidance.
- JSON output contains no prose-only fields required for parsing.
- Validation commands do not modify the repository.
- Application failures report whether rollback succeeded.
- Unknown error states fail closed.

## 26. Security and safety

The first release must:

- Parse YAML without executing tags or constructors.
- Reject path traversal outside the repository root.
- Reject symlink escapes for writes.
- Never execute commands found in records or proposals.
- Treat validation commands as documentation, not executable input.
- Refuse to overwrite accepted history.
- Refuse application on a stale base revision.
- Bound file size and record count during parsing.
- Avoid network access during validation and projection.
- Escape generated Markdown where record content could alter structure unexpectedly.
- Make transaction writes only after full candidate-state validation.

LORE is not an authorization system. Repository permissions and code review remain external controls.

## 27. Technology choices

Initial implementation:

- Node.js 22 or newer
- TypeScript with strict mode
- pnpm
- Vitest
- Ajv for JSON Schema validation
- `yaml` for safe YAML parsing and stable output
- Node `util.parseArgs` for the CLI
- TypeScript compiler API for the initial TypeScript extractor
- no runtime database
- no required network service

The CLI package name and executable are `lore`.

## 28. Testing strategy

### Unit tests

- stable serialization
- canonical references
- manifest parsing
- schema validation
- scoring
- supersession traversal
- error ordering
- path normalization

### Integration tests

- extraction against fixture repositories
- projection generation
- proposal validation
- transaction application and rollback
- evidence resolution against Git revisions
- semantic diff
- initialization

### Invariant tests

- accepted records cannot be edited
- revisions are monotonic
- supersession cycles fail
- stale base revisions fail
- generated output is deterministic
- transaction failure writes nothing
- path traversal fails
- no-change proposals are accepted without churn

### Self-hosting tests

- LORE’s own manifest validates
- LORE’s extracted facts are current
- LORE’s self-description records validate
- generated README and docs are current
- the maintenance skill matches its recorded digest
- checked-in context and proposal fixtures validate
- hydration output is stable
- semantic diff fixtures are stable
- a second full run leaves no diff

## 29. CI contract

CI runs:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm lore extract --check
pnpm lore validate
pnpm lore project --check
pnpm lore verify-self
git diff --exit-code
```

CI fails for stale extracted facts, stale projections, invalid records, broken evidence, mutable history, nondeterministic output, or invalid transaction fixtures.

## 30. Initial self-description records

The bootstrap release includes at least:

```text
repository.lore
component.cli
component.config
component.extraction
component.records
component.evidence
component.validation
component.proposals
component.transactions
component.projection
component.hydration
component.semantic-diff
component.verification

relationship.cli-invokes-core
relationship.projections-read-records
relationship.transactions-append-records
relationship.hydration-selects-records

decision.git-backed-storage
decision.facts-versus-semantic-records
decision.agent-neutral-maintainer-protocol
decision.append-only-history
decision.proposals-are-untrusted
decision.explicit-hydration-scoring
decision.self-hosting-primary-demo

constraint.no-direct-maintainer-mutation
constraint.no-network-required
constraint.generated-prose-is-not-authoritative
constraint.deterministic-output

procedure.maintain-documentation
procedure.apply-proposal
procedure.verify-repository
procedure.bootstrap-repository

finding.bootstrap-kernel-is-hand-authored
```

## 31. Release acceptance criteria

The first usable release is complete only when:

1. A clean checkout installs without network access beyond package installation.
2. `lore extract` deterministically describes the LORE source tree.
3. LORE’s semantic records validate.
4. LORE generates its own README and required documentation.
5. The included neutral maintenance skill is complete and independently usable.
6. A checked-in arbitrary-maintainer proposal validates and applies.
7. Accepted semantic history cannot be edited through LORE.
8. Evidence references resolve at exact commits.
9. Task hydration is bounded, deterministic, and explained.
10. Semantic diff explains a real LORE change.
11. `lore init` bootstraps a separate fixture repository.
12. `lore verify-self` passes.
13. Re-running extraction, projection, hydration fixtures, and verification produces no diff.
14. CI enforces all preceding conditions.

## 32. Deferred extensions

Potential later work:

- Python, Go, Rust, and C# extractors
- symbol-level evidence verification
- cross-repository canonical references
- full-text index
- graph traversal
- embeddings as secondary recall
- a web interface
- pull-request integrations
- automatic documentation-impact task creation
- signed transaction receipts
- policy extensions for regulated repositories
- pluggable projection templates
- Diátaxis-specific projection packs

These extensions must preserve agent neutrality, append-only accepted history, evidence grounding, deterministic core behavior, and self-hosting verification.
