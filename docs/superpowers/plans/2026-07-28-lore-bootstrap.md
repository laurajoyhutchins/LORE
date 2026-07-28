# LORE Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first self-hosting release of LORE, an agent-neutral, Git-backed documentation system that describes, maintains, and verifies its own repository documentation.

**Architecture:** LORE uses a deterministic TypeScript core to extract repository facts, validate immutable semantic records, validate and apply untrusted maintainer proposals, generate documentation projections, hydrate bounded task context, and explain semantic history. The LORE repository is the primary end-to-end fixture: its own manifest, skill, records, projections, proposal fixtures, and verification command prove the system.

**Tech Stack:** Node.js 22+, TypeScript strict mode, pnpm, Vitest, Ajv, `yaml`, Node `util.parseArgs`, TypeScript compiler API, Git CLI invoked through a bounded process adapter.

## Global Constraints

- The public name is **LORE: LORE Organizes Repository Evidence**.
- LORE must remain neutral to model provider, agent identity, orchestration framework, and hosting environment.
- A human or arbitrary LLM-based maintainer reads an included skill and returns a schema-conforming proposal.
- Maintainer proposals are untrusted and cannot directly mutate accepted semantic records, accepted transactions, or generated documentation.
- Extracted facts are replaceable; accepted semantic record revisions are immutable and append-only.
- Corrections and changed decisions append a new revision with `supersedes`; accepted history is never rewritten.
- Git is the durable store. No runtime database or required network service is permitted.
- The bootstrap kernel is explicit: `lore.yaml`, `BOOTSTRAP.md`, schemas, the included maintenance skill, implementation code, and first reviewed self-description records.
- LORE’s own repository is the primary happy-path demonstration.
- Generated prose is a projection and is not authoritative knowledge.
- Deterministic commands use stable ordering, UTF-8, LF endings, POSIX repository-relative paths, and no wall-clock values.
- Normal validation, projection, hydration, diff, explain, and self-verification require no network access.
- Node.js 22 or newer is required.
- TypeScript must use strict mode.
- Use test-driven development. Each task ends with an independently testable commit.
- No task may introduce embeddings, a vector database, a browser UI, multi-repository federation, or live LLM execution.

---

## Planned file map

```text
.
├── BOOTSTRAP.md                         # Hand-authored trust-root explanation
├── README.md                            # Generated repository orientation
├── lore.yaml                            # Root manifest
├── package.json
├── pnpm-lock.yaml
├── tsconfig.json
├── vitest.config.ts
├── eslint.config.js
├── schemas/
│   ├── manifest.schema.json
│   ├── record.schema.json
│   ├── proposal.schema.json
│   ├── task.schema.json
│   ├── hydration.schema.json
│   ├── extracted-facts.schema.json
│   └── transaction.schema.json
├── skills/maintain-repository-documentation/
│   ├── SKILL.md
│   ├── INPUTS.md
│   ├── OUTPUTS.md
│   ├── examples/
│   │   ├── add-decision.yaml
│   │   ├── resolve-finding.yaml
│   │   └── no-documentation-change.yaml
│   └── schemas/proposal.schema.json
├── .lore/
│   ├── extracted/
│   ├── records/
│   ├── proposals/
│   ├── transactions/
│   └── snapshots/
├── docs/generated/
│   ├── architecture.md
│   ├── component-catalog.md
│   ├── current-decisions.md
│   ├── maintainer-guide.md
│   └── repository-card.md
├── src/
│   ├── index.ts
│   ├── cli/main.ts
│   ├── cli/output.ts
│   ├── config/load-manifest.ts
│   ├── domain/types.ts
│   ├── domain/references.ts
│   ├── domain/errors.ts
│   ├── serialization/yaml.ts
│   ├── filesystem/repository-paths.ts
│   ├── git/git-client.ts
│   ├── schemas/schema-registry.ts
│   ├── records/load-records.ts
│   ├── records/validate-records.ts
│   ├── evidence/validate-evidence.ts
│   ├── extraction/extract.ts
│   ├── extraction/repository-metadata.ts
│   ├── extraction/package-scripts.ts
│   ├── extraction/typescript-modules.ts
│   ├── extraction/vitest-tests.ts
│   ├── projection/project.ts
│   ├── projection/templates.ts
│   ├── hydration/score.ts
│   ├── hydration/hydrate.ts
│   ├── proposals/validate-proposal.ts
│   ├── transactions/plan-transaction.ts
│   ├── transactions/apply-transaction.ts
│   ├── diff/semantic-diff.ts
│   ├── explain/explain-record.ts
│   ├── init/initialize.ts
│   ├── verification/verify-self.ts
│   └── demo/run-demo.ts
├── fixtures/
│   ├── repositories/minimal-typescript/
│   ├── invalid-records/
│   ├── invalid-proposals/
│   └── tasks/
└── tests/
    ├── unit/
    ├── integration/
    ├── invariants/
    └── self-hosting/
```

## Core public interfaces

The following names and signatures are fixed for this plan. Later tasks must consume them exactly.

