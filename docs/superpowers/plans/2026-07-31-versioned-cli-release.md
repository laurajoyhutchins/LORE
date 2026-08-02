# Versioned CLI Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a scoped LORE CLI package whose exact tarball bytes are inspected, installed, and functionally tested on Linux, macOS, and Windows before protected npm publication.

**Architecture:** LORE remains CLI-only. One Linux job creates a canonical npm tarball, release tooling reads the actual gzip/tar bytes and records their identities, all platform jobs install that same tarball in local and isolated-global modes, and the publish job either publishes those bytes or proves an identical version already exists. Source verification, package verification, registry recovery, and GitHub Release attachment remain separate fail-closed units.

**Tech Stack:** TypeScript 5.9, Node.js 22.14.0 or newer, npm 11.5.1 or newer for trusted publishing, pnpm 10.14.0, Vitest, Node ESM scripts, GitHub Actions, npm OIDC trusted publishing.

## Global Constraints

- Public package: `@laurajoyhutchins/lore`.
- Executable: `lore`.
- Implementation release candidate: `0.0.0-bootstrap.0` under npm dist-tag `bootstrap`.
- First stable release: `0.1.0` after trusted publishing is configured.
- Public compatibility surface: documented CLI only. Do not add `main`, `module`, `types`, or a library `exports` map.
- Runtime engine: `node >=22`.
- Trusted publication floor: Node `>=22.14.0`, npm `>=11.5.1`.
- Add no runtime dependency.
- Package allowlist: `dist/`, `BOOTSTRAP.md`, `schemas/`, `skills/maintain-repository-documentation/`, `README.md`, `LICENSE`, and npm-required metadata.
- The canonical tarball is built once. Matrix jobs may not rebuild or repack it.
- Required matrix: Linux, macOS, Windows; local install, isolated-global install, and fresh-repository functional smoke on each.
- Stable publication occurs only from a published GitHub Release with tag `v${package.version}`.
- Stable publication uses the exact `.github/workflows/release.yml` workflow, protected environment `npm`, and npm OIDC. No token fallback.
- Automated code may not move tags, delete releases, unpublish versions, or overwrite mismatched assets.
- Preserve the existing verified lockfile and `release:verify` contracts.

---

## File Responsibilities

- `package.json`: package identity, bootstrap version, allowlist, `bin`, scripts, public access.
- `tsconfig.build.json`: runtime-only build rooted at `src/`.
- `src/release/metadata.ts`: installed package identity and schema versions.
- `src/cli/version.ts`: version formatting.
- `scripts/lib/tarball.mjs`: exact tar parsing and hashes.
- `scripts/lib/package-contract.mjs`: package inventory verification and base evidence.
- `scripts/build-package-artifact.mjs`: pack one tarball and emit evidence/checksum files.
- `scripts/smoke-installed-package.mjs`: local/global install and repository workflow.
- `scripts/lib/npm-registry.mjs`: absent/matching/conflicting npm version decisions.
- `scripts/publish-package.mjs`: idempotent exact-artifact publication.
- `scripts/lib/github-release-assets.mjs`: absent/matching/conflicting asset decisions.
- `scripts/attach-release-assets.mjs`: idempotent release attachment.
- `scripts/finalize-release-evidence.mjs`: merge the three platform reports.
- `.github/workflows/release.yml`: canonical build, matrix, bootstrap attachment, stable publication.
- `docs/releasing.md`: exact owner runbook.

---

### Task 1: Define the scoped package and runtime-only build

**Files:**
- Create: `tests/unit/package/package-metadata.test.ts`
- Create: `tests/integration/package/build-layout.test.ts`
- Create: `tsconfig.build.json`
- Modify: `package.json`

**Interfaces:**
- Produces `dist/cli/main.js` and runtime JavaScript only.
- Produces package identity `@laurajoyhutchins/lore@0.0.0-bootstrap.0`.

- [ ] **Step 1: Write the failing metadata test**

