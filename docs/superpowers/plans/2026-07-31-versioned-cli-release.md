# Versioned CLI Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a versioned `@laurajoyhutchins/lore` CLI tarball whose exact bytes are installation-tested on Linux, macOS, and Windows and published through a protected npm trusted-publishing workflow.

**Architecture:** Keep LORE's supported public surface CLI-only. Build one canonical npm tarball on Linux, inspect its actual tar entries, install that same tarball in local and isolated-global modes on all supported platforms, and publish those bytes only after every gate passes. Keep source-tree verification, package verification, registry recovery, and GitHub Release attachment logic as separate fail-closed components.

**Tech Stack:** TypeScript 5.9, Node.js 22.14.0 or newer, npm 11.5.1 or newer for trusted publication, pnpm 10.14.0 for source development, Vitest, Node ESM release scripts, GitHub Actions, npm OIDC trusted publishing.

## Global Constraints

- The public package name is exactly `@laurajoyhutchins/lore`; the executable name remains exactly `lore`.
- The implementation branch prepares `0.0.0-bootstrap.0`; the first stable release PR changes only the release version and release notes to `0.1.0` after npm trusted publishing is configured.
- The supported public compatibility surface is the documented CLI only. Do not add `main`, `module`, `types`, or a general library `exports` map.
- The runtime floor is Node.js `>=22`; trusted publication must run on Node.js `>=22.14.0` with npm `>=11.5.1`.
- Add no runtime dependencies. Release tooling must use Node built-ins and existing repository dependencies only.
- The npm tarball may contain only `dist/`, `BOOTSTRAP.md`, `schemas/`, `skills/maintain-repository-documentation/`, `README.md`, `LICENSE`, and npm-generated package metadata.
- Build one canonical tarball, test those exact bytes, and publish the same bytes. No platform job may repack or rebuild the package.
- Required platforms are Linux, macOS, and Windows on Node.js 22. Each must pass local installation, isolated-global installation, and a fresh-Git-repository functional smoke test.
- Stable publication is allowed only from a published GitHub Release whose tag is exactly `v${package.version}` and whose target commit equals the workflow checkout.
- Stable publication uses npm trusted publishing from a public repository, the exact `release.yml` workflow, and the protected `npm` environment. There is no token fallback.
- The one-time bootstrap version is published manually with 2FA under the `bootstrap` dist-tag from the exact workflow-tested tarball. It never receives `latest`.
- Release tags are immutable. No automated path moves tags, deletes releases, unpublishes versions, or overwrites a version with different bytes.
- Preserve the existing verified-lockfile and `release:verify` contracts.

---

## File Map

### Runtime package surface

- `package.json`: scoped identity, bootstrap version, package allowlist, CLI bin, release scripts, and public-access metadata.
- `tsconfig.build.json`: runtime-only build rooted at `src/`, without declarations or source maps.
- `src/release/metadata.ts`: installed package identity and supported schema-version metadata.
- `src/cli/version.ts`: stable human and JSON rendering for `lore version`.
- `src/cli/output.ts`: public command inventory and help text.
- `src/cli/main.ts`: command routing; `version` must run without an initialized LORE repository.

### Exact artifact tooling

- `scripts/lib/tarball.mjs`: dependency-free gzip/tar parsing and cryptographic digests.
- `scripts/lib/package-contract.mjs`: package allowlist, required-file checks, shebang checks, and release-evidence construction.
- `scripts/build-package-artifact.mjs`: `npm pack --json`, exact tarball inspection, `SHA256SUMS`, and base evidence output.
- `scripts/smoke-installed-package.mjs`: isolated local/global installation plus functional repository smoke.
- `scripts/finalize-release-evidence.mjs`: merge platform reports into the final attached evidence document.

### Publication and recovery tooling

- `scripts/lib/npm-registry.mjs`: classify absent, matching, and conflicting immutable npm versions.
- `scripts/publish-package.mjs`: publish the canonical tarball or safely resume after a matching prior publication.
- `scripts/lib/github-release-assets.mjs`: classify absent, matching, and conflicting release assets.
- `scripts/attach-release-assets.mjs`: attach only absent assets and fail on mismatched existing bytes.

### Workflows and documentation

- `.github/workflows/ci.yml`: retain the source gate and add a Linux installed-package gate for pull requests and main.
- `.github/workflows/release.yml`: release-tag validation, canonical build, three-platform matrix, bootstrap attachment, stable trusted publication, and stable attachment.
- `src/projection/templates.ts`: generated README installation and release guidance.
- `tests/unit/projection/templates.test.ts`: generated README expectations.
- `docs/releasing.md`: bootstrap and stable operator runbook.
- `docs/public-release-readiness.md`: package-release readiness and owner-setting gates.
- `CHANGELOG.md`: bootstrap and `0.1.0` release-note source.

### Tests

- `tests/unit/package/package-metadata.test.ts`: package identity and allowlist.
- `tests/unit/cli/main.test.ts`: help and version behavior.
- `tests/integration/package/build-layout.test.ts`: runtime-only build layout.
- `tests/release/tarball.test.mjs`: tar parser and digest behavior.
- `tests/release/package-contract.test.mjs`: actual tar-entry contract.
- `tests/release/installed-smoke.test.mjs`: platform-path helpers and report schema.
- `tests/release/npm-registry.test.mjs`: immutable registry recovery decisions.
- `tests/release/github-release-assets.test.mjs`: release-asset recovery decisions.
- `tests/release/release-workflow.test.mjs`: workflow permission, trigger, environment, and matrix invariants.
- `vitest.config.ts`: include both TypeScript and `.mjs` tests.

---

### Task 1: Establish the scoped package identity and runtime-only build