```ts
export interface LoreManifest {
  schema_version: 1;
  repository: { id: string; name: string; root: string };
  paths: {
    extracted: string;
    records: string;
    proposals: string;
    transactions: string;
    generated_docs: string;
    skills: string;
  };
  extractors: Array<{ id: string; enabled: boolean }>;
  projections: Array<{ id: ProjectionId; output: string }>;
  maintenance: { skill: string; proposal_schema: string };
  hydration: { max_records: number; max_characters: number };
}

export type RecordKind =
  | "repository"
  | "component"
  | "relationship"
  | "decision"
  | "finding"
  | "constraint"
  | "procedure";

export type RecordStatus =
  | "draft"
  | "active"
  | "superseded"
  | "deprecated"
  | "resolved"
  | "withdrawn";

export interface EvidenceReference {
  revision: string;
  path: string;
  symbol?: string;
  lines?: { start: number; end: number };
}

export interface SemanticRecord {
  schema_version: 1;
  id: string;
  kind: RecordKind;
  revision: number;
  status: RecordStatus;
  title: string;
  summary: string;
  scope: { repository: string; components: string[] };
  evidence: EvidenceReference[];
  disclosure: {
    audiences: string[];
    tags: string[];
    weight: number;
  };
  provenance: {
    source: "bootstrap" | "proposal";
    transaction: string | null;
    producer: string;
  };
  supersedes: string | null;
  payload: Record<string, unknown>;
}

export interface LoreTask {
  schema_version: 1;
  id: string;
  title: string;
  description: string;
  paths: string[];
  components: string[];
  tags: string[];
  audiences: string[];
  history: boolean;
}

export interface HydratedRecord {
  reference: string;
  score: number;
  reasons: string[];
  record: SemanticRecord;
}

export interface HydrationPacket {
  schema_version: 1;
  task: LoreTask;
  repository_revision: string;
  selected: HydratedRecord[];
  evidence: EvidenceReference[];
  validation_commands: string[];
  omitted_record_count: number;
}

export interface ValidationProblem {
  code: string;
  message: string;
  location?: string;
  record?: string;
  details?: Record<string, unknown>;
}

export type ValidationResult<T> =
  | { ok: true; value: T; warnings: ValidationProblem[] }
  | { ok: false; errors: ValidationProblem[] };

export interface LoreProposal {
  protocol: "lore-proposal/v1";
  proposal_id: string;
  base_revision: string;
  producer?: { type?: string; name?: string; model?: string };
  skill: { path: string; digest: string };
  result: "changes_proposed" | "no_documentation_change";
  reason?: string;
  operations: ProposalOperation[];
  uncertainties: string[];
}

export type ProposalOperation =
  | { operation: "append_record"; record: SemanticRecord }
  | {
      operation: "transition_record";
      record_id: string;
      from: RecordStatus;
      to: RecordStatus;
      evidence: EvidenceReference[];
    };

export interface TransactionPlan {
  proposal: LoreProposal;
  recordsToCreate: Array<{ path: string; record: SemanticRecord }>;
  transactionReceiptPath: string;
  generatedOutputs: Map<string, string>;
}

export type ProjectionId =
  | "readme"
  | "repository-card"
  | "architecture"
  | "component-catalog"
  | "current-decisions"
  | "maintainer-guide";
```

---

### Task 1: Initialize the TypeScript package and CLI shell

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `eslint.config.js`
- Create: `.gitignore`
- Create: `src/index.ts`
- Create: `src/cli/main.ts`
- Create: `src/cli/output.ts`
- Create: `tests/unit/cli/main.test.ts`

**Interfaces:**
- Produces: `runCli(argv: string[], io?: CliIo): Promise<number>`
- Produces: executable `lore`
- Consumes: none

- [ ] **Step 1: Write the failing CLI help test**

```ts
import { describe, expect, it, vi } from "vitest";
import { runCli, type CliIo } from "../../../src/cli/main.js";

describe("runCli", () => {
  it("prints stable help for --help", async () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    const io: CliIo = { stdout, stderr };

    const exitCode = await runCli(["--help"], io);

    expect(exitCode).toBe(0);
    expect(stderr).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      expect.stringContaining("LORE Organizes Repository Evidence"),
    );
    expect(stdout).toHaveBeenCalledWith(
      expect.stringContaining("verify-self"),
    );
  });

  it("returns usage failure for an unknown command", async () => {
    const stdout = vi.fn();
    const stderr = vi.fn();

    const exitCode = await runCli(["not-a-command"], { stdout, stderr });

    expect(exitCode).toBe(2);
    expect(stderr).toHaveBeenCalledWith(
      expect.stringContaining("Unknown command: not-a-command"),
    );
  });
});
```

- [ ] **Step 2: Create package and compiler configuration**

Use these scripts:

```json
{
  "name": "lore",
  "version": "0.0.0",
  "private": true,
  "packageManager": "pnpm@10.14.0",
  "type": "module",
  "bin": {
    "lore": "./dist/cli/main.js"
  },
  "engines": {
    "node": ">=22"
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "lore": "tsx src/cli/main.ts"
  },
  "dependencies": {
    "ajv": "^8.17.1",
    "yaml": "^2.8.1"
  },
  "devDependencies": {
    "@eslint/js": "^9.31.0",
    "@types/node": "^22.17.0",
    "eslint": "^9.31.0",
    "tsx": "^4.20.3",
    "typescript": "^5.9.2",
    "typescript-eslint": "^8.38.0",
    "vitest": "^3.2.4"
  }
}
```

Use `module` and `moduleResolution` equal to `NodeNext`, `target` equal to `ES2023`, `strict: true`, `noUncheckedIndexedAccess: true`, and `exactOptionalPropertyTypes: true`.

- [ ] **Step 3: Implement the minimal CLI shell**

`src/cli/main.ts` must use `node:util` `parseArgs`, expose the fixed command names, and dispatch unimplemented commands to a stable `NOT_IMPLEMENTED` error without throwing uncaught exceptions.

```ts
export interface CliIo {
  stdout(message: string): void;
  stderr(message: string): void;
}

export async function runCli(
  argv: string[],
  io: CliIo = {
    stdout: (message) => process.stdout.write(`${message}\n`),
    stderr: (message) => process.stderr.write(`${message}\n`),
  },
): Promise<number>;
```

Include commands:

```text
init
extract
validate
project
context
hydrate
validate-proposal
apply
diff
explain
verify-self
demo
```

- [ ] **Step 4: Run the focused test**

Run:

```bash
pnpm test tests/unit/cli/main.test.ts
```

Expected: both tests pass.

- [ ] **Step 5: Run package verification**

Run:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Expected: all commands exit `0`.

- [ ] **Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml tsconfig.json vitest.config.ts eslint.config.js .gitignore src tests
git commit -m "chore: initialize LORE TypeScript CLI"
```

---

### Task 2: Implement domain types, errors, references, and stable YAML

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/errors.ts`
- Create: `src/domain/references.ts`
- Create: `src/serialization/yaml.ts`
- Create: `src/filesystem/repository-paths.ts`
- Create: `tests/unit/domain/references.test.ts`
- Create: `tests/unit/serialization/yaml.test.ts`
- Create: `tests/unit/filesystem/repository-paths.test.ts`

**Interfaces:**
- Produces: all core interfaces listed in “Core public interfaces”
- Produces: `recordReference(repositoryId, record): string`
- Produces: `parseRecordReference(value): ParsedRecordReference`
- Produces: `stableYaml(value): string`
- Produces: `parseYamlDocument<T>(content, location): ValidationResult<T>`
- Produces: `resolveInsideRoot(root, candidate): ValidationResult<string>`
- Consumes: none

