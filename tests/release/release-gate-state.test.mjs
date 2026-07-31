import { access, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  GATE_TEMPORARY_PATHS,
  removeGateTemporaryPaths,
} from "../../scripts/lib/release-gate-state.mjs";
import { readVerifiedLockfileArtifact } from "../../scripts/verified-lockfile.mjs";

let originalDirectory;
let temporaryDirectory;

beforeEach(async () => {
  originalDirectory = process.cwd();
  temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "lore-gate-state-"));
  process.chdir(temporaryDirectory);
});

afterEach(async () => {
  process.chdir(originalDirectory);
  await rm(temporaryDirectory, { recursive: true, force: true });
});

describe("release gate temporary state", () => {
  it("declares every gate-created path", () => {
    expect(GATE_TEMPORARY_PATHS).toEqual([
      "pnpm-lock.yaml",
      ".release-artifacts",
    ]);
  });

  it("always removes package artifacts and preserves a pre-existing lockfile", async () => {
    await mkdir(".release-artifacts", { recursive: true });
    await writeFile(".release-artifacts/package.tgz", "artifact");
    await writeFile("pnpm-lock.yaml", "pre-existing");

    removeGateTemporaryPaths({ lockfileCreated: false });

    await expect(access(".release-artifacts")).rejects.toThrow();
    await expect(access("pnpm-lock.yaml")).resolves.toBeUndefined();
  });

  it("removes the verified lockfile when the gate created it", async () => {
    const { bytes } = readVerifiedLockfileArtifact();
    await mkdir(".release-artifacts", { recursive: true });
    await writeFile("pnpm-lock.yaml", bytes);

    removeGateTemporaryPaths({ lockfileCreated: true });

    await expect(access(".release-artifacts")).rejects.toThrow();
    await expect(access("pnpm-lock.yaml")).rejects.toThrow();
  });
});