**Files:**
- Create: `tests/unit/package/package-metadata.test.ts`
- Create: `tests/integration/package/build-layout.test.ts`
- Create: `tsconfig.build.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: the existing TypeScript source under `src/` and existing `bin.lore` path.
- Produces: a package named `@laurajoyhutchins/lore`, initial version `0.0.0-bootstrap.0`, and `pnpm build` output rooted at `dist/cli/main.js` with no tests, declarations, or maps.

- [ ] **Step 1: Write the failing package metadata test**

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

interface PackageJson {
  name: string;
  version: string;
  private?: boolean;
  bin?: Record<string, string>;
  files?: string[];
  main?: string;
  module?: string;
  types?: string;
  exports?: unknown;
  publishConfig?: { access?: string };
  engines?: { node?: string };
}

describe("published package metadata", () => {
  it("defines the CLI-only bootstrap package contract", async () => {
    const manifest = JSON.parse(await readFile("package.json", "utf8")) as PackageJson;

    expect(manifest.name).toBe("@laurajoyhutchins/lore");
    expect(manifest.version).toBe("0.0.0-bootstrap.0");
    expect(manifest.private).toBeUndefined();
    expect(manifest.bin).toEqual({ lore: "./dist/cli/main.js" });
    expect(manifest.files).toEqual([
      "dist/",
      "BOOTSTRAP.md",
      "schemas/",
      "skills/maintain-repository-documentation/",
      "README.md",
      "LICENSE",
    ]);
    expect(manifest.publishConfig).toEqual({ access: "public" });
    expect(manifest.engines?.node).toBe(">=22");
    expect(manifest.main).toBeUndefined();
    expect(manifest.module).toBeUndefined();
    expect(manifest.types).toBeUndefined();
    expect(manifest.exports).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the metadata test and verify the expected failure**

Run:

```bash
corepack pnpm vitest run tests/unit/package/package-metadata.test.ts
```

Expected: FAIL because the current package is named `lore`, is version `0.0.0`, and is private.

- [ ] **Step 3: Update the package identity and strict file allowlist**

Set these exact top-level fields in `package.json`:

```json
{
  "name": "@laurajoyhutchins/lore",
  "version": "0.0.0-bootstrap.0",
  "license": "Apache-2.0",
  "type": "module",
  "bin": {
    "lore": "./dist/cli/main.js"
  },
  "files": [
    "dist/",
    "BOOTSTRAP.md",
    "schemas/",
    "skills/maintain-repository-documentation/",
    "README.md",
    "LICENSE"
  ],
  "publishConfig": {
    "access": "public"
  },
  "engines": {
    "node": ">=22"
  }
}
```

Remove the `private` field. Do not add `main`, `module`, `types`, or `exports`.

- [ ] **Step 4: Write the failing runtime build-layout test**

```ts
import { access, readdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

async function walk(root: string): Promise<string[]> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) => `${entry.parentPath}/${entry.name}`.replaceAll("\\", "/"))
    .sort();
}

describe("release build layout", () => {
  it("emits runtime JavaScript only", async () => {
    await rm("dist", { recursive: true, force: true });
    const result = spawnSync("corepack", ["pnpm", "build"], {
      encoding: "utf8",
      shell: process.platform === "win32",
    });
    expect(result.status, result.stderr).toBe(0);
    await expect(access("dist/cli/main.js")).resolves.toBeUndefined();
    const files = await walk("dist");
    expect(files.some((file) => file.includes("/tests/"))).toBe(false);
    expect(files.some((file) => file.endsWith(".d.ts"))).toBe(false);
    expect(files.some((file) => file.endsWith(".map"))).toBe(false);
  });
});
```

- [ ] **Step 5: Run the build-layout test and verify it fails**

Run:

```bash
corepack pnpm vitest run tests/integration/package/build-layout.test.ts
```

Expected: FAIL because the current build uses `rootDir: "."`, emits declarations/maps, and does not produce the required runtime-only layout.

- [ ] **Step 6: Add the runtime-only build configuration**

Create `tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist",
    "declaration": false,
    "sourceMap": false,
    "noEmit": false
  },
  "include": ["src/**/*.ts"],
  "exclude": ["tests/**", "vitest.config.ts"]
}
```

Change the package scripts:

```json
{
  "build": "tsc -p tsconfig.build.json",
  "prepack": "corepack pnpm build"
}
```

Retain `typecheck` against `tsconfig.json`.

- [ ] **Step 7: Run focused tests and build**

```bash
corepack pnpm vitest run tests/unit/package/package-metadata.test.ts tests/integration/package/build-layout.test.ts
corepack pnpm build
node dist/cli/main.js --help
```

Expected: all commands PASS; the executable prints help.

- [ ] **Step 8: Commit the package identity and build boundary**

```bash
git add package.json tsconfig.build.json tests/unit/package/package-metadata.test.ts tests/integration/package/build-layout.test.ts
git commit -m "build: define scoped CLI package boundary"
```

---

### Task 2: Add stable installed-version reporting

**Files:**
- Create: `src/release/metadata.ts`
- Create: `src/cli/version.ts`
- Modify: `src/cli/output.ts`
- Modify: `src/cli/main.ts`
- Modify: `tests/unit/cli/main.test.ts`

**Interfaces:**
- Produces: `createVersionInfo(): Promise<LoreVersionInfo>` and `formatVersion(info, json): string`.
- Produces CLI commands: `lore version` and `lore version --json`.
- Constraint: `version` executes before repository validation so it works in any directory.

- [ ] **Step 1: Add failing CLI version tests**

Append to `tests/unit/cli/main.test.ts`:

```ts
it("prints installed package identity without a LORE repository", async () => {
  const stdout = vi.fn();
  const stderr = vi.fn();

  const exitCode = await runCli(["version"], { stdout, stderr });

  expect(exitCode).toBe(0);
  expect(stderr).not.toHaveBeenCalled();
  expect(stdout).toHaveBeenCalledWith(
    "@laurajoyhutchins/lore 0.0.0-bootstrap.0",
  );
});

it("prints stable version JSON", async () => {
  const stdout = vi.fn();
  const exitCode = await runCli(["version", "--json"], {
    stdout,
    stderr: vi.fn(),
  });

  expect(exitCode).toBe(0);
  const value = JSON.parse(String(stdout.mock.calls[0]?.[0]));
  expect(value).toEqual({
    name: "@laurajoyhutchins/lore",
    version: "0.0.0-bootstrap.0",
    node: process.versions.node,
    schema_versions: {
      manifest: 1,
      record: 1,
      proposal: 1,
      task: 1,
      hydration: 1,
      transaction: 1,
    },
  });
});
```

Also extend the help test to require `version`.

- [ ] **Step 2: Run the version tests and verify they fail**

```bash
corepack pnpm vitest run tests/unit/cli/main.test.ts
```

Expected: FAIL with `Unknown command: version`.

- [ ] **Step 3: Implement release metadata loading**

Create `src/release/metadata.ts`:

```ts
import { readFile } from "node:fs/promises";

export const SCHEMA_VERSIONS = Object.freeze({
  manifest: 1,
  record: 1,
  proposal: 1,
  task: 1,
  hydration: 1,
  transaction: 1,
});

export interface LoreVersionInfo {
  name: string;
  version: string;
  node: string;
  schema_versions: typeof SCHEMA_VERSIONS;
}

interface PackageIdentity {
  name: string;
  version: string;
}

export async function createVersionInfo(): Promise<LoreVersionInfo> {
  const packageUrl = new URL("../../package.json", import.meta.url);
  const parsed = JSON.parse(await readFile(packageUrl, "utf8")) as Partial<PackageIdentity>;
  if (parsed.name !== "@laurajoyhutchins/lore" || typeof parsed.version !== "string") {
    throw new Error("Installed LORE package metadata is invalid");
  }
  return {
    name: parsed.name,
    version: parsed.version,
    node: process.versions.node,
    schema_versions: SCHEMA_VERSIONS,
  };
}
```

Create `src/cli/version.ts`:

```ts
import type { LoreVersionInfo } from "../release/metadata.js";

