import { access, readdir, rm, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { expect, it } from "vitest";

it("emits runtime JavaScript without tests, maps, or declarations", async () => {
  await rm("dist", { recursive: true, force: true });
  const run = spawnSync("corepack", ["pnpm", "build"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  expect(run.status, run.stderr).toBe(0);
  await expect(access("dist/cli/main.js")).resolves.toBeUndefined();
  if (process.platform !== "win32") {
    expect((await stat("dist/cli/main.js")).mode & 0o111).not.toBe(0);
  }
  const names = (await readdir("dist", { recursive: true })).map(String);
  expect(names.some((name) => name.includes("tests"))).toBe(false);
  expect(names.some((name) => name.endsWith(".d.ts"))).toBe(false);
  expect(names.some((name) => name.endsWith(".map"))).toBe(false);
});
