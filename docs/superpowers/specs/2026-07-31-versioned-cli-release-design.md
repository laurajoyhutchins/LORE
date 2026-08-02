# Versioned CLI Release Design

**Status:** Approved design, pending implementation plan  
**Date:** 2026-07-31  
**Target release:** `@laurajoyhutchins/lore@0.1.0`

## 1. Purpose

LORE is ready for controlled use as a repository tool, but its current package is not a consumable release artifact. The package is named `lore`, has version `0.0.0`, is marked private, points its executable at `dist/cli/main.js`, and does not distribute the compiled output or initialization assets required by `lore init`.

This design establishes a versioned, installation-tested, provenance-backed CLI distribution suitable for use by repositories such as `engineering-agent-team`.

The release system must prove that the bytes published to npm are the same bytes installed and exercised on Linux, macOS, and Windows.

## 2. Goals

The first release must:

1. Publish a public scoped package named `@laurajoyhutchins/lore`.
2. Define the CLI as the only supported public compatibility surface.
3. Publish `0.1.0` from a public GitHub repository through npm trusted publishing.
4. Build one canonical package tarball, test that exact tarball on all supported platforms, and publish those same bytes.
5. Support Node.js 22 or newer on Linux, macOS, and Windows.
6. Verify both local project installation and global installation.
7. Exercise real initialized-repository behavior after installation.
8. Attach the tested tarball, checksums, and machine-readable release evidence to the matching GitHub Release.
9. Fail closed on package identity, version, artifact, provenance, integrity, or installation mismatches.
10. Preserve an auditable one-time bootstrap path required to configure npm trusted publishing.

## 3. Non-goals

The first release will not:

- publish or support a TypeScript library API;
- expose internal modules through package exports;
- promise stability for internal source layout;
- automate semantic version selection or changelog authoring;
- automatically create release tags or GitHub Releases after merging ordinary changes;
- publish from branches, pull requests, local developer machines, or long-lived npm tokens;
- support Node.js versions older than 22;
- make the npm package a runtime dependency of repositories that only need LORE as a development tool;
- solve reproducible dependency installation for every downstream repository;
- guarantee byte-for-byte reproducibility from two independent source builds in this release.

## 4. Release identity and compatibility boundary

### 4.1 Package identity

The package name is:

```text
@laurajoyhutchins/lore
```

The executable remains:

```text
lore
```

The initial stable version is:

```text
0.1.0
```

The repository must be public before the stable package is published.

### 4.2 Supported public surface

The supported public surface is the documented CLI:

- command names;
- command arguments and flags;
- documented exit codes;
- documented standard output and standard error behavior;
- documented machine-readable output, including `lore version --json`.

Internal TypeScript modules, declaration files, source paths, and functions are not public APIs. The package will define no library entry point and no general-purpose `exports` map.

### 4.3 Version command

The CLI adds:

```text
lore version
lore version --json
```

Human-readable output reports the package name and version.

JSON output has a stable top-level shape:

```json
{
  "name": "@laurajoyhutchins/lore",
  "version": "0.1.0",
  "node": "22.18.0",
  "schema_versions": {
    "manifest": 1,
    "record": 1,
    "proposal": 1,
    "task": 1,
    "hydration": 1,
    "transaction": 1
  }
}
```

`node` reports the executing Node.js runtime. Package name and version are loaded from installed package metadata. Supported schema versions come from one explicit release metadata module. They are not inferred by scraping schema files at runtime.

The Git commit is not injected dynamically into the package. Source identity is established by the release tag, GitHub Release target, npm provenance statement, attached checksums, and release evidence.

## 5. Package contents

The npm tarball uses a strict `files` allowlist and contains only:

```text
dist/
BOOTSTRAP.md
schemas/
skills/maintain-repository-documentation/
README.md
LICENSE
package.json
```

The tarball excludes:

- TypeScript source;
- tests and fixtures;
- coverage data;
- generated self-hosting records and projections not required by consumers;
- repository release scripts;
- GitHub configuration;
- development caches;
- lockfile restoration artifacts;
- local environment files;
- unrelated documentation.

The package must include every runtime module imported by the CLI and every template copied by `lore init`.

A dedicated release build configuration compiles runtime source only. It does not compile tests or Vitest configuration and does not emit declaration files, because declarations would imply a supported library surface.

`package.json` will:

- set `name` to `@laurajoyhutchins/lore`;
- set `version` to the release version;
- remove `private: true`;
- retain `type: module`;
- retain `bin.lore = ./dist/cli/main.js`;
- require Node.js 22 or newer;
- define the strict `files` allowlist;
- define `publishConfig.access = public`;
- run the deterministic release build through `prepack`;
- define explicit package verification and smoke-test scripts.

## 6. Build and artifact architecture

The release pipeline follows one invariant:

> Build once, test the exact artifact, publish the same bytes.

A single Linux build job performs the following:

1. Check out the exact release tag with complete Git history.
2. Verify that the tag is exactly `v${package.version}`.
3. Verify that the GitHub Release target and checked-out commit are identical.
4. Run the existing complete source-tree release gate.
5. Run `npm pack --json`, which invokes the release `prepack` build.
6. Require exactly one package tarball.
7. Inspect and validate the tarball file inventory.
8. Calculate byte count, SHA-256, and SHA-512 integrity.
9. Produce a machine-readable evidence document.
10. Upload the tarball and evidence as workflow artifacts.

No downstream job rebuilds or repacks LORE. Platform tests and publication download the canonical tarball produced by this job.

## 7. Packed-artifact contract

A package-contract verifier reads the packed tarball rather than trusting the source `files` declaration alone.

It must:

- require the exact package name and version;
- require exactly one executable mapping for `lore`;
- require `dist/cli/main.js`;
- require all transitive runtime files under `dist/`;
- require `BOOTSTRAP.md`;
- require every schema copied or read by the installed CLI;
- require every maintainer-skill file copied by `lore init`;
- require `README.md`, `LICENSE`, and `package.json`;
- reject paths outside the approved package allowlist;
- reject source TypeScript, tests, fixtures, release scripts, repository records, generated self-hosting state, symlinks, and unexpected binaries;
- require the CLI entry point to retain the Node shebang;
- record a complete sorted file inventory.

The verifier emits `release-evidence.json` containing at least:

```json
{
  "schema_version": 1,
  "package": {
    "name": "@laurajoyhutchins/lore",
    "version": "0.1.0"
  },
  "source": {
    "repository": "laurajoyhutchins/LORE",
    "tag": "v0.1.0",
    "commit": "<40-character commit>"
  },
  "artifact": {
    "filename": "laurajoyhutchins-lore-0.1.0.tgz",
    "bytes": 0,
    "sha256": "<hex>",
    "integrity": "sha512-<base64>"
  },
  "files": []
}
```

The implementation may add fields, but must not make existing required fields ambiguous.

## 8. Installation verification matrix

The supported matrix is:

| Operating system | Node.js | Local install | Global install | Functional smoke |
| --- | --- | --- | --- | --- |
| Linux | 22 | Required | Required | Required |
| macOS | 22 | Required | Required | Required |
| Windows | 22 | Required | Required | Required |

Every matrix job downloads and verifies the same canonical tarball and evidence file. It recalculates integrity before installation.

### 8.1 Local installation

Each platform creates an empty consumer project and runs the equivalent of:

```bash
npm init --yes
npm install <exact-tarball>
npm exec lore -- --help
npm exec lore -- version --json
```

The test verifies that the installed package metadata and reported CLI version match the release evidence.

### 8.2 Global installation

Each platform installs the same tarball globally and runs:

```bash
npm install --global <exact-tarball>
lore --help
lore version --json
```

This proves Unix executable linking and Windows command-wrapper behavior.

### 8.3 Functional fresh-repository smoke

Each local and global installation path exercises a fresh Git repository without accessing the LORE source checkout:

1. Create an empty directory.
2. Run `git init`.
3. Configure a local test author identity.
4. Run `lore init --id installation-smoke --name "Installation Smoke"`.
5. Verify every required template and manifest path.
6. Run `lore extract`.
7. Run `lore validate`.
8. Run `lore project`.
9. Run `lore extract --check`.
10. Run `lore project --check`.
11. Add and commit all initialized state.
12. Require a clean Git working tree.

The smoke test must set no path that permits imports or template reads from the source checkout.

## 9. Source-tree and artifact gates

The current `release:verify` command remains the authoritative source-tree release gate. It continues to verify:

- clean-tree state;
- reachable-history disclosure checks;
- sensitive filename and content scans;
- the exact verified lockfile artifact;
- the pinned pnpm version;
- frozen dependency installation;
- type checking;
- linting;
- unit and integration tests;
- runtime build;
- extraction drift;
- repository validation;
- projection drift;
- self-verification;
- final clean-tree state.