export function formatVersion(info: LoreVersionInfo, json: boolean): string {
  return json
    ? JSON.stringify(info, null, 2)
    : `${info.name} ${info.version}`;
}
```

- [ ] **Step 4: Route the command before repository validation**

Add `"version"` to `COMMANDS` in `src/cli/output.ts`.

In `src/cli/main.ts`, import `createVersionInfo` and `formatVersion`. Handle the command immediately after `init` and before `extract` or `validateRepository(root)`:

```ts
if (command === "version") {
  const args = requirePositionals(command, positionals, 0);
  if (!args.ok) return printProblems(io, args);
  io.stdout(formatVersion(await createVersionInfo(), parsed.values.json === true));
  return 0;
}
```

- [ ] **Step 5: Run focused tests and the compiled command**

```bash
corepack pnpm vitest run tests/unit/cli/main.test.ts
corepack pnpm build
node dist/cli/main.js version
node dist/cli/main.js version --json
```

Expected: PASS; both commands report the package metadata.

- [ ] **Step 6: Commit version reporting**

```bash
git add src/release/metadata.ts src/cli/version.ts src/cli/output.ts src/cli/main.ts tests/unit/cli/main.test.ts
git commit -m "feat: report installed LORE version"
```

---

### Task 3: Parse exact npm tarball bytes without new dependencies

**Files:**
- Create: `scripts/lib/tarball.mjs`
- Create: `tests/release/tarball.test.mjs`
- Modify: `vitest.config.ts`

**Interfaces:**
- Produces: `readTarGzip(buffer): TarEntry[]`, `sha256Hex(buffer): string`, and `sha512Integrity(buffer): string`.
- `TarEntry` shape: `{ name: string, type: string, mode: number, size: number, content: Buffer }`.

- [ ] **Step 1: Make Vitest discover release-script tests**

Change `vitest.config.ts` to:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.mjs"],
  },
});
```

- [ ] **Step 2: Write failing tar parser and digest tests**

Create `tests/release/tarball.test.mjs`. Include a small test-only tar builder that writes POSIX headers, pads each body to 512 bytes, appends two zero blocks, and gzip-compresses the result. Then assert:

```js
import { describe, expect, it } from "vitest";
import { gzipSync } from "node:zlib";
import {
  readTarGzip,
  sha256Hex,
  sha512Integrity,
} from "../../scripts/lib/tarball.mjs";

it("reads exact file bytes and metadata", () => {
  const archive = makeTarGzip([
    { name: "package/dist/cli/main.js", mode: 0o755, type: "0", content: "#!/usr/bin/env node\n" },
    { name: "package/LICENSE", mode: 0o644, type: "0", content: "license\n" },
  ]);
  const entries = readTarGzip(archive);
  expect(entries.map(({ name, mode, type, content }) => ({
    name,
    mode,
    type,
    content: content.toString("utf8"),
  }))).toEqual([
    {
      name: "package/dist/cli/main.js",
      mode: 0o755,
      type: "0",
      content: "#!/usr/bin/env node\n",
    },
    {
      name: "package/LICENSE",
      mode: 0o644,
      type: "0",
      content: "license\n",
    },
  ]);
});

it("calculates stable package digests", () => {
  const bytes = Buffer.from("lore-package");
  expect(sha256Hex(bytes)).toMatch(/^[0-9a-f]{64}$/);
  expect(sha512Integrity(bytes)).toMatch(/^sha512-[A-Za-z0-9+/]+=*$/);
});
```

Add tests rejecting truncated bodies, invalid octal sizes, and non-zero bytes after the terminal zero blocks.

- [ ] **Step 3: Run the tests and verify module-not-found failure**

```bash
corepack pnpm vitest run tests/release/tarball.test.mjs
```

Expected: FAIL because `scripts/lib/tarball.mjs` does not exist.

- [ ] **Step 4: Implement the dependency-free parser**

Create `scripts/lib/tarball.mjs` using `gunzipSync` and `createHash`. The parser must:

1. Read 512-byte headers.
2. Treat two consecutive all-zero headers as archive termination.
3. Read `name` from bytes `0..99`, optional prefix from `345..499`, mode from `100..107`, size from `124..135`, and type flag from byte `156`.
4. Parse octal fields only after validating `/^[0-7 ]+\0?$/`.
5. Slice exactly `size` bytes and advance by `Math.ceil(size / 512) * 512`.
6. Throw on truncation, malformed headers, duplicate paths, absolute paths, or `..` path components.

Export:

```js
export function sha256Hex(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function sha512Integrity(bytes) {
  return `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
}
```

- [ ] **Step 5: Run focused and full tests**

```bash
corepack pnpm vitest run tests/release/tarball.test.mjs
corepack pnpm test
```

Expected: PASS.

- [ ] **Step 6: Commit exact archive parsing**

```bash
git add scripts/lib/tarball.mjs tests/release/tarball.test.mjs vitest.config.ts
git commit -m "test: inspect exact package tar bytes"
```

---

### Task 4: Enforce the packed-package contract and emit base release evidence

**Files:**
- Create: `scripts/lib/package-contract.mjs`
- Create: `scripts/build-package-artifact.mjs`
- Create: `tests/release/package-contract.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: `readTarGzip`, `sha256Hex`, and `sha512Integrity` from Task 3.
- Produces: `inspectPackageArtifact(options): Promise<ReleaseEvidence>`.
- CLI: `node scripts/build-package-artifact.mjs --tag vX.Y.Z --commit <40-hex> --output <directory>`.
- Outputs: one `.tgz`, `release-evidence.json`, and `SHA256SUMS` in the requested output directory.

- [ ] **Step 1: Write failing package-contract tests**

Create `tests/release/package-contract.test.mjs` with fixture archives. Test these exact behaviors:

```js
it("accepts only the CLI runtime and initialization trust root", async () => {
  const evidence = await inspectFixture(validPackageEntries(), {
    tag: "v0.0.0-bootstrap.0",
    commit: "a".repeat(40),
  });
  expect(evidence.package).toEqual({
    name: "@laurajoyhutchins/lore",
    version: "0.0.0-bootstrap.0",
  });
  expect(evidence.artifact.sha256).toMatch(/^[0-9a-f]{64}$/);
  expect(evidence.artifact.integrity).toMatch(/^sha512-/);
  expect(evidence.files).toEqual([...evidence.files].sort());
});

it.each([
  "package/src/index.ts",
  "package/tests/unit/cli/main.test.ts",
  "package/scripts/public-release-gate.mjs",
  "package/.lore/records/decision.yaml",
])("rejects unexpected path %s", async (name) => {
  await expect(inspectFixture([...validPackageEntries(), file(name, "bad")]))
    .rejects.toThrow(`PACKAGE_PATH_NOT_ALLOWED: ${name}`);
});

it("rejects a missing initialization schema", async () => {
  const entries = validPackageEntries().filter(
    ({ name }) => name !== "package/schemas/manifest.schema.json",
  );
  await expect(inspectFixture(entries)).rejects.toThrow(
    "PACKAGE_REQUIRED_FILE_MISSING: package/schemas/manifest.schema.json",
  );
});

it("rejects a CLI without the Node shebang", async () => {
  await expect(inspectFixture(validPackageEntries({ cli: "console.log('x')\n" })))
    .rejects.toThrow("PACKAGE_CLI_SHEBANG_INVALID");
});
```

