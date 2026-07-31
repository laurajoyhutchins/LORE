import { spawnSync } from "node:child_process";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { sha256Hex } from "./tarball.mjs";

function fail(code, detail) {
  throw new Error(detail ? `${code}: ${detail}` : code);
}

function validateSha256(value) {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) {
    fail("RELEASE_ASSET_SHA256_INVALID", String(value));
  }
  return value;
}

export function classifyReleaseAsset(expectedSha256, observedSha256) {
  validateSha256(expectedSha256);
  if (observedSha256 === null) return "absent";
  validateSha256(observedSha256);
  return observedSha256 === expectedSha256 ? "matching" : "conflict";
}

export async function readReleaseAssetInventory(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const names = entries.map(({ name }) => name).sort();
  const tarballs = names.filter((name) => name.endsWith(".tgz"));
  const expected = [
    "SHA256SUMS",
    tarballs.length === 1 ? tarballs[0] : "",
    "release-evidence.json",
  ]
    .filter(Boolean)
    .sort();
  if (
    tarballs.length !== 1 ||
    names.length !== 3 ||
    names.some((name, index) => name !== expected[index]) ||
    entries.some((entry) => !entry.isFile() || entry.isSymbolicLink())
  ) {
    fail("RELEASE_ASSET_INVENTORY_INVALID", names.join(", "));
  }

  const inventory = [];
  for (const name of names) {
    const filePath = path.resolve(directory, name);
    const stat = await lstat(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      fail("RELEASE_ASSET_INVENTORY_INVALID", name);
    }
    const bytes = await readFile(filePath);
    if (bytes.length === 0) fail("RELEASE_ASSET_EMPTY", name);
    inventory.push({
      name,
      path: filePath,
      bytes: bytes.length,
      sha256: sha256Hex(bytes),
    });
  }
  return inventory;
}

function runGh(args, { binary = false } = {}) {
  const result = spawnSync("gh", args, {
    encoding: binary ? null : "utf8",
    stdio: "pipe",
    env: process.env,
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.error) fail("GH_COMMAND_START_FAILED", result.error.message);
  if (result.status !== 0) {
    const stdout = binary ? "" : result.stdout;
    const stderr = binary ? result.stderr?.toString("utf8") : result.stderr;
    fail(
      "GH_COMMAND_FAILED",
      [
        `gh ${args.join(" ")} exited ${String(result.status)}`,
        stdout,
        stderr,
      ]
        .filter(Boolean)
        .join("\n")
        .trim(),
    );
  }
  return result.stdout;
}

export function readReleaseAssets(repository, tag) {
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u.test(repository)) {
    fail("GITHUB_REPOSITORY_INVALID", repository);
  }
  if (typeof tag !== "string" || !/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u.test(tag)) {
    fail("GITHUB_RELEASE_TAG_INVALID", String(tag));
  }
  let release;
  try {
    release = JSON.parse(
      runGh(["api", `repos/${repository}/releases/tags/${tag}`]),
    );
  } catch (error) {
    if (error instanceof SyntaxError) {
      fail("GITHUB_RELEASE_RESPONSE_INVALID", error.message);
    }
    throw error;
  }
  if (!Array.isArray(release?.assets)) {
    fail("GITHUB_RELEASE_RESPONSE_INVALID");
  }
  const assets = new Map();
  for (const asset of release.assets) {
    if (
      typeof asset?.name !== "string" ||
      typeof asset?.url !== "string" ||
      assets.has(asset.name)
    ) {
      fail("GITHUB_RELEASE_RESPONSE_INVALID");
    }
    assets.set(asset.name, { name: asset.name, url: asset.url });
  }
  return assets;
}

export function downloadReleaseAssetSha256(asset) {
  if (typeof asset?.url !== "string") fail("GITHUB_RELEASE_ASSET_INVALID");
  const bytes = runGh(
    ["api", asset.url, "-H", "Accept: application/octet-stream"],
    { binary: true },
  );
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    fail("GITHUB_RELEASE_ASSET_INVALID", asset.name);
  }
  return sha256Hex(bytes);
}