- [ ] **Step 1: Write failing canonical-reference tests**

```ts
it("formats a canonical record reference", () => {
  expect(
    recordReference("lore", {
      id: "decision.git-backed-storage",
      kind: "decision",
      revision: 2,
    }),
  ).toBe("lore://lore/decision/decision.git-backed-storage@2");
});

it("rejects an invalid canonical reference", () => {
  expect(() => parseRecordReference("lore://lore/decision/no revision"))
    .toThrowError("INVALID_RECORD_REFERENCE");
});
```

- [ ] **Step 2: Write failing stable-YAML tests**

```ts
it("sorts map keys and preserves array order", () => {
  const output = stableYaml({
    z: 1,
    a: { d: 4, c: 3 },
    values: ["second", "first"],
  });

  expect(output).toBe(
    [
      "a:",
      "  c: 3",
      "  d: 4",
      "values:",
      "  - second",
      "  - first",
      "z: 1",
      "",
    ].join("\n"),
  );
});

it("uses LF endings", () => {
  expect(stableYaml({ a: 1 })).not.toContain("\r");
});
```

- [ ] **Step 3: Write failing repository-path tests**

```ts
it("normalizes a path inside the root", () => {
  const result = resolveInsideRoot("/repo", "src\\index.ts");
  expect(result).toEqual({ ok: true, value: "/repo/src/index.ts", warnings: [] });
});

it("rejects path traversal", () => {
  const result = resolveInsideRoot("/repo", "../secret");
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors[0]?.code).toBe("PATH_OUTSIDE_ROOT");
});
```

- [ ] **Step 4: Implement types and errors**

Define the interfaces exactly as listed above. Add:

```ts
export class LoreError extends Error {
  constructor(
    readonly problem: ValidationProblem,
    options?: ErrorOptions,
  ) {
    super(problem.message, options);
    this.name = "LoreError";
  }
}
```

Add stable error-code constants for:

```text
INVALID_YAML
INVALID_RECORD_REFERENCE
PATH_OUTSIDE_ROOT
UNSUPPORTED_SCHEMA_VERSION
SCHEMA_VALIDATION_FAILED
SEMANTIC_INVARIANT_FAILED
STALE_BASE_REVISION
EVIDENCE_PATH_MISSING
GENERATED_OUTPUT_STALE
TRANSACTION_ROLLED_BACK
```

- [ ] **Step 5: Implement stable YAML and safe parsing**

Use `YAML.parseDocument` with custom tags disabled. Reject parse errors and aliases exceeding a conservative limit. Recursively sort object keys before stringification. Preserve array order and normalize the final newline.

- [ ] **Step 6: Run focused tests**

```bash
pnpm test tests/unit/domain tests/unit/serialization tests/unit/filesystem
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/domain src/serialization src/filesystem tests/unit/domain tests/unit/serialization tests/unit/filesystem
git commit -m "feat: add deterministic LORE domain primitives"
```

---

### Task 3: Add schemas, manifest loading, and schema registry

**Files:**
- Create: `schemas/manifest.schema.json`
- Create: `schemas/record.schema.json`
- Create: `schemas/proposal.schema.json`
- Create: `schemas/task.schema.json`
- Create: `schemas/hydration.schema.json`
- Create: `schemas/extracted-facts.schema.json`
- Create: `schemas/transaction.schema.json`
- Create: `src/schemas/schema-registry.ts`
- Create: `src/config/load-manifest.ts`
- Create: `lore.yaml`
- Create: `tests/unit/config/load-manifest.test.ts`
- Create: `tests/unit/schemas/schema-registry.test.ts`
- Create: `fixtures/invalid-records/unknown-kind.yaml`

**Interfaces:**
- Consumes: `parseYamlDocument`, `LoreManifest`, `ValidationResult`
- Produces: `createSchemaRegistry(): SchemaRegistry`
- Produces: `validateWithSchema<T>(schemaId, value): ValidationResult<T>`
- Produces: `loadManifest(root: string): Promise<ValidationResult<LoreManifest>>`

- [ ] **Step 1: Write failing manifest-loading tests**

```ts
it("loads the repository manifest", async () => {
  const result = await loadManifest(process.cwd());
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.value.repository.id).toBe("lore");
    expect(result.value.maintenance.skill)
      .toBe("skills/maintain-repository-documentation/SKILL.md");
  }
});

it("fails closed on an unsupported schema version", async () => {
  const root = await copyFixture("manifest-version-2");
  const result = await loadManifest(root);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    expect(result.errors[0]?.code).toBe("UNSUPPORTED_SCHEMA_VERSION");
  }
});
```

- [ ] **Step 2: Author complete JSON Schemas**

Use Draft 2020-12. Set `additionalProperties: false` at every protocol envelope where extension is not explicitly allowed. Enforce:

- lower-case dotted record IDs
- full 40-character lowercase hexadecimal commit SHAs
- positive integer revisions
- disclosure weight from `0` through `100`
- nonempty evidence arrays
- legal enum values
- proposal `reason` required when `result` is `no_documentation_change`
- proposal operations nonempty when `result` is `changes_proposed`
- proposal operations empty when `result` is `no_documentation_change`

- [ ] **Step 3: Implement the schema registry**

Compile all schemas once with Ajv. Convert Ajv errors to stable `ValidationProblem` objects sorted by instance path, schema path, and keyword.

- [ ] **Step 4: Create the initial `lore.yaml`**

Use the exact manifest shape from the design specification. Enable repository metadata, TypeScript imports, package scripts, and Vitest tests. Configure all six projections and hydration limits of 20 records and 40,000 characters.

- [ ] **Step 5: Run focused tests**

```bash
pnpm test tests/unit/config tests/unit/schemas
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add schemas src/schemas src/config lore.yaml tests/unit/config tests/unit/schemas fixtures
git commit -m "feat: define LORE schemas and manifest"
```

---

### Task 4: Implement Git access, record loading, semantic invariants, and evidence validation