Also test mismatched package name, version/tag mismatch, non-executable CLI mode, symlink entries, NUL-containing file bodies, and a commit that is not exactly 40 hexadecimal characters.

- [ ] **Step 2: Run the package-contract tests and verify failure**

```bash
corepack pnpm vitest run tests/release/package-contract.test.mjs
```

Expected: FAIL because the package-contract module does not exist.

- [ ] **Step 3: Implement the allowlist and evidence shape**

Create `scripts/lib/package-contract.mjs` with these constants:

```js
const REQUIRED_FILES = [
  "package/package.json",
  "package/README.md",
  "package/LICENSE",
  "package/BOOTSTRAP.md",
  "package/dist/cli/main.js",
  "package/schemas/manifest.schema.json",
  "package/schemas/record.schema.json",
  "package/schemas/proposal.schema.json",
  "package/schemas/task.schema.json",
  "package/schemas/hydration.schema.json",
  "package/schemas/extracted-facts.schema.json",
  "package/schemas/transaction.schema.json",
  "package/skills/maintain-repository-documentation/SKILL.md",
  "package/skills/maintain-repository-documentation/INPUTS.md",
  "package/skills/maintain-repository-documentation/OUTPUTS.md",
  "package/skills/maintain-repository-documentation/schemas/proposal.schema.json",
];

const ALLOWED_PREFIXES = [
  "package/dist/",
  "package/schemas/",
  "package/skills/maintain-repository-documentation/",
];

const ALLOWED_EXACT = new Set([
  "package/package.json",
  "package/README.md",
  "package/LICENSE",
  "package/BOOTSTRAP.md",
]);
```

`inspectPackageArtifact` must parse `package/package.json`, require the scoped name, require `bin` to equal `{ lore: "./dist/cli/main.js" }`, require `tag === `v${version}``, verify the file contract, and return:

```js
{
  schema_version: 1,
  package: { name, version },
  source: { repository, tag, commit },
  artifact: { filename, bytes, sha256, integrity },
  files: sortedFileNames,
  platforms: [],
}
```

- [ ] **Step 4: Implement deterministic artifact construction**

Create `scripts/build-package-artifact.mjs`:

1. Parse `--tag`, `--commit`, and `--output`; reject missing or duplicate flags.
2. Remove and recreate the output directory inside the repository.
3. Run `npm pack --json --pack-destination <output>` with inherited stderr and captured stdout.
4. Require one JSON result and one tarball filename.
5. Call `inspectPackageArtifact` on the tarball.
6. Write `release-evidence.json` as two-space JSON plus final newline.
7. Write `SHA256SUMS` as `<sha256>  <filename>\n`.

Add package scripts:

```json
{
  "release:package": "node scripts/build-package-artifact.mjs",
  "release:inspect": "node scripts/verify-package-artifact.mjs"
}
```

Do not add `verify-package-artifact.mjs`; instead make `build-package-artifact.mjs` the single source of base evidence and expose `inspectPackageArtifact` for downstream scripts.

- [ ] **Step 5: Run the contract tests and construct a real package**

```bash
corepack pnpm vitest run tests/release/package-contract.test.mjs
rm -rf .release-artifacts
corepack pnpm release:package -- --tag v0.0.0-bootstrap.0 --commit "$(git rev-parse HEAD)" --output .release-artifacts
cat .release-artifacts/release-evidence.json
cat .release-artifacts/SHA256SUMS
```

Expected: PASS; one tarball exists and its evidence lists only allowed files.

- [ ] **Step 6: Inspect the package without relying on the source tree**

```bash
mkdir -p /tmp/lore-package-inspection
cp .release-artifacts/*.tgz /tmp/lore-package-inspection/
tar -tzf /tmp/lore-package-inspection/*.tgz
```

Expected: every listed path is under `package/` and satisfies the allowlist.

- [ ] **Step 7: Remove temporary artifacts and commit**

```bash
rm -rf .release-artifacts
git add package.json scripts/lib/package-contract.mjs scripts/build-package-artifact.mjs tests/release/package-contract.test.mjs
git commit -m "build: verify exact npm package contents"
```

---

### Task 5: Exercise local and isolated-global installations functionally

**Files:**
- Create: `scripts/smoke-installed-package.mjs`
- Create: `tests/release/installed-smoke.test.mjs`
- Modify: `package.json`

**Interfaces:**
- CLI: `node scripts/smoke-installed-package.mjs --tarball <file> --mode local|global|all --report <file>`.
- Produces a report: `{ schema_version: 1, platform, node, modes: [{ mode, passed }] }`.
- The script creates all consumers and repositories under a temporary directory and deletes them unless `LORE_KEEP_SMOKE_ROOT=1`.

- [ ] **Step 1: Write failing platform-helper and report tests**

```js
import { describe, expect, it } from "vitest";
import {
  globalExecutable,
  globalPathDirectory,
  smokeReport,
} from "../../scripts/smoke-installed-package.mjs";

it("uses the npm prefix wrapper on Windows", () => {
  expect(globalExecutable("win32")).toBe("lore.cmd");
  expect(globalPathDirectory("C:\\prefix", "win32")).toBe("C:\\prefix");
});

it("uses prefix/bin on Unix", () => {
  expect(globalExecutable("linux")).toBe("lore");
  expect(globalPathDirectory("/tmp/prefix", "linux")).toBe("/tmp/prefix/bin");
});

it("emits a stable platform report", () => {
  expect(smokeReport("linux", "22.14.0", ["local", "global"])).toEqual({
    schema_version: 1,
    platform: "linux",
    node: "22.14.0",
    modes: [
      { mode: "local", passed: true },
      { mode: "global", passed: true },
    ],
  });
});
```

- [ ] **Step 2: Run the tests and verify failure**

```bash
corepack pnpm vitest run tests/release/installed-smoke.test.mjs
```

Expected: FAIL because the smoke module does not exist.

- [ ] **Step 3: Implement isolated command execution**

Create `scripts/smoke-installed-package.mjs` with exported helper functions and a main guard. Implement `run(command, args, { cwd, env })` with `spawnSync`, inherited output, and an exception containing command, status, stdout, and stderr on failure.

For local mode:

```js
run("npm", ["init", "--yes"], { cwd: consumer });
run("npm", ["install", tarball], { cwd: consumer });
run("npm", ["exec", "--", "lore", "--help"], { cwd: consumer });
run("npm", ["exec", "--", "lore", "version", "--json"], { cwd: consumer });
```

For isolated-global mode:

```js
run("npm", ["install", "--global", "--prefix", prefix, tarball], { cwd: smokeRoot });
const env = {
  ...process.env,
  PATH: `${globalPathDirectory(prefix, process.platform)}${path.delimiter}${process.env.PATH ?? ""}`,
};
run(globalExecutable(process.platform), ["--help"], { cwd: smokeRoot, env });
run(globalExecutable(process.platform), ["version", "--json"], { cwd: smokeRoot, env });
```

Parse version JSON from captured output and require package name/version to match the tarball's `package/package.json`.

- [ ] **Step 4: Implement the fresh-repository workflow for each mode**

For both local and global command launchers:

