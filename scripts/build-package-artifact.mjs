#!/usr/bin/env node

import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { inspectPackageArtifact } from "./lib/package-contract.mjs";

function fail(code, detail) {
  throw new Error(detail ? `${code}: ${detail}` : code);
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (
      !["--tag", "--commit", "--output"].includes(flag) ||
      typeof value !== "string" ||
      value.startsWith("--") ||
      values.has(flag)
    ) {
      fail("RELEASE_PACKAGE_USAGE_INVALID");
    }
    values.set(flag, value);
  }
  if (values.size !== 3) fail("RELEASE_PACKAGE_USAGE_INVALID");
  return {
    tag: values.get("--tag"),
    commit: values.get("--commit"),
    output: values.get("--output"),
  };
}

function resolveOutput(root, candidate) {
  if (
    path.isAbsolute(candidate) ||
    candidate === "" ||
    candidate.split(/[\\/]/u).some((segment) => segment === "..")
  ) {
    fail("RELEASE_PACKAGE_OUTPUT_INVALID", candidate);
  }
  const resolved = path.resolve(root, candidate);
  const relative = path.relative(root, resolved);
  if (relative === "" || relative.startsWith(`..${path.sep}`) || relative === "..") {
    fail("RELEASE_PACKAGE_OUTPUT_INVALID", candidate);
  }
  return resolved;
}

function runNpmPack(outputDirectory) {
  const executable = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(
    executable,
    ["pack", "--json", "--pack-destination", outputDirectory],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: "pipe",
      maxBuffer: 128 * 1024 * 1024,
      env: process.env,
    },
  );
  if (result.error) {
    fail("RELEASE_PACKAGE_NPM_START_FAILED", result.error.message);
  }
  if (result.status !== 0) {
    fail(
      "RELEASE_PACKAGE_NPM_FAILED",
      [result.stdout, result.stderr].filter(Boolean).join("\n").trim(),
    );
  }
  let parsed;
  try {
    parsed = JSON.parse(result.stdout);
  } catch (error) {
    fail(
      "RELEASE_PACKAGE_NPM_OUTPUT_INVALID",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 1 ||
    typeof parsed[0]?.filename !== "string"
  ) {
    fail("RELEASE_PACKAGE_NPM_OUTPUT_INVALID");
  }
  return path.basename(parsed[0].filename);
}

async function main() {
  const { tag, commit, output } = parseArguments(process.argv.slice(2));
  const root = process.cwd();
  const outputDirectory = resolveOutput(root, output);
  await rm(outputDirectory, { recursive: true, force: true });
  await mkdir(outputDirectory, { recursive: true });

  const reportedFilename = runNpmPack(outputDirectory);
  const tarballs = (await readdir(outputDirectory))
    .filter((name) => name.endsWith(".tgz"))
    .sort();
  if (tarballs.length !== 1 || tarballs[0] !== reportedFilename) {
    fail(
      "RELEASE_PACKAGE_TARBALL_COUNT_INVALID",
      `${reportedFilename}; found ${tarballs.join(", ")}`,
    );
  }

  const tarballPath = path.join(outputDirectory, reportedFilename);
  const evidence = await inspectPackageArtifact({
    tarballPath,
    repository: "laurajoyhutchins/LORE",
    tag,
    commit,
  });
  await writeFile(
    path.join(outputDirectory, "release-evidence.json"),
    `${JSON.stringify(evidence, null, 2)}\n`,
  );
  await writeFile(
    path.join(outputDirectory, "SHA256SUMS"),
    `${evidence.artifact.sha256}  ${evidence.artifact.filename}\n`,
  );
  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}

try {
  await main();
} catch (error) {
  process.stderr.write(
    `RELEASE_PACKAGE_FAILED: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