**Files:**
- Create: `src/git/git-client.ts`
- Create: `src/records/load-records.ts`
- Create: `src/records/validate-records.ts`
- Create: `src/evidence/validate-evidence.ts`
- Create: `tests/unit/git/git-client.test.ts`
- Create: `tests/unit/records/validate-records.test.ts`
- Create: `tests/integration/evidence/validate-evidence.test.ts`
- Create: `fixtures/invalid-records/supersession-cycle/`
- Create: `fixtures/invalid-records/missing-evidence/`
- Create: `fixtures/invalid-records/non-monotonic-revision/`

**Interfaces:**
- Consumes: manifest, schemas, record references, repository paths
- Produces: `GitClient`
- Produces: `loadRecords(root, manifest): Promise<ValidationResult<SemanticRecord[]>>`
- Produces: `validateRecordSet(records, repositoryId): ValidationResult<SemanticRecord[]>`
- Produces: `validateEvidence(root, evidence, git): Promise<ValidationResult<EvidenceReference[]>>`

Define:

```ts
export interface GitClient {
  head(): Promise<string>;
  isClean(): Promise<boolean>;
  fileExistsAtRevision(revision: string, path: string): Promise<boolean>;
  readFileAtRevision(revision: string, path: string): Promise<string>;
  commitTimestamp(revision: string): Promise<string>;
}
```

- [ ] **Step 1: Write failing record invariant tests**

Cover:

```ts
it("rejects duplicate record revisions");
it("rejects non-monotonic revisions");
it("rejects a supersession target that does not exist");
it("rejects supersession cycles");
it("derives the prior revision effective status as superseded without editing its file");
it("sorts all reported problems deterministically");
```

- [ ] **Step 2: Write failing evidence tests against a temporary Git repository**

Create a temporary Git repository in the test. Commit `src/example.ts`, then assert:

- existing path succeeds
- missing path returns `EVIDENCE_PATH_MISSING`
- invalid line range returns `EVIDENCE_LINE_RANGE_INVALID`
- a non-full SHA fails schema validation before Git invocation

- [ ] **Step 3: Implement the bounded Git adapter**

Use `node:child_process` `execFile`, never a shell string. Set:

- command timeout: 10 seconds
- maximum stdout: 10 MiB
- working directory: repository root
- allowed commands only through explicit methods

Normalize all returned SHAs to lowercase. Reject nonzero exit status with stable errors.

- [ ] **Step 4: Implement record loading**

Recursively read only:

```text
.lore/records/<kind>/<id>/<positive-integer>.yaml
```

Reject symlink escapes, files in unexpected locations, and filename/envelope mismatches. Stable-sort by kind, ID, and revision.

- [ ] **Step 5: Implement semantic validation**

Validate:

- uniqueness
- path identity
- repository scope
- monotonic revisions
- legal `supersedes`
- no cycles
- legal declared statuses and derived effective statuses
- referenced components exist
- active decision conflicts when two active decisions use the same `payload.exclusivity_key`

- [ ] **Step 6: Implement evidence validation**

Resolve each evidence path at its exact commit. Validate line ranges. Do not attempt symbol resolution in this release; preserve and report symbol names.

- [ ] **Step 7: Run focused tests**

```bash
pnpm test tests/unit/git tests/unit/records tests/integration/evidence
```

Expected: all tests pass.

- [ ] **Step 8: Commit**

```bash
git add src/git src/records src/evidence tests fixtures/invalid-records
git commit -m "feat: validate immutable records and repository evidence"
```

---

### Task 5: Author the bootstrap kernel, neutral maintenance skill, and LORE self-description records

**Files:**
- Create: `BOOTSTRAP.md`
- Create: `skills/maintain-repository-documentation/SKILL.md`
- Create: `skills/maintain-repository-documentation/INPUTS.md`
- Create: `skills/maintain-repository-documentation/OUTPUTS.md`
- Create: `skills/maintain-repository-documentation/examples/add-decision.yaml`
- Create: `skills/maintain-repository-documentation/examples/resolve-finding.yaml`
- Create: `skills/maintain-repository-documentation/examples/no-documentation-change.yaml`
- Create: `skills/maintain-repository-documentation/schemas/proposal.schema.json`
- Create: `.lore/records/**` for the initial self-description set
- Create: `tests/self-hosting/bootstrap-kernel.test.ts`
- Create: `tests/self-hosting/self-records.test.ts`

**Interfaces:**
- Consumes: record schema and record-set validator
- Produces: the provider-neutral maintainer protocol
- Produces: initial records listed in section 30 of the design specification

- [ ] **Step 1: Write the failing bootstrap completeness test**

```ts
it("contains the declared bootstrap trust root", async () => {
  const required = [
    "BOOTSTRAP.md",
    "lore.yaml",
    "schemas/manifest.schema.json",
    "schemas/record.schema.json",
    "schemas/proposal.schema.json",
    "skills/maintain-repository-documentation/SKILL.md",
    "skills/maintain-repository-documentation/INPUTS.md",
    "skills/maintain-repository-documentation/OUTPUTS.md",
  ];

  for (const path of required) {
    await expect(access(path)).resolves.toBeUndefined();
  }
});
```

- [ ] **Step 2: Write the failing neutrality test**

Read all files under the included skill and assert that they do not contain case-insensitive references to:

```text
Seshat
cartridge
heartbeat
OpenAI
Anthropic
Claude
ChatGPT
Codex
Hatchable
```

The examples may use `producer.type: llm`, but no vendor or orchestration identity.

- [ ] **Step 3: Write `BOOTSTRAP.md`**

It must explain:

- the trust-root files
- authoritative versus generated content
- append-only accepted records
- proposal workflow
- verification workflow
- recovery of generated files
- the hand-authored bootstrap limitation

Use only commands that will exist by the end of this plan.

- [ ] **Step 4: Author the neutral maintenance skill**

`SKILL.md` must contain explicit sections:

```text
Purpose
Required inputs
Evidence standard
Documentation-impact analysis
Record identity and revision rules
Allowed outputs
No-change outcome
Prohibited actions
Failure conditions
Submission checklist
```

It must instruct maintainers to return exactly one proposal artifact and never edit generated docs or accepted history.

- [ ] **Step 5: Author exact input and output references**

`INPUTS.md` defines `lore-maintainer-context/v1`.  
`OUTPUTS.md` defines `lore-proposal/v1`.

Each example must validate against `schemas/proposal.schema.json`.