```ts
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

it("defines the CLI-only bootstrap package", async () => {
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  expect(pkg.name).toBe("@laurajoyhutchins/lore");
  expect(pkg.version).toBe("0.0.0-bootstrap.0");
  expect(pkg.private).toBeUndefined();
  expect(pkg.bin).toEqual({ lore: "./dist/cli/main.js" });
  expect(pkg.files).toEqual([
    "dist/",
    "BOOTSTRAP.md",
    "schemas/",
    "skills/maintain-repository-documentation/",
    "README.md",
    "LICENSE",
  ]);
  expect(pkg.publishConfig).toEqual({ access: "public" });
  expect(pkg.engines).toEqual({ node: ">=22" });
  expect(pkg.main).toBeUndefined();
  expect(pkg.module).toBeUndefined();
  expect(pkg.types).toBeUndefined();
  expect(pkg.exports).toBeUndefined();
});
```

- [ ] **Step 2: Verify the test fails**

```bash
corepack pnpm vitest run tests/unit/package/package-metadata.test.ts
```

Expected: failure on current unscoped/private metadata.

- [ ] **Step 3: Update package metadata**

Set the tested values exactly. Remove `private`. Retain `license`, `type`, repository, homepage, bugs, keywords, dependencies, devDependencies, and `packageManager`.

- [ ] **Step 4: Write the failing build-layout test**

```ts
import { access, readdir, rm } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

it("emits runtime JavaScript without tests, maps, or declarations", async () => {
  await rm("dist", { recursive: true, force: true });
  const run = spawnSync("corepack", ["pnpm", "build"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  expect(run.status, run.stderr).toBe(0);
  await expect(access("dist/cli/main.js")).resolves.toBeUndefined();
  const names = (await readdir("dist", { recursive: true })).map(String);
  expect(names.some((name) => name.includes("tests"))).toBe(false);
  expect(names.some((name) => name.endsWith(".d.ts"))).toBe(false);
  expect(names.some((name) => name.endsWith(".map"))).toBe(false);
});
```

- [ ] **Step 5: Verify the build test fails**

```bash
corepack pnpm vitest run tests/integration/package/build-layout.test.ts
```

Expected: current build layout does not satisfy the contract.

- [ ] **Step 6: Add `tsconfig.build.json`**

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

Set scripts:

```json
{
  "build": "tsc -p tsconfig.build.json",
  "prepack": "corepack pnpm build"
}
```

- [ ] **Step 7: Run and commit**

```bash
corepack pnpm vitest run tests/unit/package/package-metadata.test.ts tests/integration/package/build-layout.test.ts
corepack pnpm build
node dist/cli/main.js --help
git add package.json tsconfig.build.json tests/unit/package/package-metadata.test.ts tests/integration/package/build-layout.test.ts
git commit -m "build: define scoped CLI package boundary"
```

---

### Task 2: Add `lore version` and stable JSON metadata

**Files:**
- Create: `src/release/metadata.ts`
- Create: `src/cli/version.ts`
- Modify: `src/cli/output.ts`
- Modify: `src/cli/main.ts`
- Modify: `tests/unit/cli/main.test.ts`

**Interfaces:**

```ts
export interface LoreVersionInfo {
  name: string;
  version: string;
  node: string;
  schema_versions: Readonly<{
    manifest: 1;
    record: 1;
    proposal: 1;
    task: 1;
    hydration: 1;
    transaction: 1;
  }>;
}

export async function createVersionInfo(): Promise<LoreVersionInfo>;
export function formatVersion(info: LoreVersionInfo, json: boolean): string;
```

- [ ] **Step 1: Add failing tests**

