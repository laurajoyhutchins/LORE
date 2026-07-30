import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import type { LoreManifest } from "../../../src/domain/types.js";
import { extractRepository } from "../../../src/extraction/extract.js";

it("extracts nested Vitest test declarations", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "lore-extract-tests-"));
  await mkdir(path.join(root, "tests"));
  await writeFile(path.join(root, "package.json"), '{"name":"fixture","scripts":{}}\n');
  await writeFile(
    path.join(root, "tests", "fixture.test.ts"),
    'import { describe, it } from "vitest";\ndescribe("suite", () => { it("case", () => {}); });\n',
  );
  const manifest = {
    repository: { id: "fixture", name: "Fixture", root: "." },
    paths: { extracted: ".lore/extracted" },
  } as LoreManifest;

  const result = await extractRepository(root, manifest);

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const tests = result.value.files.get(".lore/extracted/tests.yaml");
  expect(tests).toContain("name: suite");
  expect(tests).toContain("name: case");
});