Copy the root proposal schema byte-for-byte into the skill schema path in this task. A later test verifies the copies remain identical.

- [ ] **Step 6: Add the initial self-description records**

Create one revision for every record listed in design section 30. Evidence must refer to the exact bootstrap commit that introduces the relevant source or trust-root artifact. Component records for not-yet-implemented modules cite the approved design specification initially; later self-hosting transactions supersede them with implementation evidence.

Because the commit SHA is unknown before commit, perform this task in two commits:

1. Commit the skill and bootstrap files.
2. Capture that exact commit SHA.
3. Create self-description records citing the bootstrap commit.
4. Commit the records.

Every record path must follow:

```text
.lore/records/<kind>/<id>/1.yaml
```

- [ ] **Step 7: Validate the self-record set**

Run:

```bash
pnpm test tests/self-hosting/bootstrap-kernel.test.ts tests/self-hosting/self-records.test.ts
```

Expected: all records load, schemas pass, evidence paths resolve, and neutrality checks pass.

- [ ] **Step 8: Commit the records**

```bash
git add .lore/records tests/self-hosting
git commit -m "docs: add LORE self-description records"
```

---

### Task 6: Implement deterministic extraction and checked-in extracted facts

**Files:**
- Create: `src/extraction/extract.ts`
- Create: `src/extraction/repository-metadata.ts`
- Create: `src/extraction/package-scripts.ts`
- Create: `src/extraction/typescript-modules.ts`
- Create: `src/extraction/vitest-tests.ts`
- Create: `tests/unit/extraction/*.test.ts`
- Create: `tests/integration/extraction/extract.test.ts`
- Create: `fixtures/repositories/minimal-typescript/**`
- Generate: `.lore/extracted/repository.yaml`
- Generate: `.lore/extracted/components.yaml`
- Generate: `.lore/extracted/relationships.yaml`
- Generate: `.lore/extracted/tests.yaml`

**Interfaces:**
- Consumes: manifest, stable YAML, repository paths
- Produces:

```ts
export interface ExtractionResult {
  files: Map<string, string>;
  warnings: ValidationProblem[];
}

export async function extractRepository(
  root: string,
  manifest: LoreManifest,
): Promise<ValidationResult<ExtractionResult>>;
```

- [ ] **Step 1: Write failing stable-extraction tests**

Assert:

- two consecutive runs return byte-identical maps
- paths use `/`, even on Windows
- files are sorted
- no absolute root path appears
- no timestamp appears
- package scripts are sorted by key
- TypeScript imports become stable relationships
- Vitest test names are extracted

- [ ] **Step 2: Implement repository metadata extraction**

Output:

```yaml
schema_version: 1
extractor: repository-metadata
repository:
  id: lore
  name: LORE
  package_manager: pnpm
  languages:
    - TypeScript
```

Derive language names from tracked file extensions. Exclude `.git`, `node_modules`, `dist`, and configured generated paths.

- [ ] **Step 3: Implement package-script extraction**

Read `package.json`; output sorted script names and commands. Do not execute scripts.

- [ ] **Step 4: Implement TypeScript module extraction**

Use the TypeScript compiler API to collect:

- module path
- exported names
- relative imports
- imported package names

Unsupported parse diagnostics become warnings with file paths. Do not infer semantic components.

- [ ] **Step 5: Implement Vitest extraction**

Collect test file paths and literal `describe`, `it`, and `test` names. Ignore dynamically computed names and report them as warnings.

- [ ] **Step 6: Implement `lore extract` and `--check`**

Without `--check`, write all generated extracted-fact files.  
With `--check`, compare the in-memory result to disk and exit `14` if stale.

- [ ] **Step 7: Generate LORE’s own facts**

Run:

```bash
pnpm lore extract
pnpm lore extract --check
```

Expected: first command writes four files; second exits `0`.

- [ ] **Step 8: Run tests and commit**

```bash
pnpm test tests/unit/extraction tests/integration/extraction
git add src/extraction tests fixtures/repositories .lore/extracted src/cli/main.ts
git commit -m "feat: extract deterministic repository facts"
```

---

### Task 7: Implement semantic validation and deterministic documentation projections

**Files:**
- Create: `src/validation/validate-repository.ts`
- Create: `src/projection/project.ts`
- Create: `src/projection/templates.ts`
- Create: `tests/integration/validation/validate-repository.test.ts`
- Create: `tests/integration/projection/project.test.ts`
- Create: `tests/invariants/projection-determinism.test.ts`
- Generate: `README.md`
- Generate: `docs/generated/repository-card.md`
- Generate: `docs/generated/architecture.md`
- Generate: `docs/generated/component-catalog.md`
- Generate: `docs/generated/current-decisions.md`
- Generate: `docs/generated/maintainer-guide.md`

**Interfaces:**
- Consumes: manifest, extracted facts, records, evidence validation
- Produces:

```ts
export async function validateRepository(
  root: string,
): Promise<ValidationResult<ValidatedRepository>>;

export async function projectRepository(
  repository: ValidatedRepository,
): Promise<ValidationResult<Map<string, string>>>;
```

- [ ] **Step 1: Write failing repository-validation tests**

Cover:

- valid LORE repository succeeds
- missing extracted file fails
- root and skill proposal schemas differ fails with `SKILL_SCHEMA_DRIFT`
- generated file used as sole evidence fails
- active records with missing component references fail

- [ ] **Step 2: Write failing projection snapshot tests**

Assert exact headings and generated markers for all six projections. The README must contain:

```text
LORE Organizes Repository Evidence
Agent-neutral
Git-backed
lore verify-self
Generated by LORE. Do not edit directly.
```

- [ ] **Step 3: Implement `validateRepository`**

Load and validate:

1. manifest
2. extracted facts
3. all semantic records
4. evidence
5. skill files and schema identity
6. generated-path boundaries

Return one `ValidatedRepository` object used by every downstream command.

- [ ] **Step 4: Implement projection templates**

Templates must be pure functions from `ValidatedRepository` to Markdown strings. Sort records by title, then canonical reference. Escape headings and table cells. Do not include current time.

- [ ] **Step 5: Implement `lore project` and `--check`**

Without `--check`, write the six configured outputs.  
With `--check`, compare and report stale files in sorted order with exit code `14`.

- [ ] **Step 6: Generate LORE’s own docs**