```text
git init
git config user.name "LORE Installation Test"
git config user.email "lore-installation-test@example.invalid"
lore init --id installation-smoke --name "Installation Smoke"
verify every required template path
lore extract
lore validate
lore project
lore extract --check
lore project --check
git add .
git commit -m "Initialize LORE smoke repository"
git status --porcelain=v1
```

Require empty status output. Resolve the tarball and all temporary roots to absolute paths before changing directories. Delete `NODE_PATH`, `TSX_TSCONFIG_PATH`, and any environment variable beginning `LORE_SOURCE_` before launching the installed CLI.

- [ ] **Step 5: Add the package script and run a real dual-mode smoke**

Add:

```json
{
  "release:smoke": "node scripts/smoke-installed-package.mjs"
}
```

Run:

```bash
rm -rf .release-artifacts
corepack pnpm release:package -- --tag v0.0.0-bootstrap.0 --commit "$(git rev-parse HEAD)" --output .release-artifacts
TARBALL="$(find .release-artifacts -maxdepth 1 -name '*.tgz' -print -quit)"
corepack pnpm release:smoke -- --tarball "$TARBALL" --mode all --report .release-artifacts/smoke-linux.json
cat .release-artifacts/smoke-linux.json
```

Expected: both installation modes PASS and each initialized Git repository ends clean.

- [ ] **Step 6: Clean and commit**

```bash
rm -rf .release-artifacts
git add package.json scripts/smoke-installed-package.mjs tests/release/installed-smoke.test.mjs
git commit -m "test: smoke test installed CLI artifacts"
```

---

### Task 6: Make package installation part of the source release gate and ordinary CI

**Files:**
- Modify: `scripts/public-release-gate.mjs`
- Modify: `.github/workflows/ci.yml`
- Create: `tests/release/release-workflow.test.mjs`

**Interfaces:**
- The source gate creates `.release-artifacts`, package-smokes the exact tarball on Linux, removes the directory, and then requires a clean tree.
- Pull requests and main continue to use the unified source gate.

- [ ] **Step 1: Add failing source-gate cleanup tests**

Extend or create a focused test that imports a pure helper moved from `public-release-gate.mjs` if necessary. Require the gate's cleanup path list to contain both the restored lockfile and `.release-artifacts`.

```js
it("cleans package artifacts before the final clean-tree assertion", () => {
  expect(gateTemporaryPaths()).toEqual([
    "pnpm-lock.yaml",
    ".release-artifacts",
  ]);
});
```

- [ ] **Step 2: Add failing workflow-invariant tests**

Create `tests/release/release-workflow.test.mjs`. Parse `.github/workflows/ci.yml` with the existing `yaml` package and require:

```js
it("keeps pull requests read-only and runs the unified gate", async () => {
  const workflow = await readWorkflow(".github/workflows/ci.yml");
  expect(workflow.permissions).toEqual({ contents: "read" });
  expect(workflow.jobs.verify.steps.some(
    (step) => step.run === "node scripts/public-release-gate.mjs",
  )).toBe(true);
});
```

This test initially passes for the existing workflow; keep it as a regression while adding release workflow tests in Task 9.

- [ ] **Step 3: Extend the gate after source build verification**

After `pnpm(["build"])`, add:

```js
const artifactDirectory = ".release-artifacts";
run("node", [
  "scripts/build-package-artifact.mjs",
  "--tag",
  `v${JSON.parse(readFileSync("package.json", "utf8")).version}`,
  "--commit",
  head,
  "--output",
  artifactDirectory,
]);
const tarball = readdirSync(artifactDirectory)
  .filter((name) => name.endsWith(".tgz"));
if (tarball.length !== 1) fail("source gate expected exactly one package tarball");
run("node", [
  "scripts/smoke-installed-package.mjs",
  "--tarball",
  path.join(artifactDirectory, tarball[0]),
  "--mode",
  "all",
  "--report",
  path.join(artifactDirectory, "smoke-linux.json"),
]);
```

Add a cleanup function that removes `.release-artifacts` on success and failure before `verifyCleanTree()`.

- [ ] **Step 4: Keep CI simple and authoritative**

Retain one `verify` job in `.github/workflows/ci.yml`. Upgrade the action majors only in Task 9 so this task changes no workflow authority. The job continues to run:

```yaml
- run: node scripts/public-release-gate.mjs
```

The package gate is now inherited through the source gate rather than duplicated in YAML.

- [ ] **Step 5: Run the complete gate twice**

```bash
node scripts/restore-verified-lockfile.mjs
corepack pnpm install --frozen-lockfile
corepack pnpm release:verify
corepack pnpm release:verify
```

Expected: both runs print `VERIFIED_PUBLICATION_READY <same-head>` and leave no lockfile or `.release-artifacts` drift.

- [ ] **Step 6: Commit source-gate integration**

```bash
git add scripts/public-release-gate.mjs .github/workflows/ci.yml tests/release/release-workflow.test.mjs
git commit -m "ci: gate installed package behavior"
```

---

### Task 7: Add idempotent npm publication and immutable-version collision handling

**Files:**
- Create: `scripts/lib/npm-registry.mjs`
- Create: `scripts/publish-package.mjs`
- Create: `tests/release/npm-registry.test.mjs`

**Interfaces:**
- Produces: `classifyPublishedVersion(expectedIntegrity, observedIntegrity)` returning `"absent" | "matching" | "conflict"`.
- CLI: `node scripts/publish-package.mjs --tarball <file> --evidence <file>`.
- Publication command is exactly `npm publish <tarball> --access public` and receives no token arguments.

- [ ] **Step 1: Write immutable-version decision tests**

```js
import { describe, expect, it } from "vitest";
import { classifyPublishedVersion } from "../../scripts/lib/npm-registry.mjs";

it("publishes an absent version", () => {
  expect(classifyPublishedVersion("sha512-expected", null)).toBe("absent");
});

it("resumes a matching publication", () => {
  expect(classifyPublishedVersion("sha512-same", "sha512-same")).toBe("matching");
});

it("fails an immutable version collision", () => {
  expect(classifyPublishedVersion("sha512-a", "sha512-b")).toBe("conflict");
});
```

Add tests for empty strings and malformed integrity values; they must throw rather than classify.

- [ ] **Step 2: Run and verify failure**

