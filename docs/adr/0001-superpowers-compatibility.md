# ADR-0001: Superpowers Compatibility Without Dependency

**Status:** Accepted  
**Date:** 2026-07-28

## Context

LORE is intended for arbitrary humans and LLM-based repository maintainers. Its first implementation plan was authored with the Superpowers planning workflow and included an execution header that required Superpowers-specific sub-skills. That wording incorrectly elevated one compatible workflow into a product dependency.

LORE may benefit from Superpowers conventions, including structured skills, test-driven task execution, review gates, and plan tracking. However, users must be able to install, run, maintain, and contribute to LORE without installing or understanding Superpowers.

## Decision

LORE will be compatible with Superpowers but will not depend on it.

The following boundaries are normative:

1. LORE's runtime, CLI, schemas, manifests, generated documentation, validation rules, and repository-maintenance protocol must not require Superpowers.
2. The public maintenance skill must use LORE-owned vocabulary and contracts. It must not require a Superpowers dispatcher, sub-skill, plan runner, directory convention, or execution lifecycle.
3. A human or arbitrary LLM-based maintainer must be able to execute every documented LORE workflow directly from repository files and standard command-line tools.
4. Superpowers-specific guidance may exist only as an optional adapter or companion document.
5. LORE must not test for the presence of Superpowers or change core behavior based on whether it is installed.
6. Canonical product documentation must live in LORE-owned paths such as `docs/specs/`, `docs/plans/`, `docs/adr/`, and `skills/`.
7. Compatibility adapters must translate external workflow concepts into the stable LORE protocol rather than changing that protocol.

## Compatibility model

```text
Superpowers, another agent framework, or a human workflow
                         |
                         v
             optional execution adapter
                         |
                         v
        LORE task context + included maintenance skill
                         |
                         v
             schema-conforming proposal
                         |
                         v
       deterministic LORE validation and application
```

The adapter layer is replaceable. The LORE protocol beneath it is stable and authoritative.

## Required acceptance tests

LORE's first usable release must prove all of the following:

- A clean checkout can build, test, validate, project, hydrate, and verify itself without Superpowers installed.
- The included maintenance skill contains no required Superpowers identifiers or commands.
- A proposal fixture created by following only LORE documentation validates successfully.
- Optional Superpowers guidance can be removed without changing any runtime or test result.
- Canonical generated documentation does not present Superpowers as a prerequisite.

## Consequences

Superpowers remains a useful way to implement LORE and may receive a dedicated optional integration guide. It is not part of LORE's trust root, public protocol, dependency graph, or definition of done.