```ts
it("reports the installed package outside a LORE repository", async () => {
  const stdout = vi.fn();
  const stderr = vi.fn();
  expect(await runCli(["version"], { stdout, stderr })).toBe(0);
  expect(stderr).not.toHaveBeenCalled();
  expect(stdout).toHaveBeenCalledWith("@laurajoyhutchins/lore 0.0.0-bootstrap.0");
});

it("reports stable version JSON", async () => {
  const stdout = vi.fn();
  expect(await runCli(["version", "--json"], { stdout, stderr: vi.fn() })).toBe(0);
  expect(JSON.parse(String(stdout.mock.calls[0]?.[0]))).toEqual({
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

Require help output to include `version`.

- [ ] **Step 2: Verify failure**

```bash
corepack pnpm vitest run tests/unit/cli/main.test.ts
```

Expected: unknown command.

- [ ] **Step 3: Implement metadata**

`src/release/metadata.ts` reads `../../package.json` relative to `import.meta.url`, requires the exact scoped name and a string version, reports `process.versions.node`, and exports one frozen schema-version object.

`src/cli/version.ts` returns either two-space JSON or `${name} ${version}`.

- [ ] **Step 4: Route before repository validation**

Add `version` to `COMMANDS`. In `runCli`, handle `version` after help/command parsing and before `validateRepository(root)`:

```ts
if (command === "version") {
  const args = requirePositionals(command, positionals, 0);
  if (!args.ok) return printProblems(io, args);
  io.stdout(formatVersion(await createVersionInfo(), parsed.values.json === true));
  return 0;
}
```

- [ ] **Step 5: Run and commit**

```bash
corepack pnpm vitest run tests/unit/cli/main.test.ts
corepack pnpm build
node dist/cli/main.js version --json
git add src/release/metadata.ts src/cli/version.ts src/cli/output.ts src/cli/main.ts tests/unit/cli/main.test.ts
git commit -m "feat: report installed LORE version"
```

---

### Task 3: Parse exact tarball bytes and compute artifact identities

**Files:**
- Create: `scripts/lib/tarball.mjs`
- Create: `tests/release/tarball.test.mjs`
- Modify: `vitest.config.ts`

**Interfaces:**

```js
export function readTarGzip(bytes); // => [{ name, type, mode, size, content }]
export function sha256Hex(bytes);
export function sha512Integrity(bytes);
```

- [ ] **Step 1: Add `.mjs` discovery**

```ts
include: ["tests/**/*.test.ts", "tests/**/*.test.mjs"]
```

- [ ] **Step 2: Write failing tests**

Create a test-only POSIX tar builder and assert:

```js
it("preserves exact entry bytes and modes", () => {
  const archive = makeTarGzip([
    { name: "package/dist/cli/main.js", mode: 0o755, content: "#!/usr/bin/env node\n" },
  ]);
  expect(readTarGzip(archive)).toMatchObject([
    {
      name: "package/dist/cli/main.js",
      type: "0",
      mode: 0o755,
      size: 20,
    },
  ]);
});

it.each([
  ["truncated body", makeTruncatedArchive(), "TAR_ENTRY_TRUNCATED"],
  ["invalid octal", makeInvalidOctalArchive(), "TAR_OCTAL_INVALID"],
  ["parent path", makeTarGzip([{ name: "package/../escape", content: "x" }]), "TAR_PATH_INVALID"],
])("rejects %s", (_name, archive, code) => {
  expect(() => readTarGzip(archive)).toThrow(code);
});