```bash
corepack pnpm vitest run tests/release/npm-registry.test.mjs
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement registry lookup and decision logic**

Create `scripts/lib/npm-registry.mjs`:

```js
export function classifyPublishedVersion(expectedIntegrity, observedIntegrity) {
  if (!/^sha512-[A-Za-z0-9+/]+=*$/.test(expectedIntegrity)) {
    throw new Error("EXPECTED_INTEGRITY_INVALID");
  }
  if (observedIntegrity === null) return "absent";
  if (!/^sha512-[A-Za-z0-9+/]+=*$/.test(observedIntegrity)) {
    throw new Error("OBSERVED_INTEGRITY_INVALID");
  }
  return observedIntegrity === expectedIntegrity ? "matching" : "conflict";
}
```

Add `readPublishedIntegrity(name, version)` using:

```text
npm view <name>@<version> dist.integrity --json
```

Treat only an npm `E404` result as absent. Any authentication, network, malformed JSON, or other registry error fails closed.

- [ ] **Step 4: Implement publication and post-publish verification**

`scripts/publish-package.mjs` must:

1. Parse the evidence file and recalculate tarball SHA-256/SHA-512.
2. Require exact agreement with evidence.
3. Query npm.
4. If absent, run `npm publish <tarball> --access public`.
5. If matching, print `NPM_PUBLICATION_ALREADY_COMPLETE` and do not publish.
6. If conflict, throw `NPM_IMMUTABLE_VERSION_COLLISION`.
7. Query npm again and require exact matching integrity.
8. Print `NPM_PUBLICATION_VERIFIED <name>@<version> <integrity>`.

Do not read `NODE_AUTH_TOKEN`; trusted publishing is supplied by npm's OIDC environment.

- [ ] **Step 5: Run tests and a non-publishing dry registry lookup**

```bash
corepack pnpm vitest run tests/release/npm-registry.test.mjs
npm view @laurajoyhutchins/lore@0.0.0-bootstrap.0 dist.integrity --json || true
```

Expected before bootstrap publication: the test passes and npm reports absence.

- [ ] **Step 6: Commit registry recovery logic**

```bash
git add scripts/lib/npm-registry.mjs scripts/publish-package.mjs tests/release/npm-registry.test.mjs
git commit -m "build: make npm publication resumable"
```

---

### Task 8: Add fail-closed GitHub Release asset recovery

**Files:**
- Create: `scripts/lib/github-release-assets.mjs`
- Create: `scripts/attach-release-assets.mjs`
- Create: `tests/release/github-release-assets.test.mjs`

**Interfaces:**
- Produces: `classifyReleaseAsset(expectedSha256, observedSha256)` returning `"absent" | "matching" | "conflict"`.
- CLI: `node scripts/attach-release-assets.mjs --tag <tag> --directory <directory>`.
- Required assets are the canonical `.tgz`, `SHA256SUMS`, and final `release-evidence.json`.

- [ ] **Step 1: Write release-asset decision tests**

```js
import { describe, expect, it } from "vitest";
import { classifyReleaseAsset } from "../../scripts/lib/github-release-assets.mjs";

it("uploads an absent asset", () => {
  expect(classifyReleaseAsset("a".repeat(64), null)).toBe("absent");
});

it("reuses identical bytes", () => {
  expect(classifyReleaseAsset("a".repeat(64), "a".repeat(64))).toBe("matching");
});

it("rejects a mismatched existing asset", () => {
  expect(classifyReleaseAsset("a".repeat(64), "b".repeat(64))).toBe("conflict");
});
```

- [ ] **Step 2: Run and verify failure**

```bash
corepack pnpm vitest run tests/release/github-release-assets.test.mjs
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement GitHub asset inspection**

Use `gh api repos/${GITHUB_REPOSITORY}/releases/tags/${tag}` to obtain asset names, IDs, and API URLs. For each existing required asset:

1. Download with `gh api -H "Accept: application/octet-stream" <asset-api-url>` to a temporary file.
2. Calculate SHA-256.
3. Classify absent/matching/conflict.
4. Fail with `GITHUB_RELEASE_ASSET_CONFLICT: <name>` on conflict.

- [ ] **Step 4: Implement idempotent attachment**

For absent assets only, run:

```text
gh release upload <tag> <absolute-path>
```

For matching assets, print `GITHUB_RELEASE_ASSET_ALREADY_COMPLETE <name>`. Never use `--clobber`.

Require exactly one `.tgz`, one `SHA256SUMS`, and one `release-evidence.json` in the input directory; reject any extra file selected for upload.

- [ ] **Step 5: Run tests and commit**

```bash
corepack pnpm vitest run tests/release/github-release-assets.test.mjs
git add scripts/lib/github-release-assets.mjs scripts/attach-release-assets.mjs tests/release/github-release-assets.test.mjs
git commit -m "build: recover GitHub release assets safely"
```

---

### Task 9: Finalize cross-platform evidence and add the protected release workflow

**Files:**
- Create: `scripts/finalize-release-evidence.mjs`
- Create: `.github/workflows/release.yml`
- Modify: `tests/release/release-workflow.test.mjs`
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Finalizer CLI: `node scripts/finalize-release-evidence.mjs --base <base-evidence> --reports <directory> --output <file>`.
- Final evidence contains exactly three platform entries, one each for `linux`, `darwin`, and `win32`, and each contains passing `local` and `global` modes.
- Workflow name and filename are stable because npm trusted publishing is configured against `release.yml`.

- [ ] **Step 1: Add failing workflow security and matrix tests**

Extend `tests/release/release-workflow.test.mjs`:

```js
it("publishes only from a published GitHub Release", async () => {
  const workflow = await readWorkflow(".github/workflows/release.yml");
  expect(workflow.on.release.types).toEqual(["published"]);
  expect(workflow.on.push).toBeUndefined();
  expect(workflow.on.pull_request).toBeUndefined();
});

it("tests the canonical artifact on all supported platforms", async () => {
  const workflow = await readWorkflow(".github/workflows/release.yml");
  expect(workflow.jobs.smoke.strategy.matrix.os).toEqual([
    "ubuntu-latest",
    "macos-latest",
    "windows-latest",
  ]);
});

it("limits OIDC and release writes to the protected publish job", async () => {
  const workflow = await readWorkflow(".github/workflows/release.yml");
  expect(workflow.permissions).toEqual({ contents: "read" });
  expect(workflow.jobs.publish.environment).toBe("npm");
  expect(workflow.jobs.publish.permissions).toEqual({
    contents: "write",
    "id-token": "write",
  });
  expect(workflow.jobs.build.permissions).toBeUndefined();
  expect(workflow.jobs.smoke.permissions).toBeUndefined();
});
```

Because YAML parsers may coerce the key `on`, configure the existing YAML parser or access both `workflow.on` and `workflow[true]` consistently in the test helper.

- [ ] **Step 2: Run and verify the missing-workflow failure**

```bash
corepack pnpm vitest run tests/release/release-workflow.test.mjs
```

Expected: FAIL because `.github/workflows/release.yml` does not exist.

- [ ] **Step 3: Implement platform evidence finalization**

`scripts/finalize-release-evidence.mjs` must:

1. Read base evidence and every `smoke-*.json` report.
2. Require platform set `linux`, `darwin`, `win32` exactly once each.
3. Require each report to contain passing `local` and `global` modes.
4. Sort reports in the order `linux`, `darwin`, `win32`.
5. Write final evidence with `platforms` replaced by the validated reports.
6. Preserve all base package, source, artifact, and file fields exactly.

Add unit tests to `tests/release/installed-smoke.test.mjs` for duplicate, missing, and failed reports.

- [ ] **Step 4: Create the build-once release workflow**

Create `.github/workflows/release.yml` with:

```yaml
name: Release CLI

on:
  release:
    types: [published]

permissions:
  contents: read

concurrency:
  group: release-${{ github.event.release.tag_name }}
  cancel-in-progress: false
```

