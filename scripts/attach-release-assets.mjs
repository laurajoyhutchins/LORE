#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import {
  classifyReleaseAsset,
  downloadReleaseAssetSha256,
  readReleaseAssetInventory,
  readReleaseAssets,
} from "./lib/github-release-assets.mjs";

function fail(code, detail) {
  throw new Error(detail ? `${code}: ${detail}` : code);
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (
      !["--directory", "--tag"].includes(flag) ||
      typeof value !== "string" ||
      value.startsWith("--") ||
      values.has(flag)
    ) {
      fail("ATTACH_RELEASE_USAGE_INVALID");
    }
    values.set(flag, value);
  }
  if (values.size !== 2) fail("ATTACH_RELEASE_USAGE_INVALID");
  return {
    directory: path.resolve(values.get("--directory")),
    tag: values.get("--tag"),
  };
}

function upload(repository, tag, filePath) {
  const result = spawnSync(
    "gh",
    ["release", "upload", tag, filePath, "--repo", repository],
    {
      encoding: "utf8",
      stdio: "pipe",
      env: process.env,
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  if (result.error) fail("GH_RELEASE_UPLOAD_START_FAILED", result.error.message);
  if (result.status !== 0) {
    fail(
      "GH_RELEASE_UPLOAD_FAILED",
      [result.stdout, result.stderr].filter(Boolean).join("\n").trim(),
    );
  }
}

async function main() {
  const { directory, tag } = parseArguments(process.argv.slice(2));
  const repository = process.env.GITHUB_REPOSITORY;
  if (typeof repository !== "string" || repository === "") {
    fail("GITHUB_REPOSITORY_MISSING");
  }
  const localAssets = await readReleaseAssetInventory(directory);
  const observedAssets = readReleaseAssets(repository, tag);

  for (const local of localAssets) {
    const observed = observedAssets.get(local.name);
    const observedSha256 = observed
      ? downloadReleaseAssetSha256(observed)
      : null;
    const state = classifyReleaseAsset(local.sha256, observedSha256);
    if (state === "conflict") {
      fail("GITHUB_RELEASE_ASSET_CONFLICT", local.name);
    }
    if (state === "absent") upload(repository, tag, local.path);
  }

  const verifiedAssets = readReleaseAssets(repository, tag);
  for (const local of localAssets) {
    const observed = verifiedAssets.get(local.name);
    if (!observed) fail("GITHUB_RELEASE_ASSET_VERIFICATION_FAILED", local.name);
    const state = classifyReleaseAsset(
      local.sha256,
      downloadReleaseAssetSha256(observed),
    );
    if (state !== "matching") {
      fail("GITHUB_RELEASE_ASSET_VERIFICATION_FAILED", local.name);
    }
  }

  process.stdout.write(
    `${JSON.stringify({
      repository,
      tag,
      assets: localAssets.map(({ name, sha256 }) => ({ name, sha256 })),
    })}\n`,
  );
}

try {
  await main();
} catch (error) {
  process.stderr.write(
    `ATTACH_RELEASE_ASSETS_FAILED: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