Run:

```bash
pnpm lore validate
pnpm lore project
pnpm lore project --check
```

Expected: all commands exit `0`, and README is generated from LORE records.

- [ ] **Step 7: Prove determinism**

Run:

```bash
sha256sum README.md docs/generated/*.md > /tmp/lore-before.sha
pnpm lore project
sha256sum README.md docs/generated/*.md > /tmp/lore-after.sha
diff -u /tmp/lore-before.sha /tmp/lore-after.sha
```

Expected: no diff.

On Windows PowerShell, use `Get-FileHash` and compare sorted path/hash output.

- [ ] **Step 8: Commit**

```bash
git add src/validation src/projection src/cli/main.ts tests README.md docs/generated
git commit -m "feat: generate LORE documentation from semantic records"
```

---

### Task 8: Implement bounded, explainable task hydration and context generation

**Files:**
- Create: `src/hydration/score.ts`
- Create: `src/hydration/hydrate.ts`
- Create: `src/context/create-context.ts`
- Create: `tests/unit/hydration/score.test.ts`
- Create: `tests/integration/hydration/hydrate.test.ts`
- Create: `tests/invariants/hydration-determinism.test.ts`
- Create: `fixtures/tasks/transaction-recovery.yaml`
- Generate: `.lore/snapshots/transaction-recovery.context.yaml`
- Generate: `.lore/snapshots/transaction-recovery.context.md`

**Interfaces:**
- Consumes: `ValidatedRepository`, `LoreTask`
- Produces:

```ts
export function scoreRecord(
  task: LoreTask,
  record: SemanticRecord,
  repository: ValidatedRepository,
): { score: number; reasons: string[] };

export function hydrateTask(
  task: LoreTask,
  repository: ValidatedRepository,
): HydrationPacket;

export function createMaintainerContext(
  task: LoreTask,
  packet: HydrationPacket,
  repository: ValidatedRepository,
): LoreMaintainerContext;
```

- [ ] **Step 1: Write exact scoring tests**

Include separate tests for each weight:

```text
component match +40
file match +35
symbol match +35
tag match +20 each, capped at +40
direct dependency +15
audience match +15
active decision +10
active finding +10
weight contribution floor(weight / 10)
superseded -50
unrelated repository -100
```

Assert reasons are sorted by the order above, not alphabetically.

- [ ] **Step 2: Write budget and tie-break tests**

Assert:

- nonpositive records are excluded
- ties use canonical reference
- `max_records` is enforced
- `max_characters` is enforced
- omitted count is exact
- superseded records appear only when `history: true`

- [ ] **Step 3: Implement scoring and dependency lookup**

Direct dependency matches come from relationship records and extracted TypeScript imports. Do not recurse beyond one hop in the first release.

- [ ] **Step 4: Implement canonical YAML and Markdown hydration outputs**

YAML contains the complete packet. Markdown contains:

```text
Task
Repository revision
Selected context
Why each item was selected
Evidence to inspect
Validation commands
Omitted context summary
```

- [ ] **Step 5: Implement `lore hydrate` and `lore context`**

`hydrate` returns the bounded packet.  
`context` wraps the packet with the included skill path, output schema path, changed paths, base/target revisions, and proposal destination.

- [ ] **Step 6: Generate and check in LORE’s first task context**

Use `fixtures/tasks/transaction-recovery.yaml`. The selected context must include transaction, validation, append-only-history, and no-direct-mutation records while excluding unrelated initialization records.

- [ ] **Step 7: Run tests and commit**

```bash
pnpm test tests/unit/hydration tests/integration/hydration tests/invariants/hydration-determinism.test.ts
git add src/hydration src/context src/cli/main.ts tests fixtures/tasks .lore/snapshots
git commit -m "feat: hydrate bounded documentation context"
```

---

### Task 9: Implement proposal validation, transaction planning, application, and rollback

**Files:**
- Create: `src/proposals/validate-proposal.ts`
- Create: `src/transactions/plan-transaction.ts`
- Create: `src/transactions/apply-transaction.ts`
- Create: `src/transactions/receipt.ts`
- Create: `tests/unit/proposals/validate-proposal.test.ts`
- Create: `tests/integration/transactions/apply-transaction.test.ts`
- Create: `tests/invariants/append-only-history.test.ts`
- Create: `tests/invariants/transaction-rollback.test.ts`
- Create: `fixtures/invalid-proposals/*.yaml`
- Create: `.lore/proposals/self-hosting-example.yaml`

**Interfaces:**
- Consumes: Git client, validated repository, schemas, projectors
- Produces:

```ts
export async function validateProposal(
  root: string,
  proposalPath: string,
  repository: ValidatedRepository,
): Promise<ValidationResult<LoreProposal>>;

export async function planTransaction(
  root: string,
  proposal: LoreProposal,
  repository: ValidatedRepository,
): Promise<ValidationResult<TransactionPlan>>;

export async function applyTransaction(
  root: string,
  plan: TransactionPlan,
): Promise<ValidationResult<TransactionReceipt>>;
```

- [ ] **Step 1: Write failing proposal-validation tests**

Cover:

- valid current `changes_proposed`
- valid historical `changes_proposed` in validation-only mode
- valid `no_documentation_change`
- stale base revision rejected by transaction planning and application
- skill digest mismatch against the skill bytes at the proposal base revision
- wrong next revision
- missing supersession target
- evidence failure
- mutation of an existing accepted record
- proposal that attempts a generated-file operation
- unknown operation
- proposal result/operation mismatch

- [ ] **Step 2: Write failing application atomicity tests**

In a temporary Git repository:

1. Create a valid proposal with two record operations.
2. Inject a filesystem failure before the second write.
3. Assert neither record remains.
4. Assert no receipt remains.
5. Assert generated outputs are restored.
6. Assert the result contains `TRANSACTION_ROLLED_BACK`.

- [ ] **Step 3: Implement skill digest validation**

Compute SHA-256 over the raw skill bytes at the proposal’s `base_revision`. Require proposal digest syntax:

```text
sha256:<64 lowercase hexadecimal characters>
```

- [ ] **Step 4: Implement candidate-state planning**

First require the current `HEAD` to equal the proposal’s `base_revision`. Build the complete record set in memory. Convert `transition_record` operations into a new immutable record revision with:

