import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";
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
