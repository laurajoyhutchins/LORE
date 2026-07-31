import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  classifyReleaseAsset,
  readReleaseAssetInventory,
} from "../../scripts/lib/github-release-assets.mjs";

const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const temporaryDirectories = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe("GitHub Release asset classification", () => {
  it("classifies absent, matching, and conflicting assets", () => {
    expect(classifyReleaseAsset(SHA_A, null)).toBe("absent");
    expect(classifyReleaseAsset(SHA_A, SHA_A)).toBe("matching");
    expect(classifyReleaseAsset(SHA_A, SHA_B)).toBe("conflict");
  });

  it.each([
    ["expected", "A".repeat(64), null],
    ["expected", "abc", null],
    ["observed", SHA_A, "not-a-sha"],
  ])("rejects malformed %s SHA-256", (_name, expected, observed) => {
    expect(() => classifyReleaseAsset(expected, observed)).toThrow(
      "RELEASE_ASSET_SHA256_INVALID",
    );
  });
});

describe("local release asset inventory", () => {
  it("requires one tarball, SHA256SUMS, and release-evidence.json", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lore-assets-"));
    temporaryDirectories.push(directory);
    await writeFile(path.join(directory, "package.tgz"), "tarball");
    await writeFile(path.join(directory, "SHA256SUMS"), "checksums");
    await writeFile(path.join(directory, "release-evidence.json"), "{}\n");

    const inventory = await readReleaseAssetInventory(directory);

    expect(inventory.map(({ name }) => name)).toEqual([
      "SHA256SUMS",
      "package.tgz",
      "release-evidence.json",
    ]);
    for (const asset of inventory) {
      expect(asset.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(asset.bytes).toBeGreaterThan(0);
    }
  });

  it.each([
    ["missing checksum", ["package.tgz", "release-evidence.json"]],
    [
      "two tarballs",
      ["a.tgz", "b.tgz", "SHA256SUMS", "release-evidence.json"],
    ],
    [
      "unexpected file",
      ["package.tgz", "SHA256SUMS", "release-evidence.json", "extra.txt"],
    ],
  ])("rejects %s", async (_name, names) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lore-assets-"));
    temporaryDirectories.push(directory);
    for (const name of names) {
      await writeFile(path.join(directory, name), "x");
    }

    await expect(readReleaseAssetInventory(directory)).rejects.toThrow(
      "RELEASE_ASSET_INVENTORY_INVALID",
    );
  });

  it("rejects directories disguised as required assets", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "lore-assets-"));
    temporaryDirectories.push(directory);
    await writeFile(path.join(directory, "package.tgz"), "tarball");
    await mkdir(path.join(directory, "SHA256SUMS"));
    await writeFile(path.join(directory, "release-evidence.json"), "{}\n");

    await expect(readReleaseAssetInventory(directory)).rejects.toThrow(
      "RELEASE_ASSET_INVENTORY_INVALID",
    );
  });
});
