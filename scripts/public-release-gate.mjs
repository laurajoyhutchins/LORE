#!/usr/bin/env node

import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const EXPECTED_LOCKFILE_SHA256 =
  "e5e1747bac45b623c375226759fce20857b50ee615926dce1aefd282104ee57d";
const EXPECTED_LOCKFILE_GIT_BLOB = "7aec11b06bef06188262e0ca8ae44b8e35f158c9";
const refreshGenerated = process.argv.includes("--refresh-generated");
const skipInstall = process.argv.includes("--skip-install");

function fail(message) {
  process.stderr.write(`PUBLIC_RELEASE_GATE_FAILED: ${message}\n`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const capture = options.capture === true;
  process.stdout.write(`$ ${command} ${args.join(" ")}\n`);
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
    maxBuffer: 128 * 1024 * 1024,
    env: process.env,
  });
  if (result.error) fail(`${command} could not start: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = capture
      ? [result.stdout, result.stderr].filter(Boolean).join("\n").trim()
      : "";
    fail(`${command} exited ${String(result.status)}${detail ? `\n${detail}` : ""}`);
  }
  return capture ? result.stdout.trimEnd() : "";
}

function sha256(filePath) {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function verifyLockfile() {
  const lockfile = path.join(process.cwd(), "pnpm-lock.yaml");
  if (!existsSync(lockfile)) {
    fail(
      "pnpm-lock.yaml is missing. Copy the exact verified artifact from the private offline capsule before continuing.",
    );
  }

  const digest = sha256(lockfile);
  if (digest !== EXPECTED_LOCKFILE_SHA256) {
    fail(
      `pnpm-lock.yaml SHA-256 is ${digest}; expected ${EXPECTED_LOCKFILE_SHA256}`,
    );
  }

  const blob = run("git", ["hash-object", "pnpm-lock.yaml"], { capture: true });
  if (blob !== EXPECTED_LOCKFILE_GIT_BLOB) {
    fail(`pnpm-lock.yaml Git blob is ${blob}; expected ${EXPECTED_LOCKFILE_GIT_BLOB}`);
  }
}

function scanSensitiveFilenames() {
  const objects = run("git", ["rev-list", "--objects", "--all"], { capture: true });
  const suspicious = [];
  const sensitivePath =
    /(^|\/)(\.env(?:\.|$)|id_rsa(?:\.|$)|id_ed25519(?:\.|$)|credentials?(?:\.|\/|$)|secrets?(?:\.|\/|$)|[^/]+\.(?:pem|p12|pfx|key|keystore))$/i;

  for (const line of objects.split("\n")) {
    const separator = line.indexOf(" ");
    if (separator < 0) continue;
    const repositoryPath = line.slice(separator + 1);
    if (sensitivePath.test(repositoryPath)) suspicious.push(repositoryPath);
  }

  if (suspicious.length > 0) {
    fail(`reachable history contains sensitive-looking paths:\n${suspicious.join("\n")}`);
  }
}

function scanHistoryContent() {
  const history = run(
    "git",
    [
      "log",
      "--all",
      "--full-history",
      "--patch",
      "--binary",
      "--no-ext-diff",
      "--format=commit %H",
    ],
    { capture: true },
  );

  const patterns = [
    ["PEM private key", /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
    ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/g],
    ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{20,255}\b/g],
    ["OpenAI-style secret", /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g],
    ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g],
    ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/g],
    ["Stripe live secret", /\bsk_live_[A-Za-z0-9]{16,}\b/g],
    ["credential-bearing URL", /https?:\/\/[^\s/:@]+:[^\s/@]+@[^\s]+/g],
  ];

  const findings = [];
  for (const [name, pattern] of patterns) {
    const matches = history.match(pattern);
    if (matches && matches.length > 0) findings.push(`${name}: ${matches.length}`);
  }

  if (findings.length > 0) {
    fail(`high-confidence secret patterns found in reachable history:\n${findings.join("\n")}`);
  }
}

function scanCurrentTree() {
  const tracked = run("git", ["ls-files", "-z"], { capture: true })
    .split("\0")
    .filter(Boolean);
  const binary = [];

  for (const repositoryPath of tracked) {
    const content = readFileSync(repositoryPath);
    if (content.includes(0)) binary.push(repositoryPath);
  }

  if (binary.length > 0) {
    fail(
      `tracked binary files require an explicit redistribution review:\n${binary.join("\n")}`,
    );
  }
}

function reportPublicEmails() {
  const emails = run(
    "git",
    ["log", "--all", "--format=%ae%n%ce"],
    { capture: true },
  )
    .split("\n")
    .map((email) => email.trim())
    .filter(Boolean);
  const unique = [...new Set(emails)].sort();
  process.stdout.write("Reachable commit email identities:\n");
  for (const email of unique) process.stdout.write(`  ${email}\n`);
}

function verifyCleanTree() {
  const status = run("git", ["status", "--porcelain=v1"], { capture: true });
  if (status !== "") fail(`working tree is not clean:\n${status}`);
}

function pnpm(args) {
  run("corepack", ["pnpm", ...args]);
}

const repositoryRoot = run("git", ["rev-parse", "--show-toplevel"], {
  capture: true,
});
process.chdir(repositoryRoot);
verifyCleanTree();

const head = run("git", ["rev-parse", "--verify", "HEAD^{commit}"], {
  capture: true,
});
if (!/^[0-9a-f]{40}$/i.test(head)) fail("HEAD did not resolve to a full commit ID");

process.stdout.write(`LORE public release gate\n`);
process.stdout.write(`HEAD: ${head}\n`);
process.stdout.write(`Platform: ${os.platform()} ${os.release()} ${os.arch()}\n`);
process.stdout.write(`Node: ${process.version}\n`);
process.stdout.write(`Git: ${run("git", ["--version"], { capture: true })}\n`);
process.stdout.write(`Corepack: ${run("corepack", ["--version"], { capture: true })}\n`);

verifyLockfile();
scanSensitiveFilenames();
scanHistoryContent();
scanCurrentTree();
reportPublicEmails();

if (!skipInstall) pnpm(["install", "--frozen-lockfile"]);
process.stdout.write(
  `pnpm: ${run("corepack", ["pnpm", "--version"], { capture: true })}\n`,
);

if (refreshGenerated) {
  pnpm(["lore", "extract"]);
  pnpm(["lore", "project"]);
  const status = run("git", ["status", "--short"], { capture: true });
  process.stdout.write(
    status === ""
      ? "Generated state was already current.\n"
      : `Generated state refreshed. Review and commit these files, then run the gate again without --refresh-generated:\n${status}\n`,
  );
  process.exit(0);
}

pnpm(["typecheck"]);
pnpm(["lint"]);
pnpm(["test"]);
pnpm(["build"]);
pnpm(["lore", "extract", "--check"]);
pnpm(["lore", "validate"]);
pnpm(["lore", "project", "--check"]);
pnpm(["lore", "verify-self"]);
verifyCleanTree();

process.stdout.write(`VERIFIED_PUBLICATION_READY ${head}\n`);