`build` job:

- runs on `ubuntu-latest`;
- checks out `github.event.release.tag_name` with `fetch-depth: 0`;
- uses Node `22.14.0`;
- restores the verified lockfile and installs frozen dependencies;
- verifies `git rev-parse HEAD` equals `github.event.release.target_commitish` resolved to a commit;
- verifies tag equals `v${package.version}`;
- verifies bootstrap versions are GitHub prereleases and stable versions are not prereleases;
- runs `corepack pnpm release:verify`;
- runs `release:package` into `release-base/`;
- uploads the exact tarball, `SHA256SUMS`, and base evidence as artifact `lore-package-${{ github.event.release.tag_name }}`.

Use `actions/checkout@v6`, `actions/setup-node@v6`, and `actions/upload-artifact@v4`.

- [ ] **Step 5: Add the three-platform smoke matrix**

The `smoke` job:

```yaml
needs: build
strategy:
  fail-fast: false
  matrix:
    os: [ubuntu-latest, macos-latest, windows-latest]
runs-on: ${{ matrix.os }}
```

It downloads the canonical artifact, installs npm `11.5.1`, recalculates the tarball digests against base evidence, runs `smoke-installed-package.mjs --mode all`, and uploads one report named by `runner.os` normalized to `linux`, `darwin`, or `win32`.

No matrix job runs `npm pack`, `pnpm build`, or `tsc`.

- [ ] **Step 6: Add bootstrap attachment and stable publication paths**

`bootstrap-attach` job:

- needs all smoke jobs;
- runs only when `github.event.release.prerelease == true`;
- finalizes evidence;
- attaches exact assets using `attach-release-assets.mjs`;
- has `contents: write` but no `id-token` and no environment.

`publish` job:

- needs all smoke jobs;
- runs only when `github.event.release.prerelease == false`;
- uses environment `npm`;
- permissions are `contents: write` and `id-token: write`;
- uses `actions/setup-node@v6` with registry URL `https://registry.npmjs.org`, package-manager cache disabled;
- installs npm `11.5.1` or a later explicitly pinned compatible npm release;
- finalizes evidence;
- runs `publish-package.mjs` on the exact tarball;
- runs `attach-release-assets.mjs` only after registry integrity matches.

Do not use `workflow_call`, `workflow_dispatch`, `NODE_AUTH_TOKEN`, or `--provenance`; trusted publishing generates provenance automatically.

- [ ] **Step 7: Upgrade ordinary CI action majors consistently**

Change `.github/workflows/ci.yml` to `actions/checkout@v6` and `actions/setup-node@v6`, retain Node 22 and the unified source gate, and keep `permissions: contents: read`.

- [ ] **Step 8: Run workflow tests and local workflow parsing**

```bash
corepack pnpm vitest run tests/release/release-workflow.test.mjs tests/release/installed-smoke.test.mjs
node -e "import('yaml').then(async ({parse}) => { for (const f of ['.github/workflows/ci.yml','.github/workflows/release.yml']) parse(await require('node:fs/promises').readFile(f,'utf8')); })"
```

Expected: PASS.

- [ ] **Step 9: Commit the release workflow**

```bash
git add .github/workflows/ci.yml .github/workflows/release.yml scripts/finalize-release-evidence.mjs tests/release/release-workflow.test.mjs tests/release/installed-smoke.test.mjs
git commit -m "ci: publish tested CLI artifacts with OIDC"
```

---

### Task 10: Document installation, bootstrap, stable release, and owner actions

**Files:**
- Create: `docs/releasing.md`
- Create: `CHANGELOG.md`
- Modify: `docs/public-release-readiness.md`
- Modify: `src/projection/templates.ts`
- Modify: `tests/unit/projection/templates.test.ts`
- Regenerate: `README.md`
- Regenerate: `.lore/extracted/package-scripts.yaml`
- Regenerate: `.lore/extracted/typescript-components.yaml`
- Regenerate: `.lore/extracted/typescript-relationships.yaml`
- Regenerate: `.lore/extracted/vitest-tests.yaml`
- Regenerate: `docs/generated/architecture.md`
- Regenerate: `docs/generated/component-catalog.md`
- Regenerate: `docs/generated/current-decisions.md`
- Regenerate: `docs/generated/maintainer-guide.md`
- Regenerate: `docs/generated/repository-card.md`

**Interfaces:**
- README distinguishes consumer installation from source-development setup.
- `docs/releasing.md` is the exact owner/operator runbook for bootstrap and stable release.

- [ ] **Step 1: Add failing generated README expectations**

In `tests/unit/projection/templates.test.ts`, require the rendered README to contain:

```ts
expect(readme).toContain("npm install --save-dev @laurajoyhutchins/lore");
expect(readme).toContain("npm exec lore -- --help");
expect(readme).toContain("CLI-only public compatibility surface");
expect(readme).not.toContain('keeps `"private": true`');
```

- [ ] **Step 2: Run the projection test and verify failure**

```bash
corepack pnpm vitest run tests/unit/projection/templates.test.ts
```

Expected: FAIL because the current generated README describes source setup only and says the package is private.

- [ ] **Step 3: Update the README projection source**

Modify `renderReadme` in `src/projection/templates.ts` to include:

```markdown
## Install the CLI

```bash
npm install --save-dev @laurajoyhutchins/lore
npm exec lore -- --help
npm exec lore -- version --json
```

LORE's public compatibility surface is CLI-only. Internal TypeScript modules and source paths are not supported library APIs.

## Develop LORE from source

```bash
node scripts/restore-verified-lockfile.mjs
corepack enable
pnpm install --frozen-lockfile
pnpm release:verify
```
```

Keep Node.js, Git, Corepack, and pinned pnpm source-development requirements. Remove the private-package statement.

- [ ] **Step 4: Write the exact release runbook**

Create `docs/releasing.md` with these sections and commands:

1. Preconditions: public repository, exact-head `release:verify`, protected tags, protected `npm` environment, npm 2FA.
2. Bootstrap preparation: package version `0.0.0-bootstrap.0`, create/publish GitHub prerelease `v0.0.0-bootstrap.0`, wait for matrix and attached artifact.
3. Manual bootstrap publication:

```bash
gh release download v0.0.0-bootstrap.0 --pattern '*.tgz' --pattern SHA256SUMS --pattern release-evidence.json
sha256sum --check SHA256SUMS
npm publish ./laurajoyhutchins-lore-0.0.0-bootstrap.0.tgz --access public --tag bootstrap --otp "<enter-current-2FA-code>"
```

The runbook text must instruct the operator to type the current OTP interactively or substitute it locally; no OTP is committed or logged.

4. Configure npm trusted publisher: owner `laurajoyhutchins`, repository `LORE`, workflow filename `release.yml`, environment `npm`, allowed action `npm publish`.
5. Restrict token publication and revoke obsolete automation tokens.
6. Stable preparation: release PR bumps to `0.1.0` and updates changelog.
7. Stable publication: manually publish GitHub Release `v0.1.0`; approve protected environment; verify npm integrity/provenance and release assets.
8. Deprecate bootstrap only after stable success:

```bash
npm deprecate @laurajoyhutchins/lore@0.0.0-bootstrap.0 "Bootstrap-only release; use 0.1.0 or later."
```

9. Recovery: rerun the same release workflow; never move a tag or reuse a version.

- [ ] **Step 5: Add changelog and readiness gates**

Create `CHANGELOG.md` with an `Unreleased`, `0.0.0-bootstrap.0`, and planned `0.1.0` section. The bootstrap section states that it exists only to establish the registry trust relationship.

Update `docs/public-release-readiness.md` with unchecked owner-setting gates:

- repository visibility changed to public after exact-head disclosure review;
- tag protection configured for `v*`;
- GitHub environment `npm` created with owner approval and tag restrictions;
- bootstrap package published with 2FA under `bootstrap`;
- npm trusted publisher configured for `release.yml` and environment `npm`;
- token publication restricted and obsolete tokens revoked;
- stable `0.1.0` not published until all preceding gates are complete.

- [ ] **Step 6: Regenerate deterministic LORE state**

```bash
corepack pnpm release:refresh
```

Review every changed generated file. Do not edit generated files directly.

- [ ] **Step 7: Run documentation and projection checks**

```bash
corepack pnpm vitest run tests/unit/projection/templates.test.ts
corepack pnpm lore extract --check
corepack pnpm lore validate
corepack pnpm lore project --check
```

Expected: PASS.

- [ ] **Step 8: Commit documentation and generated state**

```bash
git add CHANGELOG.md docs/releasing.md docs/public-release-readiness.md src/projection/templates.ts tests/unit/projection/templates.test.ts README.md .lore/extracted docs/generated
git commit -m "docs: define CLI release operations"
```

---

### Task 11: Verify the bootstrap release candidate at exact head

**Files:**
- Modify only if verification exposes a defect; otherwise no source changes.

**Interfaces:**
- Produces exact-head evidence for the implementation PR.
- Does not publish npm, create a tag, create a GitHub Release, or change repository visibility.

- [ ] **Step 1: Restore the exact dependency graph**

```bash
node scripts/restore-verified-lockfile.mjs
corepack enable
corepack pnpm install --frozen-lockfile
```

Expected: installed pnpm is exactly `10.14.0` and the verified lockfile identity passes.

- [ ] **Step 2: Run focused package and release tests**

```bash
corepack pnpm vitest run \
  tests/unit/package/package-metadata.test.ts \
  tests/unit/cli/main.test.ts \
  tests/integration/package/build-layout.test.ts \
  tests/release/tarball.test.mjs \
  tests/release/package-contract.test.mjs \
  tests/release/installed-smoke.test.mjs \
  tests/release/npm-registry.test.mjs \
  tests/release/github-release-assets.test.mjs \
  tests/release/release-workflow.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Run the complete source and package gate**

```bash
corepack pnpm release:verify
```

Expected: `VERIFIED_PUBLICATION_READY <exact-head-sha>` after local and isolated-global installation smoke tests.

- [ ] **Step 4: Independently construct and inspect the canonical bootstrap tarball**

```bash
HEAD_SHA="$(git rev-parse HEAD)"
rm -rf .release-artifacts
corepack pnpm release:package -- --tag v0.0.0-bootstrap.0 --commit "$HEAD_SHA" --output .release-artifacts
TARBALL="$(find .release-artifacts -maxdepth 1 -name '*.tgz' -print -quit)"
node scripts/smoke-installed-package.mjs --tarball "$TARBALL" --mode all --report .release-artifacts/smoke-linux.json
sha256sum --check .release-artifacts/SHA256SUMS
node dist/cli/main.js version --json
```

Expected: package and report identities match `0.0.0-bootstrap.0`; both smoke modes pass.

- [ ] **Step 5: Confirm no source-tree contamination**

```bash
rm -rf .release-artifacts
git status --short
git diff --exit-code
git diff --cached --exit-code
```

Expected: no output.

- [ ] **Step 6: Record exact-head verification in the pull request description**

Include:

```text
Verified exact head: <40-character SHA>
Source release gate: PASS
Package inventory: PASS
Installed local smoke: PASS
Installed isolated-global smoke: PASS
Release workflow contract tests: PASS
No npm publication, release tag, GitHub Release, visibility change, or external package-setting mutation performed.
```

Use the actual exact head SHA rather than the literal placeholder shown above.

- [ ] **Step 7: Commit any verification-only documentation correction, if required**

If verification required no source changes, do not create an empty commit. If a factual release-document correction was necessary:

```bash
git add docs/releasing.md docs/public-release-readiness.md
 git commit -m "docs: correct release verification instructions"
```

---

### Task 12: Open the implementation pull request and preserve owner-only follow-up gates

**Files:**
- No additional repository files unless the PR template requires generated release evidence to be linked.

**Interfaces:**
- Produces a draft PR from `feat/versioned-cli-release` to `main`.
- Leaves these owner actions unresolved and explicit: repository visibility, protected tag rule, `npm` environment approval policy, bootstrap 2FA publication, npm trusted-publisher configuration, and stable release creation.

- [ ] **Step 1: Review the complete diff against the approved design**

```bash
git diff main...HEAD --stat
git diff main...HEAD -- package.json tsconfig.build.json src scripts tests .github docs CHANGELOG.md
```

Require every changed file to implement a design requirement. Remove unrelated refactors.

- [ ] **Step 2: Push the implementation branch**

```bash
git push --set-upstream origin feat/versioned-cli-release
```

- [ ] **Step 3: Open a draft PR**

Use title:

```text
Build versioned installation-tested LORE CLI releases
```

The body must summarize:

- CLI-only scoped package contract;
- initial bootstrap version and stable `0.1.0` follow-up;
- exact tarball inventory and integrity evidence;
- Linux/macOS/Windows local/global installation matrix;
- protected OIDC stable publication;
- idempotent npm and GitHub Release recovery;
- exact-head verification results;
- owner-only post-merge gates that remain.

- [ ] **Step 4: Keep the PR draft until exact-head CI and independent review pass**

Do not publish the repository, package, tag, or GitHub Release from the implementation PR. Do not configure npm trusted publishing before the bootstrap package exists.

- [ ] **Step 5: Handoff the owner-only sequence after merge**

The handoff order is exactly:

1. Re-run disclosure/publication gate at merged exact head.
2. Change LORE repository visibility to public.
3. Configure protected `v*` tags and `npm` environment.
4. Create and publish GitHub prerelease `v0.0.0-bootstrap.0`.
5. Wait for cross-platform tests and attached bootstrap artifact.
6. Manually publish that exact tarball with 2FA and dist-tag `bootstrap`.
7. Configure npm trusted publishing for `release.yml` and environment `npm`.
8. Restrict token publishing and revoke obsolete automation tokens.
9. Open the small `0.1.0` release PR.
10. Manually publish GitHub Release `v0.1.0` and approve the `npm` environment.
11. Verify npm provenance, registry integrity, and GitHub assets.
12. Deprecate the bootstrap version.