- next revision
- requested status
- supplied evidence
- `supersedes` pointing to the prior revision
- copied title, summary, scope, disclosure, and payload unless the proposal uses `append_record` for a changed semantic payload

Run full record, evidence, and projection validation before producing a `TransactionPlan`.

- [ ] **Step 5: Implement content-derived receipts**

Set:

```text
transaction_id = "tx-" + first 24 hex characters of sha256(canonical proposal YAML)
```

Use the base commit’s timestamp for `accepted_at`. Do not include `accepted_at` in generated projections.

- [ ] **Step 6: Implement transactional writes**

Before writing:

- verify current HEAD still equals proposal base revision
- verify clean working tree
- copy every target file that exists into a temporary backup directory inside `.lore/.transaction-backup/<transaction-id>/`

Write all records, receipt, and projections. If any write or post-write verification fails, restore backups and delete newly created files.

Delete the backup directory only after successful verification.

- [ ] **Step 7: Add the first valid self-hosting proposal fixture**

The proposal should append one real, low-risk semantic record about transaction rollback behavior or supersede an earlier bootstrap finding after implementation. Its base revision and evidence must be exact.

Do not apply the proposal in this task if doing so would make the fixture’s base revision stale within the same commit. Check it in as a validation fixture first.

- [ ] **Step 8: Run tests and commit**

```bash
pnpm test tests/unit/proposals tests/integration/transactions tests/invariants/append-only-history.test.ts tests/invariants/transaction-rollback.test.ts
git add src/proposals src/transactions src/cli/main.ts tests fixtures/invalid-proposals .lore/proposals
git commit -m "feat: validate and apply documentation transactions"
```

---

### Task 10: Implement semantic diff and record explanation

**Files:**
- Create: `src/diff/semantic-diff.ts`
- Create: `src/explain/explain-record.ts`
- Create: `tests/integration/diff/semantic-diff.test.ts`
- Create: `tests/integration/explain/explain-record.test.ts`
- Create: `fixtures/repositories/semantic-history/`

**Interfaces:**
- Consumes: Git client, manifest, record loader, hydration fixtures
- Produces:

```ts
export interface SemanticDiff {
  base: string;
  target: string;
  records: {
    added: string[];
    superseded: Array<{ from: string; to: string }>;
    resolved: string[];
    deprecated: string[];
  };
  components: {
    added: string[];
    removed: string[];
    relationshipsAdded: string[];
    relationshipsRemoved: string[];
  };
  projectionsChanged: string[];
  hydrationChanged: Array<{
    task: string;
    addedReferences: string[];
    removedReferences: string[];
  }>;
}

export async function semanticDiff(
  root: string,
  base: string,
  target: string,
): Promise<ValidationResult<SemanticDiff>>;

export function explainRecord(
  reference: string,
  repository: ValidatedRepository,
  transactions: TransactionReceipt[],
): ValidationResult<RecordExplanation>;
```

- [ ] **Step 1: Build a two-commit semantic-history fixture**

Commit A contains:

- active decision revision 1
- active finding
- one task hydration snapshot

Commit B contains:

- decision revision 2 superseding revision 1
- resolved finding revision 2
- changed relationship
- changed hydration snapshot

Record the fixture SHAs in a test helper created during fixture setup, not in source constants.

- [ ] **Step 2: Write failing semantic-diff assertions**

Assert exact stable output for:

- one supersession
- one resolution
- one relationship addition
- one changed projection
- one task context selection change

- [ ] **Step 3: Implement revision loading**

Use `git archive` or `git show` through the bounded Git client to load manifest, records, extracted facts, and checked-in hydration snapshots at each revision without changing the working tree.

- [ ] **Step 4: Implement text and JSON diff output**

Text output must group changes under stable headings. JSON output must match `SemanticDiff` exactly.

- [ ] **Step 5: Implement explain**

Resolve canonical references and report:

- record envelope
- current status
- full predecessor and successor lineage
- evidence
- related records
- introducing transaction
- superseding transaction

- [ ] **Step 6: Run tests and commit**

```bash
pnpm test tests/integration/diff tests/integration/explain
git add src/diff src/explain src/cli/main.ts tests fixtures/repositories/semantic-history
git commit -m "feat: explain LORE semantic history"
```

---

### Task 11: Implement safe external repository bootstrap with `lore init`

**Files:**
- Create: `src/init/initialize.ts`
- Create: `src/init/templates.ts`
- Create: `tests/integration/init/initialize.test.ts`
- Create: `fixtures/repositories/uninitialized/`
- Create: `fixtures/repositories/partially-initialized/`

**Interfaces:**
- Consumes: manifest templates, schemas, neutral skill files, extractor, projector
- Produces:

```ts
export interface InitOptions {
  repositoryId: string;
  repositoryName: string;
  force: boolean;
}

export async function initializeRepository(
  root: string,
  options: InitOptions,
): Promise<ValidationResult<{ created: string[]; preserved: string[] }>>;
```

- [ ] **Step 1: Write failing initialization tests**

Cover:

- clean uninitialized repository
- deterministic second initialization reports all files preserved
- existing unrelated README is not overwritten
- `--force` may replace generated bootstrap output but not accepted records
- path traversal in repository ID or output path fails
- initialized fixture passes `extract`, `validate`, and `project`

- [ ] **Step 2: Implement template copying**

Copy:

- schemas
- neutral skill
- `BOOTSTRAP.md`
- manifest
- `.lore` directory skeleton

Do not copy LORE-specific semantic records. Instead create one initial `repository.<id>` record and one task fixture asking a maintainer to document architecture, constraints, and procedures.

- [ ] **Step 3: Implement collision policy**

Default behavior:

- existing unrelated file: preserve and report
- existing generated file with LORE marker: compare and update only with `--force`
- existing accepted record or transaction: never overwrite
- existing manifest: reject unless it validates and points to the same repository ID

- [ ] **Step 4: Run an end-to-end initialization test**

The test must:

1. initialize a fixture
2. run extraction
3. run validation
4. run projection
5. rerun all three
6. assert no file changed on the second run

- [ ] **Step 5: Commit**

```bash
pnpm test tests/integration/init
git add src/init src/cli/main.ts tests fixtures/repositories
git commit -m "feat: bootstrap LORE in external repositories"
```

