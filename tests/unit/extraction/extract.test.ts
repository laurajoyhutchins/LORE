import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import type { LoreManifest } from "../../../src/domain/types.js";
import { extractRepository } from "../../../src/extraction/extract.js";

function manifest(extractors: LoreManifest["extractors"]): LoreManifest {
  return {
    schema_version: 1,
    repository: { id: "fixture", name: "Fixture", root: "." },
    paths: {
      extracted: ".lore/extracted",
      records: ".lore/records",
      proposals: ".lore/proposals",
      transactions: ".lore/transactions",
      generated_docs: "docs/generated",
      skills: "skills",
    },
    extractors,
    projections: [],
    maintenance: {
      skill: "skills/maintain-repository-documentation/SKILL.md",
      proposal_schema: "skills/maintain-repository-documentation/schemas/proposal.schema.json",
    },
    hydration: { max_records: 20, max_characters: 40000 },
  };
}

it("extracts nested Vitest test declarations when enabled", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "lore-extract-tests-"));
  await mkdir(path.join(root, "tests"));
  await writeFile(path.join(root, "package.json"), '{"name":"fixture","scripts":{}}\n');
  await writeFile(
    path.join(root, "tests", "fixture.test.ts"),
    'import { describe, it } from "vitest";\ndescribe("suite", () => { it("case", () => {}); });\n',
  );

  const result = await extractRepository(
    root,
    manifest([{ id: "vitest-tests", enabled: true }]),
  );

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect([...result.value.files.keys()]).toEqual([".lore/extracted/tests.yaml"]);
  const tests = result.value.files.get(".lore/extracted/tests.yaml");
  expect(tests).toContain("name: suite");
  expect(tests).toContain("name: case");
});

it("reports Python repository metadata without inventing pnpm", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "lore-extract-python-"));
  await mkdir(path.join(root, "src"));
  await writeFile(path.join(root, "pyproject.toml"), "[project]\nname = 'fixture'\n");
  await writeFile(path.join(root, "src", "fixture.py"), "VALUE = 1\n");
  await writeFile(path.join(root, "README.md"), "# Fixture\n");

  const result = await extractRepository(
    root,
    manifest([{ id: "repository-metadata", enabled: true }]),
  );

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect([...result.value.files.keys()]).toEqual([".lore/extracted/repository.yaml"]);
  const repository = result.value.files.get(".lore/extracted/repository.yaml");
  expect(repository).toContain("package_manager: python");
  expect(repository).toContain("- Python");
  expect(repository).not.toContain("package_manager: pnpm");
});

it("emits no extracted files when every extractor is disabled", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "lore-extract-disabled-"));
  await writeFile(path.join(root, "fixture.py"), "VALUE = 1\n");

  const result = await extractRepository(
    root,
    manifest([{ id: "repository-metadata", enabled: false }]),
  );

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect(result.value.files.size).toBe(0);
});

it("fails closed for an unknown enabled extractor", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "lore-extract-unknown-"));

  const result = await extractRepository(
    root,
    manifest([{ id: "python-magic", enabled: true }]),
  );

  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.errors).toEqual([
    expect.objectContaining({
      code: "UNKNOWN_EXTRACTOR",
      message: "Unknown enabled extractor: python-magic",
    }),
  ]);
});
