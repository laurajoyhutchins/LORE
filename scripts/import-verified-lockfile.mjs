#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const EXPECTED_SHA256 =
  "e5e1747bac45b623c375226759fce20857b50ee615926dce1aefd282104ee57d";
const EXPECTED_GIT_BLOB = "7aec11b06bef06188262e0ca8ae44b8e35f158c9";

function fail(message) {
  process.stderr.write(`LOCKFILE_IMPORT_FAILED: ${message}\n`);
  process.exit(1);
}

function digest(algorithm, bytes) {
  return createHash(algorithm).update(bytes).digest("hex");
}

function gitBlobId(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, "utf8");
  return digest("sha1", Buffer.concat([header, bytes]));
}

const sourceArgument = process.argv[2] ?? process.env.LORE_VERIFIED_LOCKFILE;
if (!sourceArgument) {
  fail(
    "provide the private capsule lockfile path: corepack pnpm release:import-lock -- <path-to-pnpm-lock.yaml>",
  );
}

const source = path.resolve(sourceArgument);
if (!existsSync(source)) fail(`source file does not exist: ${source}`);

const bytes = readFileSync(source);
const sha256 = digest("sha256", bytes);
const blob = gitBlobId(bytes);
if (sha256 !== EXPECTED_SHA256) {
  fail(`source SHA-256 is ${sha256}; expected ${EXPECTED_SHA256}`);
}
if (blob !== EXPECTED_GIT_BLOB) {
  fail(`source Git blob is ${blob}; expected ${EXPECTED_GIT_BLOB}`);
}

const destination = path.resolve("pnpm-lock.yaml");
if (existsSync(destination)) {
  const current = readFileSync(destination);
  const currentSha256 = digest("sha256", current);
  const currentBlob = gitBlobId(current);
  if (currentSha256 === EXPECTED_SHA256 && currentBlob === EXPECTED_GIT_BLOB) {
    process.stdout.write("pnpm-lock.yaml already matches the verified artifact.\n");
    process.exit(0);
  }
  fail(
    `destination already exists with SHA-256 ${currentSha256} and Git blob ${currentBlob}; remove or review it before importing`,
  );
}

writeFileSync(destination, bytes, { flag: "wx" });
const written = readFileSync(destination);
if (digest("sha256", written) !== EXPECTED_SHA256 || gitBlobId(written) !== EXPECTED_GIT_BLOB) {
  fail("post-write identity verification failed");
}

process.stdout.write(`Imported verified lockfile from ${source}\n`);
process.stdout.write(`SHA-256: ${EXPECTED_SHA256}\n`);
process.stdout.write(`Git blob: ${EXPECTED_GIT_BLOB}\n`);
process.stdout.write("Review and commit pnpm-lock.yaml, then run release:refresh.\n");