The packed-artifact gate is separate. Source verification proves the repository. Artifact verification proves the package users receive.

Ordinary pull-request CI should pack and smoke-test locally on Linux to catch package regressions early. The full Linux, macOS, and Windows matrix is required for the release tag.

## 10. Release authorization and workflow

### 10.1 Release preparation

A release PR updates:

- package version;
- changelog or release notes source;
- release metadata where required;
- generated documentation affected by the public package identity;
- tests and snapshots tied to the version.

The release PR passes ordinary CI and source/artifact checks before merge.

### 10.2 Owner-controlled release action

After the release PR merges to public `main`, Laura manually creates the matching protected tag and GitHub Release.

For `0.1.0`, the tag is:

```text
v0.1.0
```

The release workflow triggers only from the published GitHub Release and verifies that the release tag, package version, release target, and checked-out commit agree exactly.

### 10.3 Protected npm environment

The publish job uses a protected GitHub environment named `npm` with:

- required owner approval;
- tag restrictions limited to release tags;
- no branch deployment;
- the npm trusted-publisher relationship bound to the exact public repository, workflow file, and environment.

Only the publish job receives `id-token: write`.

Workflow permissions default to `contents: read`. The final publish/attachment job may receive narrowly scoped `contents: write` and `id-token: write` permissions. Test jobs receive neither publication nor release-write authority.

### 10.4 Trusted publication

The permanent stable workflow publishes only through npm trusted publishing. There is no token fallback.

The publish command uses the exact previously tested tarball:

```bash
npm publish <canonical-tarball> --access public
```

The workflow does not run `npm publish` from the source directory.

After npm publication, the workflow verifies the registry's recorded package version and integrity before attaching release artifacts.

## 11. Bootstrap publication

npm trusted publishing can be configured only after the package exists. LORE therefore uses one explicit bootstrap version:

```text
0.0.0-bootstrap.0
```

The bootstrap release:

1. Uses the same source gate, package inventory gate, and cross-platform installation matrix.
2. Is attached to a clearly marked GitHub prerelease.
3. Is manually published with 2FA.
4. Uses the non-default npm dist-tag `bootstrap`.
5. Is never assigned the `latest` dist-tag.

After the bootstrap package exists:

1. Configure npm trusted publishing for the exact repository, workflow, and `npm` environment.
2. Remove or disable token-based publication where npm permits.
3. Deprecate the bootstrap version with a message directing users to `0.1.0` after the stable release exists.
4. Publish `0.1.0` only through the permanent trusted-publishing workflow.
5. Assign `latest` only to stable workflow-produced releases.

The immutable bootstrap version remains an auditable record of the registry trust transition.

## 12. Failure and retry semantics

The release workflow must be safe to rerun after partial failure.

Before publication, it queries npm for the exact package version.

### 12.1 Version absent

Publish the tested canonical tarball.

### 12.2 Version present with matching integrity

Treat npm publication as already complete and continue release-attachment and evidence recovery.

### 12.3 Version present with different integrity

Fail with an immutable-version collision. Do not overwrite, unpublish, republish under the same version, or silently continue.

### 12.4 Attachment behavior

The GitHub Release receives:

```text
@laurajoyhutchins-lore-0.1.0.tgz
SHA256SUMS
release-evidence.json
```

The exact filename may follow npm's actual packed filename, but the evidence file is authoritative.

Existing attachments may be reused only when their bytes match the verified artifact identity. A mismatched attachment is a release-integrity failure requiring explicit investigation.

A failure after npm accepts the package but before attachments complete is recoverable by rerunning the workflow. The registry integrity must match before recovery continues.

No automated path deletes a GitHub Release, unpublishes an npm version, changes a tag, or moves a release tag.

## 13. Security properties

The design preserves these properties:

- no long-lived npm token in GitHub secrets;
- no publication authority in pull-request workflows;
- no publication from forks or untrusted events;
- no source-directory publish that can include untested files;
- no rebuild between artifact test and publication;
- no unverified package attachment;
- no mutable release-tag movement;
- no implicit library API commitment;
- no fallback when OIDC identity or provenance cannot be established;
- no package initialization dependency on the original source checkout.

The repository publication gate must pass at the exact release commit before the repository is made public and before stable publication proceeds.

