import { cp, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { loadManifest } from "../../../src/config/load-manifest.js";
import type { LoreManifest, LoreTask } from "../../../src/domain/types.js";
import { createSchemaRegistry } from "../../../src/schemas/schema-registry.js";
import { parseYamlDocument } from "../../../src/serialization/yaml.js";

it("compiles strict schemas and validates the repository manifest and task fixture", async () => {
  const registry = createSchemaRegistry(process.cwd());
  const manifestText = await readFile("lore.yaml", "utf8");
  const manifest = parseYamlDocument<unknown>(manifestText, "lore.yaml");
  expect(manifest.ok).toBe(true);
  if (!manifest.ok) return;
  expect(registry.validateWithSchema<LoreManifest>("manifest", manifest.value).ok).toBe(true);

  const taskText = await readFile("fixtures/tasks/transaction-recovery.yaml", "utf8");
  const task = parseYamlDocument<unknown>(taskText, "fixtures/tasks/transaction-recovery.yaml");
  expect(task.ok).toBe(true);
  if (!task.ok) return;
  expect(registry.validateWithSchema<LoreTask>("task", task.value).ok).toBe(true);
});

it("rejects a manifest with a null extractor list", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "lore-manifest-null-"));
  await cp("schemas", path.join(root, "schemas"), { recursive: true });
  await writeFile(
    path.join(root, "lore.yaml"),
    `schema_version: 1
repository:
  id: fixture
  name: Fixture
  root: .
paths:
  extracted: .lore/extracted
  records: .lore/records
  proposals: .lore/proposals
  transactions: .lore/transactions
  generated_docs: docs/generated
  skills: skills
extractors: null
projections: []
maintenance:
  skill: skills/maintain-repository-documentation/SKILL.md
  proposal_schema: schemas/proposal.schema.json
hydration:
  max_records: 20
  max_characters: 40000
`,
  );

  const result = await loadManifest(root);

  expect(result.ok).toBe(false);
  if (result.ok) return;
  expect(result.errors).toEqual([
    expect.objectContaining({
      code: "SCHEMA_VALIDATION_FAILED",
      location: "/extractors",
    }),
  ]);
});
