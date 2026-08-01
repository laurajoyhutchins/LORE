# Public release readiness

This document records completed evidence and unresolved owner-controlled gates for publishing the LORE CLI package `@laurajoyhutchins/lore` from the now-public repository.

Repository visibility and package publication are separate decisions. The repository is public, but neither the bootstrap package nor the stable package is authorized merely by that visibility change. The release workflow also fails closed if repository visibility regresses before a release.

## Completed preparation

- The LORE repository is public.
- Apache License 2.0 is adopted with canonical license text, SPDX package metadata, and aligned contribution terms.
- The generated README, repository metadata, security policy, contribution guide, code of conduct, issue and pull-request templates, and Dependabot configuration are present.
- Ordinary CI has read-only repository permissions and invokes the unified exact-head publication gate.
- Repository path-indirection, Git revision handling, initialization, strict-schema, nested-test extraction, exact historical-byte reading, JavaScript linting, and generated-state convergence defects have regression coverage.
- The approved pnpm 10.14.0 lockfile is stored as eight independently checksummed gzip members under `artifacts/verified-lockfile/`. Their manifest records every member and the reconstructed lockfile's byte count, SHA-256, and Git blob ID.
- `scripts/restore-verified-lockfile.mjs` reconstructs `pnpm-lock.yaml` only after every committed member passes byte-count, SHA-256, and Git-object verification. It refuses a different existing destination.
- `scripts/public-release-gate.mjs` restores the approved lockfile, scans reachable history and the current tree, reports public commit identities, installs the frozen graph, runs code and LORE verification, packs the CLI, installs the exact tarball, exercises a fresh repository, cleans gate-created state, and requires a clean tree.
- The npm package is scoped as `@laurajoyhutchins/lore`, uses the bootstrap version `0.0.0-bootstrap.0`, declares a CLI-only surface, and uses a strict runtime file allowlist.
- Package tooling verifies the actual tarball entries, executable mode, Node shebang, runtime templates, checksums, package identity, tag, and source commit.
- Installed-artifact smoke tooling verifies local and isolated-global installations and exercises `init`, `extract`, `validate`, `project`, drift checks, commit creation, and final Git cleanliness without reading from the source checkout.
- The release workflow builds one canonical tarball, fans those bytes out to Linux, macOS, and Windows, finalizes cross-platform evidence, attaches bootstrap assets without npm authority, and reserves OIDC publication for the protected stable job.
- Registry and GitHub Release recovery logic distinguishes absent, matching, and conflicting immutable bytes and never overwrites a mismatch.
- The operator runbook is recorded in `docs/releasing.md`.

## Approved lockfile identity

```text
raw bytes: 62769
SHA-256: bbda9e0c90ce2996f8fc510b1414321957e879d72443a68d850baa61d17aa1e6
Git blob: df207b5d79375bc28d5481c7d1f106952e77adbe
```

A visually similar lockfile does not satisfy the release contract. The committed member manifest and reconstructed file must match all three values.

## Exact-head publication gate

From a clean checkout with every reachable ref fetched:

```bash
git fetch --all --tags --prune
corepack pnpm release:verify
```

The only passing result is:

```text
VERIFIED_PUBLICATION_READY <unchanged-exact-head-sha>
```

Any commit after that result requires another complete run.

## Post-public repository hardening audit

The visibility transition has occurred. These items remain explicit audit work until independently confirmed in this record. An unchecked item means it has not been evidenced here, not that repository visibility is still pending.

- [ ] Review every commit email printed by the gate and accept it for public disclosure.
- [ ] Review all branches and tags; delete stale private-development refs or explicitly accept their reachable history.
- [ ] Confirm private vulnerability reporting.
- [ ] Confirm Dependabot alerts and security updates.
- [ ] Confirm secret scanning and push protection where available.
- [ ] Confirm the repository Actions default permission is read-only.
- [ ] Confirm `main` protection requires the CI verification job.
- [ ] Confirm repository description, topics, social preview, issue surface, and discussion settings.
- [ ] Confirm public visibility alone cannot publish a package, create a tag, or create a GitHub Release.
- [ ] Record the exact commit SHA at which public visibility was confirmed.

Close the relevant security and branch-governance items before package publication. Public visibility by itself does not authorize or imply an npm release.

## Owner-controlled gates before bootstrap publication

- [ ] Confirm the public repository still points to the exact approved commit or a later commit with a fresh complete gate result.
- [ ] Protect release tags matching `v*` against movement and deletion.
- [ ] Create protected GitHub environment `npm`.
- [ ] Require Laura's approval for the `npm` environment.
- [ ] Restrict the `npm` environment to release tags matching `v*`.
- [ ] Confirm no `NODE_AUTH_TOKEN` or `NPM_TOKEN` exists for the release workflow.
- [ ] Create immutable tag `v0.0.0-bootstrap.0` at the exact verified commit.
- [ ] Publish a GitHub prerelease for the existing bootstrap tag.
- [ ] Require the release workflow to attach one tested `.tgz`, `SHA256SUMS`, and finalized `release-evidence.json`.
- [ ] Download and independently verify the attached artifact checksum and evidence.
- [ ] Manually publish the exact attached tarball with interactive 2FA and dist-tag `bootstrap`.
- [ ] Confirm the bootstrap version is not assigned to `latest`.

## Owner-controlled gates before stable publication

- [ ] Configure npm trusted publishing for owner `laurajoyhutchins`, repository `LORE`, workflow `release.yml`, environment `npm`, and action `npm publish`.
- [ ] Restrict token publication where npm permits and revoke obsolete automation tokens.
- [ ] Merge a bounded release PR changing the version to `0.1.0` and updating release notes.
- [ ] Run the complete exact-head gate at the stable release commit.
- [ ] Create immutable tag `v0.1.0` at that exact commit.
- [ ] Publish a non-prerelease GitHub Release for the existing stable tag.
- [ ] Approve the protected `npm` environment only after the build and three-platform smoke jobs pass.
- [ ] Verify npm integrity, provenance, package metadata, and installed `lore version --json` output.
- [ ] Verify the GitHub Release assets match the finalized release evidence.
- [ ] Deprecate `0.0.0-bootstrap.0` only after `0.1.0` is confirmed healthy.

## Decision rule

Merge, bootstrap publication, stable publication, and downstream adoption are separate decisions.

A decision advances only when its preceding exact-head evidence and owner-controlled checklist are complete. No automated path may infer approval, move a release tag, unpublish a version, overwrite an asset, or bypass the protected npm environment.