## 14. Test strategy

### 14.1 Unit tests

Add focused tests for:

- `lore version` human-readable output;
- `lore version --json` structure and values;
- release metadata consistency;
- package inventory allowlist enforcement;
- missing required package files;
- unexpected package files;
- checksum and integrity calculation;
- tag/version matching;
- registry integrity comparison;
- immutable-version collision handling.

### 14.2 Integration tests

Add integration tests that:

- build and pack the package;
- install the tarball into a temporary local project;
- run the installed executable;
- initialize a temporary Git repository;
- verify every required template;
- complete extraction, validation, projection, and drift checks;
- prove the installed package never reads templates from the source checkout.

### 14.3 Release workflow tests

The release matrix proves:

- npm local binary resolution on Linux, macOS, and Windows;
- global executable resolution on Linux, macOS, and Windows;
- installed `lore init` behavior;
- installed repository workflow behavior;
- identical tarball integrity on all platforms.

Publication itself is not exercised in pull-request CI.

## 15. Operational evidence

Every stable release preserves:

- exact source commit;
- exact release tag;
- package name and version;
- exact tarball bytes;
- SHA-256 checksum;
- npm SHA-512 integrity;
- complete package file inventory;
- platform matrix results in GitHub Actions;
- npm provenance generated by trusted publishing;
- GitHub Release attachments.

The release evidence is sufficient for `engineering-agent-team` and offline-execution to pin and verify an exact CLI artifact without relying on a floating branch.

## 16. Rollout sequence

Implementation proceeds in this order:

1. Add release metadata and `lore version` behavior with tests.
2. Split the runtime release build from repository test compilation.
3. Define the scoped package metadata and strict package allowlist.
4. Add package inventory and integrity tooling.
5. Add local installed-artifact integration tests.
6. Add ordinary CI package smoke testing.
7. Add the protected cross-platform release workflow.
8. Update public README, contribution, security, and release documentation.
9. Run and verify the bootstrap prerelease artifact matrix.
10. Complete the repository public-visibility gates.
11. Manually publish `0.0.0-bootstrap.0` with 2FA under `bootstrap`.
12. Configure npm trusted publishing and the protected GitHub environment.
13. Prepare and merge the `0.1.0` release PR.
14. Manually create the protected `v0.1.0` GitHub Release.
15. Verify trusted publication, provenance, attachments, and registry integrity.
16. Deprecate the bootstrap version.
17. Integrate the pinned stable CLI into `engineering-agent-team` as a development tool.

## 17. Acceptance criteria

The implementation is complete when all of the following are true:

1. `npm pack` creates exactly one minimal tarball for `@laurajoyhutchins/lore`.
2. The tarball contains all and only the approved runtime and initialization assets.
3. `lore version` and `lore version --json` report the installed package correctly.
4. The exact tarball passes local and global installation tests on Linux, macOS, and Windows with Node.js 22.
5. The installed CLI initializes and operates on a fresh Git repository without source-checkout access.
6. The source release gate and artifact release gate both pass at the exact tagged commit.
7. The one-time bootstrap version is published under `bootstrap` and is not `latest`.
8. npm trusted publishing is bound to the exact public repository, workflow, and protected environment.
9. `0.1.0` is published through OIDC from the exact tested tarball with npm provenance.
10. The matching GitHub Release contains the tarball, checksum file, and release evidence.
11. Registry integrity matches the attached and tested artifact.
12. A rerun safely recovers from completed npm publication without duplicating or changing the version.
13. `engineering-agent-team` can install a pinned `@laurajoyhutchins/lore@0.1.0` development dependency and run the CLI without checking out LORE source.

## 18. Expected implementation surfaces

The implementation plan is expected to touch or add bounded files in these areas:

```text
package.json
tsconfig.json
tsconfig.build.json
src/cli/main.ts
src/cli/output.ts
src/release/metadata.ts
tests/unit/cli/
tests/unit/release/
tests/integration/package/
scripts/package-contract.mjs
scripts/package-smoke.mjs
scripts/release-evidence.mjs
.github/workflows/ci.yml
.github/workflows/release.yml
README.md
CONTRIBUTING.md
SECURITY.md
docs/releasing.md
docs/public-release-readiness.md
```

Exact file boundaries may be refined during implementation planning, but the CLI-only package contract and build-once artifact identity must not be weakened.
