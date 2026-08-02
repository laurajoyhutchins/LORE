#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  classifyPublishedVersion,
  publicationEnvironment,
  readPublishedIntegrity,
} from "./lib/npm-registry.mjs";
import { sha256Hex, sha512Integrity } from "./lib/tarball.mjs";

const PACKAGE_NAME = "@laurajoyhutchins/lore";

function fail(code, detail) {
  throw new Error(detail ? `${code}: ${detail}` : code);
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (
      !["--tarball", "--evidence"].includes(flag) ||
      typeof value !== "string" ||
      value.startsWith("--") ||
      values.has(flag)
    ) {
      fail("PUBLISH_PACKAGE_USAGE_INVALID");
    }
    values.set(flag, value);
  }
  if (values.size !== 2) fail("PUBLISH_PACKAGE_USAGE_INVALID");
  return {
    tarballPath: path.resolve(values.get("--tarball")),
    evidencePath: path.resolve(values.get("--evidence")),
  };
}

async function readEvidence(evidencePath) {
  let evidence;
  try {
    evidence = JSON.parse(await readFile(evidencePath, "utf8"));
  } catch (error) {
    fail(
      "PUBLISH_EVIDENCE_INVALID",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (
    evidence?.schema_version !== 1 ||
    evidence?.package?.name !== PACKAGE_NAME ||
    typeof evidence?.package?.version !== "string" ||
    typeof evidence?.artifact?.filename !== "string" ||
    typeof evidence?.artifact?.sha256 !== "string" ||
    typeof evidence?.artifact?.integrity !== "string"
  ) {
    fail("PUBLISH_EVIDENCE_INVALID");
  }
  return evidence;
}

function publish(tarballPath, environment) {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const result = spawnSync(npm, ["publish", tarballPath, "--access", "public"], {
    encoding: "utf8",
    stdio: "pipe",
    env: environment,
    shell: process.platform === "win32",
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.error) fail("NPM_PUBLISH_START_FAILED", result.error.message);
  if (result.status !== 0) {
    fail(
      "NPM_PUBLISH_FAILED",
      [result.stdout, result.stderr].filter(Boolean).join("\n").trim(),
    );
  }
}

async function main() {
  const { tarballPath, evidencePath } = parseArguments(process.argv.slice(2));
  const evidence = await readEvidence(evidencePath);
  const tarball = await readFile(tarballPath);
  const actual = {
    filename: path.basename(tarballPath),
    sha256: sha256Hex(tarball),
    integrity: sha512Integrity(tarball),
  };
  if (
    evidence.artifact.filename !== actual.filename ||
    evidence.artifact.sha256 !== actual.sha256 ||
    evidence.artifact.integrity !== actual.integrity
  ) {
    fail("PUBLISH_ARTIFACT_EVIDENCE_MISMATCH");
  }

  const environment = publicationEnvironment();
  const observed = readPublishedIntegrity(
    evidence.package.name,
    evidence.package.version,
    environment,
  );
  const state = classifyPublishedVersion(actual.integrity, observed);
  if (state === "conflict") {
    fail(
      "NPM_IMMUTABLE_VERSION_CONFLICT",
      `${evidence.package.name}@${evidence.package.version}`,
    );
  }
  if (state === "absent") publish(tarballPath, environment);

  const verified = readPublishedIntegrity(
    evidence.package.name,
    evidence.package.version,
    environment,
  );
  if (classifyPublishedVersion(actual.integrity, verified) !== "matching") {
    fail("NPM_PUBLICATION_VERIFICATION_FAILED");
  }
  process.stdout.write(
    `${JSON.stringify({
      package: `${evidence.package.name}@${evidence.package.version}`,
      state: state === "absent" ? "published" : "already-published",
      integrity: actual.integrity,
    })}\n`,
  );
}

try {
  await main();
} catch (error) {
  process.stderr.write(
    `PUBLISH_PACKAGE_FAILED: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