---

### Task 12: Complete self-hosting verification, real proposal application, demo, and CI

**Files:**
- Create: `src/verification/verify-self.ts`
- Create: `src/demo/run-demo.ts`
- Create: `tests/self-hosting/verify-self.test.ts`
- Create: `tests/self-hosting/proposal-lifecycle.test.ts`
- Create: `tests/self-hosting/clean-rerun.test.ts`
- Create: `.github/workflows/ci.yml`
- Modify: `.lore/proposals/self-hosting-example.yaml`
- Generate: `.lore/transactions/<receipt>.yaml`
- Generate: affected `.lore/records/**`
- Regenerate: `.lore/extracted/**`
- Regenerate: `README.md`
- Regenerate: `docs/generated/**`
- Regenerate: `.lore/snapshots/**`

**Interfaces:**
- Consumes: every prior subsystem
- Produces:

```ts
export interface SelfVerificationReport {
  manifest: "passed";
  extraction: "passed";
  records: "passed";
  evidence: "passed";
  skill: "passed";
  proposals: "passed";
  projections: "passed";
  hydration: "passed";
  history: "passed";
  determinism: "passed";
}

export async function verifySelf(
  root: string,
): Promise<ValidationResult<SelfVerificationReport>>;

export async function runDemo(
  root: string,
): Promise<ValidationResult<DemoReport>>;
```

- [ ] **Step 1: Write the failing self-verification test**

Assert all ten fields equal `"passed"` for the LORE repository.

- [ ] **Step 2: Implement `verifySelf`**

Run, without modifying files:

1. manifest validation
2. extraction comparison
3. record and evidence validation
4. skill completeness and schema identity
5. proposal fixture validation against each fixture’s recorded base revision
6. projection comparison
7. hydration snapshot comparison
8. accepted-history immutability checks
9. semantic-history fixture validation
10. a second in-memory extraction/projection comparison

Return all discovered problems in stable order.

- [ ] **Step 3: Apply the real self-hosting proposal**

Update the checked-in proposal’s exact base revision and skill digest after all implementation code exists.

Run:

```bash
pnpm lore validate-proposal .lore/proposals/self-hosting-example.yaml
pnpm lore apply .lore/proposals/self-hosting-example.yaml
```

Expected:

- one immutable semantic record revision is created
- one accepted transaction receipt is created
- affected projections regenerate
- validation passes

Commit the accepted state:

```bash
git add .lore README.md docs/generated
git commit -m "docs: apply first LORE-maintained semantic update"
```

- [ ] **Step 4: Implement `lore demo`**

The demo must create a temporary clone or copy and perform:

```text
extract --check
validate
project --check
hydrate the checked-in task
validate the checked-in historical proposal against its recorded base revision
show semantic diff for the self-hosting transaction
verify-self
rerun extract and project
confirm a clean working tree
```

It must not mutate the caller’s checkout.

- [ ] **Step 5: Add the clean-rerun invariant test**

Copy the repository to a temporary directory excluding `.git` and `node_modules`, initialize Git, run the complete deterministic command sequence twice, and compare every tracked file hash.

- [ ] **Step 6: Add CI**

`.github/workflows/ci.yml` must run on pushes and pull requests:

```yaml
- run: corepack enable
- run: pnpm install --frozen-lockfile
- run: pnpm typecheck
- run: pnpm lint
- run: pnpm test
- run: pnpm lore extract --check
- run: pnpm lore validate
- run: pnpm lore project --check
- run: pnpm lore verify-self
- run: git diff --exit-code
```

Use Node.js 22 and the pnpm version recorded in `packageManager`.

- [ ] **Step 7: Run the complete release gate**

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm lore extract --check
pnpm lore validate
pnpm lore project --check
pnpm lore verify-self
pnpm lore demo
git diff --exit-code
```

Expected: every command exits `0`, and the final working tree is clean.

- [ ] **Step 8: Review the self-generated documentation**

Confirm that a person or arbitrary maintainer can answer from generated docs:

- what LORE is
- how facts differ from semantic records
- how to produce a proposal
- how a proposal becomes a transaction
- how evidence is validated
- how to hydrate task context
- how to verify the repository
- what the bootstrap trust boundary is
- what LORE deliberately does not do

Add or correct semantic records, then regenerate projections if any answer is absent.

- [ ] **Step 9: Commit the release-ready state**

```bash
git add .
git commit -m "feat: complete self-hosting LORE bootstrap"
```

---

## Final verification checklist

Before declaring the plan complete, the implementer must verify:

- [ ] `README.md` is generated and contains the generated-file marker.
- [ ] `BOOTSTRAP.md` is hand-authored and identifies the trust root.
- [ ] The neutral skill contains no model-vendor, named-agent, cartridge, heartbeat, or orchestration dependency.
- [ ] The root and skill proposal schemas are byte-identical.
- [ ] All accepted records are stored by kind, ID, and immutable revision.
- [ ] All self-description records cite exact Git commits.
- [ ] Extracted facts regenerate byte-identically.
- [ ] Projection output regenerates byte-identically.
- [ ] Task hydration is bounded and explains selection reasons.
- [ ] A no-change proposal validates without creating churn.
- [ ] A stale proposal fails before any write.
- [ ] A mid-application failure restores every touched file.
- [ ] A valid proposal creates an immutable record and transaction receipt.
- [ ] Semantic diff explains the accepted self-hosting change.
- [ ] `lore init` bootstraps a separate fixture repository.
- [ ] `lore verify-self` passes from a clean checkout.
- [ ] `lore demo` leaves the caller’s checkout untouched.
- [ ] CI executes the complete release gate.
- [ ] A second complete run leaves a clean Git diff.

## Execution order and review gates

Tasks must be executed in numerical order. Each task is a reviewer gate because later interfaces depend on earlier names and invariants.

Recommended execution mode:

1. Use a fresh implementation worker for each task.
2. Review tests and public interfaces before accepting the task.
3. Reject any task that weakens append-only history, agent neutrality, deterministic output, evidence validation, or self-hosting.
4. Rebase or refresh exact evidence SHAs only when required by new commits.
5. Do not combine Tasks 8 and 9: hydration and transaction application have different failure domains.
6. Do not defer self-hosting records or generated docs until after release. They are part of the product, not post-launch documentation.
