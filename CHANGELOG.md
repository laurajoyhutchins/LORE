# Changelog

All notable changes to LORE are documented in this file.

The project follows Semantic Versioning while it remains pre-1.0. The documented CLI is the supported compatibility surface. Internal TypeScript modules and source paths are not public APIs.

## Unreleased

### Changed

- Reserved for changes after the first stable CLI release.

## 0.1.0

Planned first stable workflow-produced release.

### Added

- Public scoped package `@laurajoyhutchins/lore`.
- CLI-only compatibility contract with `lore version` and `lore version --json`.
- Runtime-only package build and strict package file allowlist.
- Exact tarball inventory, SHA-256, SHA-512 integrity, and release evidence.
- Linux, macOS, and Windows installation testing for local and isolated-global installs.
- Functional fresh-repository smoke tests from the installed tarball.
- Protected npm trusted publishing through GitHub Actions OIDC.
- Retry-safe registry and GitHub Release asset recovery.

## 0.0.0-bootstrap.0

One-time bootstrap prerelease used to create the npm package before trusted publishing can be configured.

### Added

- The same package inventory and cross-platform installed-artifact verification required for `0.1.0`.
- A non-default `bootstrap` npm dist-tag.
- An auditable registry trust-transition artifact.

### Restrictions

- Never assigned to `latest`.
- Published manually from the exact workflow-tested tarball with interactive 2FA.
- Deprecated after `0.1.0` is verified.
