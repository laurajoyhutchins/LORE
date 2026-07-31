# Releasing the LORE CLI

This runbook governs publication of the public CLI package `@laurajoyhutchins/lore`.

The release invariant is:

> Build one canonical tarball, test those exact bytes, and publish the same bytes.

The package is CLI-only. Do not add or publish a library entry point as part of a release.

## Release authority

Ordinary pull requests and pushes have read-only GitHub permissions and no npm publication identity.

A package release begins only when the owner publishes a GitHub Release for an existing immutable tag. The release workflow verifies the tag, package version, release-event commit, public repository visibility, source tree, package inventory, artifact identity, and installed behavior before any external publication or attachment.

The stable `publish` job is the only job with `id-token: write`. It uses the protected GitHub environment `npm` and npm trusted publishing. There is no token fallback.

## Exact-head prerequisite

Run the complete gate from a clean checkout with all reachable refs and tags fetched:

```bash
git fetch --all --tags --prune
corepack pnpm release:verify
```

A passing result ends with:

```text
VERIFIED_PUBLICATION_READY <exact-head-sha>
```

Any subsequent commit invalidates that result.

Before creating a release tag, confirm that the repository is public and that the exact tagged commit passed this gate.

## Repository and GitHub settings

Before the first package release:

1. Make the repository public only after the disclosure review in `docs/public-release-readiness.md` passes.
2. Protect `main` and require the CI verification job.
3. Protect release tags matching `v*` against movement or deletion.
4. Create a protected GitHub environment named `npm`.
5. Require Laura's approval for the `npm` environment.
6. Limit the environment to release tags matching `v*`.
7. Keep the repository Actions default permission read-only.

Do not create an npm token for the permanent release workflow.

## One-time bootstrap release

npm trusted publishing can be configured only after the package exists. The registry is therefore bootstrapped with the prerelease version:

```text
0.0.0-bootstrap.0
```

The bootstrap version must never receive the `latest` dist-tag.

### 1. Prepare the bootstrap commit

The exact release commit must contain:

```json
{
  "name": "@laurajoyhutchins/lore",
  "version": "0.0.0-bootstrap.0"
}
```

Run the exact-head gate and record the resulting commit SHA.

### 2. Create the immutable tag and GitHub prerelease

Create tag `v0.0.0-bootstrap.0` at the verified commit. Publish a GitHub prerelease for that existing tag.

The release workflow must:

1. verify the source tree;
2. build one canonical tarball;
3. install and functionally exercise the same tarball on Linux, macOS, and Windows in local and isolated-global modes;
4. finalize `release-evidence.json`;
5. attach exactly one `.tgz`, `SHA256SUMS`, and `release-evidence.json` to the prerelease.

The prerelease workflow does not publish to npm.

### 3. Download and verify the tested bootstrap artifact

Use a clean directory:

```bash
gh release download v0.0.0-bootstrap.0 \
  --pattern '*.tgz' \
  --pattern SHA256SUMS \
  --pattern release-evidence.json
sha256sum --check SHA256SUMS
```

On Windows PowerShell, calculate the tarball SHA-256 with `Get-FileHash` and compare it with `SHA256SUMS`.

Inspect `release-evidence.json` and require:

- package `@laurajoyhutchins/lore@0.0.0-bootstrap.0`;
- the intended repository, tag, and exact commit;
- passing Linux, macOS, and Windows reports;
- passing `local` and `global` modes on every platform;
- the same tarball filename and SHA-256 as the downloaded artifact.

### 4. Manually publish the exact tarball with 2FA

Publish the downloaded tarball, not the repository directory:

```bash
npm publish ./laurajoyhutchins-lore-0.0.0-bootstrap.0.tgz \
  --access public \
  --tag bootstrap
```

Enter the current npm 2FA code interactively when prompted. Do not put an OTP in a file, shell history, workflow, issue, or pull request.

Verify that the package exists only under the `bootstrap` dist-tag and that `latest` is absent or unchanged.

### 5. Configure npm trusted publishing

Configure the package's trusted publisher with these exact values:

```text
provider: GitHub Actions
owner: laurajoyhutchins
repository: LORE
workflow: release.yml
environment: npm
allowed action: npm publish
```

After trusted publishing is verified:

1. restrict token-based publication where npm permits;
2. revoke obsolete npm automation tokens;
3. keep owner interactive access protected by 2FA;
4. do not add `NODE_AUTH_TOKEN` or `NPM_TOKEN` to GitHub secrets.

## First stable release

The first stable release is `0.1.0`.

### 1. Merge the stable release PR

The release PR changes the package version from `0.0.0-bootstrap.0` to `0.1.0`, updates `CHANGELOG.md`, regenerates LORE projections, and passes the complete source and installed-artifact gate.

No ordinary feature change should be mixed into the release-version commit.

### 2. Create the stable tag and GitHub Release

Create immutable tag `v0.1.0` at the verified release commit. Publish a non-prerelease GitHub Release for that tag.

The workflow verifies:

```text
release tag == v${package.version}
checked-out commit == tag commit == release event SHA
repository visibility == public
```

The owner then approves the protected `npm` environment.

### 3. Verify the completed stable release

Require all of the following:

1. npm records `@laurajoyhutchins/lore@0.1.0`.
2. npm's recorded `dist.integrity` equals the SHA-512 integrity in `release-evidence.json`.
3. npm displays provenance linked to the public LORE repository and `release.yml`.
4. The GitHub Release contains exactly the tested tarball, `SHA256SUMS`, and finalized `release-evidence.json`.
5. The GitHub asset SHA-256 values match the local release evidence.
6. Installing from npm and running `npm exec lore -- version --json` reports `0.1.0`.

### 4. Deprecate the bootstrap version

After `0.1.0` is confirmed healthy:

```bash
npm deprecate @laurajoyhutchins/lore@0.0.0-bootstrap.0 \
  "Bootstrap-only release; use 0.1.0 or later."
```

Do not unpublish the bootstrap version. It is the durable audit record of the registry trust transition.

## Retry and recovery

The release workflow is safe to rerun after partial failure.

### npm version absent

The stable publish job publishes the exact tested tarball, then verifies the registry integrity.

### npm version present with matching integrity

The workflow treats publication as already complete and continues GitHub Release asset recovery.

### npm version present with different integrity

The workflow fails with an immutable-version conflict. Do not unpublish, overwrite, change the tag, or reuse the version. Investigate the discrepancy and prepare a new version only after determining the cause.

### GitHub Release asset absent

The workflow uploads the verified local asset.

### GitHub Release asset present with matching SHA-256

The workflow reuses it.

### GitHub Release asset present with different SHA-256

The workflow fails. It never uses `--clobber` and never silently replaces release bytes.

## Prohibited release paths

Do not:

- run `npm publish` from the source directory;
- publish a tarball that was rebuilt after platform testing;
- publish stable versions from a local machine;
- use a long-lived npm token in GitHub Actions;
- trigger publication from a push, pull request, workflow dispatch, or reusable workflow call;
- move or delete a release tag;
- overwrite a GitHub Release asset;
- unpublish an immutable version to repair a release;
- assign `latest` to the bootstrap prerelease;
- claim library API compatibility for internal TypeScript modules.