it("computes stable digests", () => {
  const bytes = Buffer.from("lore");
  expect(sha256Hex(bytes)).toMatch(/^[0-9a-f]{64}$/);
  expect(sha512Integrity(bytes)).toMatch(/^sha512-[A-Za-z0-9+/]+=*$/);
});
```

- [ ] **Step 3: Verify failure**

```bash
corepack pnpm vitest run tests/release/tarball.test.mjs
```

- [ ] **Step 4: Implement parser**

Use only `node:zlib` and `node:crypto`. Read 512-byte headers, require two terminal zero blocks, parse validated octal mode/size fields, combine prefix and name, reject absolute/parent/duplicate paths, slice exact bodies, and reject truncated or trailing non-zero bytes.

- [ ] **Step 5: Run and commit**

```bash
corepack pnpm vitest run tests/release/tarball.test.mjs
corepack pnpm test
git add vitest.config.ts scripts/lib/tarball.mjs tests/release/tarball.test.mjs
git commit -m "test: inspect exact package tar bytes"
```

---

### Task 4: Verify the package inventory and build canonical evidence

**Files:**
- Create: `scripts/lib/package-contract.mjs`
- Create: `scripts/build-package-artifact.mjs`
- Create: `tests/release/package-contract.test.mjs`
- Modify: `package.json`

**Interfaces:**

```js
export async function inspectPackageArtifact({
  tarballPath,
  repository,
  tag,
  commit,
});
```

Evidence shape:

```json
{
  "schema_version": 1,
  "package": { "name": "@laurajoyhutchins/lore", "version": "0.0.0-bootstrap.0" },
  "source": { "repository": "laurajoyhutchins/LORE", "tag": "v0.0.0-bootstrap.0", "commit": "40 hexadecimal characters" },
  "artifact": { "filename": "npm-generated filename", "bytes": 1, "sha256": "64 hexadecimal characters", "integrity": "sha512-base64" },
  "files": [],
  "platforms": []
}
```

- [ ] **Step 1: Write failing contract tests**

Require exact package name/version/bin, `tag === v${version}`, a 40-hex commit, CLI mode with an execute bit, Node shebang, no symlinks, no NUL-containing file bodies, and these files:

```js
const REQUIRED = [
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
```

Table-test rejection of these paths and exact errors:

```js
[
  ["package/src/index.ts", "PACKAGE_PATH_NOT_ALLOWED"],
  ["package/tests/main.test.ts", "PACKAGE_PATH_NOT_ALLOWED"],
  ["package/scripts/release.mjs", "PACKAGE_PATH_NOT_ALLOWED"],
  ["package/.lore/records/x.yaml", "PACKAGE_PATH_NOT_ALLOWED"],
]
```

- [ ] **Step 2: Verify failure**

```bash
corepack pnpm vitest run tests/release/package-contract.test.mjs
```

- [ ] **Step 3: Implement contract verification**

Allow exact top-level files plus prefixes `package/dist/`, `package/schemas/`, and `package/skills/maintain-repository-documentation/`. Permit directory entries only inside allowed prefixes. Sort file inventory before evidence output.

- [ ] **Step 4: Implement canonical packing**

`scripts/build-package-artifact.mjs` accepts exactly:

```text
--tag vX.Y.Z
--commit 40-hex
--output repository-relative-directory
```

It removes/recreates the output directory, runs `npm pack --json --pack-destination`, requires one result, inspects the resulting `.tgz`, writes two-space `release-evidence.json`, and writes:

```text
<sha256><two spaces><tarball filename>
```

to `SHA256SUMS`.

Add only these scripts:

```json
{
  "release:package": "node scripts/build-package-artifact.mjs",
  "release:smoke": "node scripts/smoke-installed-package.mjs"
}
```

- [ ] **Step 5: Run a real pack and commit**

```bash
corepack pnpm vitest run tests/release/package-contract.test.mjs
rm -rf .release-artifacts
corepack pnpm release:package -- --tag v0.0.0-bootstrap.0 --commit "$(git rev-parse HEAD)" --output .release-artifacts
tar -tzf "$(find .release-artifacts -name '*.tgz' -print -quit)"
rm -rf .release-artifacts
git add package.json scripts/lib/package-contract.mjs scripts/build-package-artifact.mjs tests/release/package-contract.test.mjs
git commit -m "build: verify exact npm package contents"
```

---

### Task 5: Smoke-test installed local and isolated-global CLIs

**Files:**
- Create: `scripts/smoke-installed-package.mjs`
- Create: `tests/release/installed-smoke.test.mjs`

**Interfaces:**

```text
node scripts/smoke-installed-package.mjs \
  --tarball absolute-or-relative-file \
  --mode local|global|all \
  --report output-json
```

Report:

```json
{
  "schema_version": 1,
  "platform": "linux|darwin|win32",
  "node": "runtime version",
  "modes": [
    { "mode": "local", "passed": true },
    { "mode": "global", "passed": true }
  ]
}
```

- [ ] **Step 1: Write failing helper tests**

```js
it("resolves isolated global wrappers", () => {
  expect(globalExecutable("win32")).toBe("lore.cmd");
  expect(globalPathDirectory("C:\\prefix", "win32")).toBe("C:\\prefix");
  expect(globalExecutable("linux")).toBe("lore");
  expect(globalPathDirectory("/tmp/prefix", "linux")).toBe("/tmp/prefix/bin");
});
```

- [ ] **Step 2: Verify failure**

```bash
corepack pnpm vitest run tests/release/installed-smoke.test.mjs
```

- [ ] **Step 3: Implement local installation**

In a temporary consumer:

```text
npm init --yes
npm install <tarball>
npm exec -- lore --help
npm exec -- lore version --json
```

Capture version JSON and require name/version to match the tarball package metadata.

- [ ] **Step 4: Implement isolated-global installation**

```text
npm install --global --prefix <temporary-prefix> <tarball>
```

Prepend `<prefix>/bin` on Unix or `<prefix>` on Windows to `PATH`, then run direct `lore`/`lore.cmd` help and version commands. Do not modify the runner's normal global npm prefix.

- [ ] **Step 5: Run the functional repository workflow in both modes**

For each launcher:

```text
git init
git config user.name "LORE Installation Test"
git config user.email "lore-installation-test@example.invalid"
lore init --id installation-smoke --name "Installation Smoke"
verify all required bootstrap/schema/skill paths
lore extract
lore validate
lore project
lore extract --check
lore project --check
git add .
git commit -m "Initialize LORE smoke repository"
git status --porcelain=v1
```

Require empty final status. Remove `NODE_PATH`, `TSX_TSCONFIG_PATH`, and variables beginning `LORE_SOURCE_` from child environments.

- [ ] **Step 6: Run the exact artifact and commit**

```bash
rm -rf .release-artifacts
corepack pnpm release:package -- --tag v0.0.0-bootstrap.0 --commit "$(git rev-parse HEAD)" --output .release-artifacts
TARBALL="$(find .release-artifacts -name '*.tgz' -print -quit)"
corepack pnpm release:smoke -- --tarball "$TARBALL" --mode all --report .release-artifacts/smoke-linux.json
rm -rf .release-artifacts
git add scripts/smoke-installed-package.mjs tests/release/installed-smoke.test.mjs
git commit -m "test: smoke test installed CLI artifacts"
```

---

### Task 6: Integrate the package smoke into the source release gate

**Files:**
- Create: `scripts/lib/release-gate-state.mjs`
- Create: `tests/release/release-gate-state.test.mjs`
- Modify: `scripts/public-release-gate.mjs`

**Interfaces:**

```js
export const GATE_TEMPORARY_PATHS = Object.freeze([
  "pnpm-lock.yaml",
  ".release-artifacts",
]);

export function removeGateTemporaryPaths({ lockfileCreated });
```

- [ ] **Step 1: Write the failing cleanup contract test**

```js
it("declares every gate-created path", () => {
  expect(GATE_TEMPORARY_PATHS).toEqual([
    "pnpm-lock.yaml",
    ".release-artifacts",
  ]);
});
```

- [ ] **Step 2: Verify failure**

```bash
corepack pnpm vitest run tests/release/release-gate-state.test.mjs
```

- [ ] **Step 3: Implement cleanup state**

The helper removes `.release-artifacts` recursively on every exit and removes `pnpm-lock.yaml` only when the verified-lockfile restorer created it.

- [ ] **Step 4: Extend `public-release-gate.mjs`**

After `pnpm(["build"])`, read package version, build `.release-artifacts`, require exactly one `.tgz`, and run the smoke script with `--mode all`. Import `path`, `readdirSync`, and the cleanup helper explicitly. Call cleanup before the final clean-tree check and from the catch path.

- [ ] **Step 5: Run twice and commit**

```bash
node scripts/restore-verified-lockfile.mjs
corepack pnpm install --frozen-lockfile
corepack pnpm release:verify
corepack pnpm release:verify
git status --short
git add scripts/lib/release-gate-state.mjs tests/release/release-gate-state.test.mjs scripts/public-release-gate.mjs
git commit -m "ci: gate installed package behavior"
```

Expected: both gates pass at the same exact head and leave no temporary state.

---

### Task 7: Implement idempotent npm and GitHub Release recovery

**Files:**
- Create: `scripts/lib/npm-registry.mjs`
- Create: `scripts/publish-package.mjs`
- Create: `tests/release/npm-registry.test.mjs`
- Create: `scripts/lib/github-release-assets.mjs`
- Create: `scripts/attach-release-assets.mjs`
- Create: `tests/release/github-release-assets.test.mjs`

**Interfaces:**

```js
export function classifyPublishedVersion(expectedIntegrity, observedIntegrity);
export function classifyReleaseAsset(expectedSha256, observedSha256);
```

Both return `absent`, `matching`, or `conflict`.

- [ ] **Step 1: Write failing decision tests**

```js
expect(classifyPublishedVersion("sha512-AAAA", null)).toBe("absent");
expect(classifyPublishedVersion("sha512-AAAA", "sha512-AAAA")).toBe("matching");
expect(classifyPublishedVersion("sha512-AAAA", "sha512-BBBB")).toBe("conflict");
expect(classifyReleaseAsset("a".repeat(64), null)).toBe("absent");
expect(classifyReleaseAsset("a".repeat(64), "a".repeat(64))).toBe("matching");
expect(classifyReleaseAsset("a".repeat(64), "b".repeat(64))).toBe("conflict");
```

Use valid base64 integrity fixtures in the actual npm tests and reject malformed values.

- [ ] **Step 2: Verify failure**

```bash
corepack pnpm vitest run tests/release/npm-registry.test.mjs tests/release/github-release-assets.test.mjs
```

- [ ] **Step 3: Implement npm lookup/publication**

`readPublishedIntegrity(name, version)` runs:

```text
npm view <name>@<version> dist.integrity --json
```

Only `E404` means absent. `publish-package.mjs` recalculates the tarball hashes, requires evidence agreement, classifies registry state, runs `npm publish <tarball> --access public` only when absent, rejects conflict, and verifies registry integrity afterward. It does not read or require `NODE_AUTH_TOKEN`.

- [ ] **Step 4: Implement release asset recovery**

Use `gh api repos/${GITHUB_REPOSITORY}/releases/tags/${tag}`. Download existing required assets through their API URLs, calculate SHA-256, reuse matching bytes, upload absent assets with `gh release upload`, and reject mismatches. Never use `--clobber`.

Required directory inventory: exactly one `.tgz`, `SHA256SUMS`, and `release-evidence.json`.

- [ ] **Step 5: Run and commit**

```bash
corepack pnpm vitest run tests/release/npm-registry.test.mjs tests/release/github-release-assets.test.mjs
git add scripts/lib/npm-registry.mjs scripts/publish-package.mjs tests/release/npm-registry.test.mjs scripts/lib/github-release-assets.mjs scripts/attach-release-assets.mjs tests/release/github-release-assets.test.mjs
git commit -m "build: make package release recovery idempotent"
```

---

### Task 8: Add final evidence and the release workflow

**Files:**
- Create: `scripts/finalize-release-evidence.mjs`
- Create: `.github/workflows/release.yml`
- Create: `tests/release/release-workflow.test.mjs`
- Modify: `.github/workflows/ci.yml`
- Modify: `tests/release/installed-smoke.test.mjs`

**Interfaces:**

```text
node scripts/finalize-release-evidence.mjs \
  --base release-evidence.json \
  --reports report-directory \
  --output final-release-evidence.json
```

Requires exactly `linux`, `darwin`, `win32`; each must contain passing `local` and `global` modes.

- [ ] **Step 1: Write failing finalizer tests**

```js
it("requires all three passing platforms", async () => {
  await expect(finalize(baseEvidence(), [
    report("linux"),
    report("darwin"),
    report("win32"),
  ])).resolves.toMatchObject({
    platforms: [report("linux"), report("darwin"), report("win32")],
  });
});

it.each([
  ["missing", [report("linux"), report("darwin")], "PLATFORM_REPORT_SET_INVALID"],
  ["duplicate", [report("linux"), report("linux"), report("win32")], "PLATFORM_REPORT_SET_INVALID"],
  ["failed mode", [report("linux", false), report("darwin"), report("win32")], "PLATFORM_SMOKE_FAILED"],
])("rejects %s reports", async (_name, reports, code) => {
  await expect(finalize(baseEvidence(), reports)).rejects.toThrow(code);
});
```

- [ ] **Step 2: Write failing workflow tests**

Parse YAML with the existing `yaml` dependency and require:

```js
expect(workflow.on.release.types).toEqual(["published"]);
expect(workflow.permissions).toEqual({ contents: "read" });
expect(workflow.jobs.smoke.strategy.matrix.os).toEqual([
  "ubuntu-latest",
  "macos-latest",
  "windows-latest",
]);
expect(workflow.jobs.publish.environment).toBe("npm");
expect(workflow.jobs.publish.permissions).toEqual({
  contents: "write",
  "id-token": "write",
});
```

Require no `push`, `pull_request`, `workflow_dispatch`, `workflow_call`, or `NODE_AUTH_TOKEN` in `release.yml`.

- [ ] **Step 3: Implement finalizer**

Preserve base evidence exactly except replacing `platforms` with sorted validated reports in order `linux`, `darwin`, `win32`.

- [ ] **Step 4: Create `.github/workflows/release.yml`**

Top-level:

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

Jobs:

1. `build` on `ubuntu-latest`: checkout release tag with full history, Node `22.14.0`, restore/install, verify tag/version/commit/release-prerelease consistency, run `release:verify`, run `release:package`, upload canonical tarball/checksum/base evidence.
2. `smoke` matrix on Ubuntu/macOS/Windows: download canonical artifact, install npm `11.5.1`, verify hashes, run `release:smoke --mode all`, upload normalized platform report. No rebuild or repack.
3. `bootstrap-attach`: prerelease only, `contents: write`, no OIDC/environment; finalize evidence and attach assets.
4. `publish`: stable only, environment `npm`, permissions `contents: write` and `id-token: write`; install npm `11.5.1`, finalize evidence, run exact-artifact publication, then attach assets.

Use `actions/checkout@v6`, `actions/setup-node@v6`, and artifact actions v4. Configure `registry-url: https://registry.npmjs.org` and `package-manager-cache: false` only where needed. Do not pass `--provenance`; trusted publishing creates it.

- [ ] **Step 5: Upgrade CI actions without changing authority**

Use checkout/setup-node v6, retain `permissions: contents: read`, and retain the single unified `node scripts/public-release-gate.mjs` command.

- [ ] **Step 6: Run and commit**

```bash
corepack pnpm vitest run tests/release/installed-smoke.test.mjs tests/release/release-workflow.test.mjs
node -e "import('yaml').then(async ({parse}) => { const fs = await import('node:fs/promises'); parse(await fs.readFile('.github/workflows/ci.yml','utf8')); parse(await fs.readFile('.github/workflows/release.yml','utf8')); })"
git add scripts/finalize-release-evidence.mjs .github/workflows/release.yml .github/workflows/ci.yml tests/release/release-workflow.test.mjs tests/release/installed-smoke.test.mjs
git commit -m "ci: publish tested CLI artifacts with OIDC"
```

---

### Task 9: Document consumer installation and exact release operations

**Files:**
- Create: `docs/releasing.md`
- Create: `CHANGELOG.md`
- Modify: `docs/public-release-readiness.md`
- Modify: `src/projection/templates.ts`
- Modify: `tests/unit/projection/templates.test.ts`
- Regenerate: `README.md`, `.lore/extracted/`, `docs/generated/`

- [ ] **Step 1: Write failing README projection tests**

```ts
expect(readme).toContain("npm install --save-dev @laurajoyhutchins/lore");
expect(readme).toContain("npm exec lore -- --help");
expect(readme).toContain("CLI-only");
expect(readme).not.toContain('keeps `"private": true`');
```

- [ ] **Step 2: Verify failure**

```bash
corepack pnpm vitest run tests/unit/projection/templates.test.ts
```

- [ ] **Step 3: Update generated README source**

Add consumer install/version commands and a separate source-development section. State that internal TypeScript modules are unsupported.

- [ ] **Step 4: Write `docs/releasing.md`**

Include exact sequence:

1. Exact-head source/package gate.
2. Make repository public only after disclosure review.
3. Configure protected `v*` tags and protected environment `npm`.
4. Publish GitHub prerelease `v0.0.0-bootstrap.0`; wait for attached tested artifacts.
5. Download and verify:

```bash
gh release download v0.0.0-bootstrap.0 --pattern '*.tgz' --pattern SHA256SUMS --pattern release-evidence.json
sha256sum --check SHA256SUMS
npm publish ./laurajoyhutchins-lore-0.0.0-bootstrap.0.tgz --access public --tag bootstrap
```

npm prompts for the current 2FA code. Do not put an OTP in a file, command history, or workflow.

6. Configure npm trusted publisher: owner `laurajoyhutchins`, repository `LORE`, workflow `release.yml`, environment `npm`, allowed action `npm publish`.
7. Restrict token publication and revoke obsolete automation tokens.
8. Merge a release PR changing package version/release notes to `0.1.0`.
9. Publish GitHub Release `v0.1.0`, approve environment, and verify registry integrity/provenance/assets.
10. Deprecate bootstrap:

```bash
npm deprecate @laurajoyhutchins/lore@0.0.0-bootstrap.0 "Bootstrap-only release; use 0.1.0 or later."
```

- [ ] **Step 5: Add changelog/readiness gates**

`CHANGELOG.md` contains `Unreleased`, `0.0.0-bootstrap.0`, and planned `0.1.0`. Update readiness with explicit unchecked owner settings and ordering.

- [ ] **Step 6: Regenerate and commit**

```bash
corepack pnpm release:refresh
corepack pnpm vitest run tests/unit/projection/templates.test.ts
corepack pnpm lore extract --check
corepack pnpm lore validate
corepack pnpm lore project --check
git add CHANGELOG.md docs/releasing.md docs/public-release-readiness.md src/projection/templates.ts tests/unit/projection/templates.test.ts README.md .lore/extracted docs/generated
git commit -m "docs: define CLI release operations"
```

---

### Task 10: Exact-head verification and draft PR

**Files:**
- No expected source files. Fix only defects discovered by verification and repeat the affected task's red-green cycle.

- [ ] **Step 1: Restore/install exact dependencies**

```bash
node scripts/restore-verified-lockfile.mjs
corepack enable
corepack pnpm install --frozen-lockfile
```

- [ ] **Step 2: Run complete focused tests**

```bash
corepack pnpm vitest run \
  tests/unit/package/package-metadata.test.ts \
  tests/unit/cli/main.test.ts \
  tests/integration/package/build-layout.test.ts \
  tests/release/tarball.test.mjs \
  tests/release/package-contract.test.mjs \
  tests/release/installed-smoke.test.mjs \
  tests/release/release-gate-state.test.mjs \
  tests/release/npm-registry.test.mjs \
  tests/release/github-release-assets.test.mjs \
  tests/release/release-workflow.test.mjs
```

- [ ] **Step 3: Run the full gate twice**

```bash
corepack pnpm release:verify
corepack pnpm release:verify
```

Both must print `VERIFIED_PUBLICATION_READY` for the same `git rev-parse HEAD`.

- [ ] **Step 4: Independently build and smoke the candidate**

```bash
HEAD_SHA="$(git rev-parse HEAD)"
rm -rf .release-artifacts
corepack pnpm release:package -- --tag v0.0.0-bootstrap.0 --commit "$HEAD_SHA" --output .release-artifacts
TARBALL="$(find .release-artifacts -name '*.tgz' -print -quit)"
corepack pnpm release:smoke -- --tarball "$TARBALL" --mode all --report .release-artifacts/smoke-linux.json
sha256sum --check .release-artifacts/SHA256SUMS
rm -rf .release-artifacts
git status --short
git diff --exit-code
git diff --cached --exit-code
```

Expected: clean tree.

- [ ] **Step 5: Review scope and push**

```bash
git diff main...HEAD --stat
git diff main...HEAD -- package.json tsconfig.build.json src scripts tests .github docs CHANGELOG.md
git push --set-upstream origin feat/versioned-cli-release
```

- [ ] **Step 6: Open a draft PR**

Title:

```text
Build versioned installation-tested LORE CLI releases
```

Body records the actual 40-character head from `git rev-parse HEAD`, each PASS gate, canonical tarball identity, and these explicitly unperformed external effects:

```text
No npm publication performed.
No release tag or GitHub Release created.
No repository visibility changed.
No GitHub environment or npm trusted-publisher setting changed.
```

Keep draft until exact-head CI and independent review pass.

- [ ] **Step 7: Preserve owner-only post-merge order**

1. Exact-head disclosure gate.
2. Public repository visibility.
3. Protected tags and `npm` environment.
4. Bootstrap GitHub prerelease.
5. Tested artifact download and manual 2FA bootstrap publication.
6. npm trusted-publisher configuration.
7. Token restriction/revocation.
8. `0.1.0` release PR.
9. Stable GitHub Release and environment approval.
10. Provenance/integrity/asset verification.
11. Bootstrap deprecation.
