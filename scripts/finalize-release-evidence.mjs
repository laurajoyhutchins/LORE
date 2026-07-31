#!/usr/bin/env node

import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const PLATFORM_ORDER = Object.freeze(["linux", "darwin", "win32"]);
const MODE_ORDER = Object.freeze(["local", "global"]);

function fail(code, detail) {
  throw new Error(detail ? `${code}: ${detail}` : code);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateBaseEvidence(base) {
  if (
    !isObject(base) ||
    base.schema_version !== 1 ||
    !isObject(base.package) ||
    typeof base.package.name !== "string" ||
    typeof base.package.version !== "string" ||
    !isObject(base.source) ||
    !isObject(base.artifact) ||
    !Array.isArray(base.files) ||
    !Array.isArray(base.platforms) ||
    base.platforms.length !== 0
  ) {
    fail("BASE_RELEASE_EVIDENCE_INVALID");
  }
}

function validateReport(report) {
  if (
    !isObject(report) ||
    report.schema_version !== 1 ||
    !PLATFORM_ORDER.includes(report.platform) ||
    typeof report.node !== "string" ||
    report.node === "" ||
    !Array.isArray(report.modes) ||
    report.modes.length !== MODE_ORDER.length
  ) {
    fail("PLATFORM_REPORT_SET_INVALID");
  }
  const modes = new Map();
  for (const result of report.modes) {
    if (
      !isObject(result) ||
      !MODE_ORDER.includes(result.mode) ||
      modes.has(result.mode) ||
      typeof result.passed !== "boolean"
    ) {
      fail("PLATFORM_REPORT_SET_INVALID");
    }
    modes.set(result.mode, result.passed);
  }
  if (MODE_ORDER.some((mode) => modes.get(mode) !== true)) {
    fail("PLATFORM_SMOKE_FAILED", report.platform);
  }
}

export function finalizeEvidence(base, reports) {
  validateBaseEvidence(base);
  if (!Array.isArray(reports) || reports.length !== PLATFORM_ORDER.length) {
    fail("PLATFORM_REPORT_SET_INVALID");
  }
  const byPlatform = new Map();
  for (const report of reports) {
    validateReport(report);
    if (byPlatform.has(report.platform)) fail("PLATFORM_REPORT_SET_INVALID");
    byPlatform.set(report.platform, report);
  }
  if (PLATFORM_ORDER.some((platform) => !byPlatform.has(platform))) {
    fail("PLATFORM_REPORT_SET_INVALID");
  }
  return {
    ...structuredClone(base),
    platforms: PLATFORM_ORDER.map((platform) =>
      structuredClone(byPlatform.get(platform)),
    ),
  };
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (
      !["--base", "--reports", "--output"].includes(flag) ||
      typeof value !== "string" ||
      value.startsWith("--") ||
      values.has(flag)
    ) {
      fail("FINALIZE_EVIDENCE_USAGE_INVALID");
    }
    values.set(flag, value);
  }
  if (values.size !== 3) fail("FINALIZE_EVIDENCE_USAGE_INVALID");
  return {
    base: path.resolve(values.get("--base")),
    reports: path.resolve(values.get("--reports")),
    output: path.resolve(values.get("--output")),
  };
}

async function readJson(filePath, code) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    fail(code, error instanceof Error ? error.message : String(error));
  }
}

async function main() {
  const arguments_ = parseArguments(process.argv.slice(2));
  const entries = await readdir(arguments_.reports, { withFileTypes: true });
  if (
    entries.length !== PLATFORM_ORDER.length ||
    entries.some(
      (entry) =>
        !entry.isFile() ||
        entry.isSymbolicLink() ||
        !entry.name.endsWith(".json"),
    )
  ) {
    fail("PLATFORM_REPORT_DIRECTORY_INVALID");
  }
  const base = await readJson(arguments_.base, "BASE_RELEASE_EVIDENCE_INVALID");
  const reports = await Promise.all(
    entries
      .map(({ name }) => name)
      .sort()
      .map((name) =>
        readJson(
          path.join(arguments_.reports, name),
          "PLATFORM_REPORT_SET_INVALID",
        ),
      ),
  );
  const finalized = finalizeEvidence(base, reports);
  await writeFile(arguments_.output, `${JSON.stringify(finalized, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(finalized, null, 2)}\n`);
}

const isEntryPoint = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;
if (isEntryPoint) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(
      `FINALIZE_RELEASE_EVIDENCE_FAILED: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
