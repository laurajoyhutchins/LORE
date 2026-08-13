import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LoreTask } from "../src/domain/types.js";
import {
  hydrateTask,
  hydrationMarkdown,
  normalizeHydrationPacketForSnapshot,
} from "../src/hydration/hydrate.js";
import { createSchemaRegistry } from "../src/schemas/schema-registry.js";
import { parseYamlDocument, stableYaml } from "../src/serialization/yaml.js";
import { validateRepository } from "../src/validation/validate-repository.js";

const root = process.cwd();
const repository = await validateRepository(root);
if (!repository.ok) throw new Error(repository.errors.map(({ message }) => message).join("\n"));
const registry = createSchemaRegistry(root);
const taskDirectory = path.join(root, "fixtures", "tasks");
const snapshotDirectory = path.join(root, ".lore", "snapshots");
await mkdir(snapshotDirectory, { recursive: true });

for (const name of (await readdir(taskDirectory)).filter((file) => /\.ya?ml$/.test(file)).sort()) {
  const source = await readFile(path.join(taskDirectory, name), "utf8");
  const parsed = parseYamlDocument<unknown>(source, `fixtures/tasks/${name}`);
  if (!parsed.ok) throw new Error(parsed.errors.map(({ message }) => message).join("\n"));
  const task = registry.validateWithSchema<LoreTask>("task", parsed.value);
  if (!task.ok) throw new Error(task.errors.map(({ message }) => message).join("\n"));
  const packet = normalizeHydrationPacketForSnapshot(hydrateTask(task.value, repository.value));
  const stem = name.replace(/\.ya?ml$/, "");
  await writeFile(path.join(snapshotDirectory, `${stem}.context.yaml`), stableYaml(packet));
  await writeFile(path.join(snapshotDirectory, `${stem}.context.md`), hydrationMarkdown(packet));
}
