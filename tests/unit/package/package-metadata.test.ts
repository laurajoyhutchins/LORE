import { readFile } from "node:fs/promises";
import { expect, it } from "vitest";

interface PackageManifest {
  name?: unknown;
  version?: unknown;
  private?: unknown;
  bin?: unknown;
  files?: unknown;
  publishConfig?: unknown;
  engines?: unknown;
  main?: unknown;
  module?: unknown;
  types?: unknown;
  exports?: unknown;
}

it("defines the CLI-only bootstrap package", async () => {
  const pkg = JSON.parse(
    await readFile("package.json", "utf8"),
  ) as PackageManifest;
  expect(pkg.name).toBe("@laurajoyhutchins/lore");
  expect(pkg.version).toBe("0.0.0-bootstrap.0");
  expect(pkg.private).toBeUndefined();
  expect(pkg.bin).toEqual({ lore: "./dist/cli/main.js" });
  expect(pkg.files).toEqual([
    "dist/",
    "BOOTSTRAP.md",
    "schemas/",
    "skills/maintain-repository-documentation/",
    "README.md",
    "LICENSE",
  ]);
  expect(pkg.publishConfig).toEqual({ access: "public" });
  expect(pkg.engines).toEqual({ node: ">=22" });
  expect(pkg.main).toBeUndefined();
  expect(pkg.module).toBeUndefined();
  expect(pkg.types).toBeUndefined();
  expect(pkg.exports).toBeUndefined();
});
