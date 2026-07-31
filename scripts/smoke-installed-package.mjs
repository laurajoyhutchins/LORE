#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { access, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { readTarGzip } from "./lib/tarball.mjs";

const PACKAGE_NAME = "@laurajoyhutchins/lore";
const PACKAGE_BIN = "./dist/cli/main.js";
const MODES = new Set(["local", "global", "all"]);
const REQUIRED_INITIALIZED_PATHS = Object.freeze([
  "lore.yaml",
  "BOOTSTRAP.md",
  "schemas/manifest.schema.json",
  "schemas/record.schema.json",
  "schemas/proposal.schema.json",
  "schemas/task.schema.json",
  "schemas/hydration.schema.json",
  "schemas/extracted-facts.schema.json",
  "schemas/transaction.schema.json",
  "skills/maintain-repository-documentation/SKILL.md",
  "skills/maintain-repository-documentation/INPUTS.md",
  "skills/maintain-repository-documentation/OUTPUTS.md",
  "skills/maintain-repository-documentation/schemas/proposal.schema.json",
]);

function fail(code, detail) {
  throw new Error(detail ? `${code}: ${detail}` : code);
}

export function globalExecutable(platform = process.platform) {
  return platform === "win32" ? "lore.cmd" : "lore";
}

export function globalPathDirectory(prefix, platform = process.platform) {
  return platform === "win32" ? prefix : path.posix.join(prefix, "bin");
}

export function localExecutable(consumerRoot, platform = process.platform) {
  const platformPath = platform === "win32" ? path.win32 : path.posix;
  return platformPath.join(
    consumerRoot,
    "node_modules",
    ".bin",
    globalExecutable(platform),
  );
}

export function sanitizedEnvironment(environment = process.env) {
  return Object.fromEntries(
    Object.entries(environment).filter(
      ([name, value]) =>
        value !== undefined &&
        name !== "NODE_PATH" &&
        name !== "TSX_TSCONFIG_PATH" &&
        !name.startsWith("LORE_SOURCE_"),
    ),
  );
}

export function packageIdentityFromTarballBytes(bytes) {
  const entries = readTarGzip(bytes);
  const manifest = entries.find(
    (entry) => entry.name === "package/package.json" && entry.type === "0",
  );
  if (!manifest) fail("SMOKE_PACKAGE_IDENTITY_INVALID", "package.json missing");
  let parsed;
  try {
    parsed = JSON.parse(manifest.content.toString("utf8"));
  } catch (error) {
    fail(
      "SMOKE_PACKAGE_IDENTITY_INVALID",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (
    parsed?.name !== PACKAGE_NAME ||
    typeof parsed?.version !== "string" ||
    parsed?.bin?.lore !== PACKAGE_BIN ||
    Object.keys(parsed.bin ?? {}).length !== 1
  ) {
    fail("SMOKE_PACKAGE_IDENTITY_INVALID");
  }
  return { name: parsed.name, version: parsed.version };
}

export function createSmokeReport(platform, node, modes) {
  if (!new Set(["linux", "darwin", "win32"]).has(platform)) {
    fail("SMOKE_PLATFORM_UNSUPPORTED", platform);
  }
  if (
    !Array.isArray(modes) ||
    modes.length === 0 ||
    modes.some((mode) => mode !== "local" && mode !== "global") ||
    new Set(modes).size !== modes.length
  ) {
    fail("SMOKE_MODE_SET_INVALID");
  }
  return {
    schema_version: 1,
    platform,
    node,
    modes: modes.map((mode) => ({ mode, passed: true })),
  };
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (
      !["--tarball", "--mode", "--report"].includes(flag) ||
      typeof value !== "string" ||
      value.startsWith("--") ||
      values.has(flag)
    ) {
      fail("SMOKE_USAGE_INVALID");
    }
    values.set(flag, value);
  }
  if (values.size !== 3 || !MODES.has(values.get("--mode"))) {
    fail("SMOKE_USAGE_INVALID");
  }
  return {
    tarball: values.get("--tarball"),
    mode: values.get("--mode"),
    report: values.get("--report"),
  };
}

function executable(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function run(command, args, { cwd, env, capture = true } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
    shell: process.platform === "win32",
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.error) fail("SMOKE_COMMAND_START_FAILED", result.error.message);
  if (result.status !== 0) {
    fail(
      "SMOKE_COMMAND_FAILED",
      [
        `${command} ${args.join(" ")} exited ${String(result.status)}`,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join("\n")
        .trim(),
    );
  }
  return capture ? result.stdout.trim() : "";
}

function parseVersionOutput(output, identity) {
  let parsed;
  try {
    parsed = JSON.parse(output);
  } catch (error) {
    fail(
      "SMOKE_VERSION_OUTPUT_INVALID",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (parsed?.name !== identity.name || parsed?.version !== identity.version) {
    fail(
      "SMOKE_VERSION_IDENTITY_MISMATCH",
      `${String(parsed?.name)}@${String(parsed?.version)}`,
    );
  }
}

function verifyHelp(output) {
  if (!output.includes("LORE Organizes Repository Evidence")) {
    fail("SMOKE_HELP_OUTPUT_INVALID");
  }
}

async function verifyInitializedPaths(repositoryRoot) {
  for (const relativePath of REQUIRED_INITIALIZED_PATHS) {
    try {
      await access(path.join(repositoryRoot, ...relativePath.split("/")));
    } catch {
      fail("SMOKE_INITIALIZED_PATH_MISSING", relativePath);
    }
  }
}

async function exerciseRepository(launcher, environment, parentDirectory) {
  const repositoryRoot = path.join(parentDirectory, "repository");
  await mkdir(repositoryRoot, { recursive: true });
  run(executable("git"), ["init"], { cwd: repositoryRoot, env: environment });
  run(executable("git"), ["config", "user.name", "LORE Installation Test"], {
    cwd: repositoryRoot,
    env: environment,
  });
  run(
    executable("git"),
    ["config", "user.email", "lore-installation-test@example.invalid"],
    { cwd: repositoryRoot, env: environment },
  );
  run(
    launcher,
    ["init", "--id", "installation-smoke", "--name", "Installation Smoke"],
    { cwd: repositoryRoot, env: environment },
  );
  await verifyInitializedPaths(repositoryRoot);
  for (const args of [
    ["extract"],
    ["validate"],
    ["project"],
    ["extract", "--check"],
    ["project", "--check"],
  ]) {
    run(launcher, args, { cwd: repositoryRoot, env: environment });
  }
  run(executable("git"), ["add", "."], {
    cwd: repositoryRoot,
    env: environment,
  });
  run(
    executable("git"),
    ["commit", "-m", "Initialize LORE smoke repository"],
    { cwd: repositoryRoot, env: environment },
  );
  const status = run(executable("git"), ["status", "--porcelain=v1"], {
    cwd: repositoryRoot,
    env: environment,
  });
  if (status !== "") fail("SMOKE_REPOSITORY_DIRTY", status);
}

async function smokeLocal(tarballPath, identity, baseEnvironment, temporaryRoot) {
  const consumerRoot = path.join(temporaryRoot, "local-consumer");
  await mkdir(consumerRoot, { recursive: true });
  const npm = executable("npm");
  run(npm, ["init", "--yes"], {
    cwd: consumerRoot,
    env: baseEnvironment,
  });
  run(npm, ["install", tarballPath], {
    cwd: consumerRoot,
    env: baseEnvironment,
  });

  const launcher = localExecutable(consumerRoot);
  await access(launcher);
  verifyHelp(
    run(npm, ["exec", "--", "lore", "--help"], {
      cwd: consumerRoot,
      env: baseEnvironment,
    }),
  );
  parseVersionOutput(
    run(npm, ["exec", "--", "lore", "version", "--json"], {
      cwd: consumerRoot,
      env: baseEnvironment,
    }),
    identity,
  );
  await exerciseRepository(
    launcher,
    baseEnvironment,
    path.join(temporaryRoot, "local-workflow"),
  );
}

async function smokeGlobal(tarballPath, identity, baseEnvironment, temporaryRoot) {
  const prefix = path.join(temporaryRoot, "global-prefix");
  await mkdir(prefix, { recursive: true });
  const npm = executable("npm");
  run(npm, ["install", "--global", "--prefix", prefix, tarballPath], {
    cwd: temporaryRoot,
    env: baseEnvironment,
  });

  const binDirectory = globalPathDirectory(prefix);
  const environment = {
    ...baseEnvironment,
    PATH: [binDirectory, baseEnvironment.PATH].filter(Boolean).join(path.delimiter),
  };
  const launcher = path.join(binDirectory, globalExecutable());
  await access(launcher);
  verifyHelp(run(launcher, ["--help"], { cwd: temporaryRoot, env: environment }));
  parseVersionOutput(
    run(launcher, ["version", "--json"], {
      cwd: temporaryRoot,
      env: environment,
    }),
    identity,
  );
  await exerciseRepository(
    launcher,
    environment,
    path.join(temporaryRoot, "global-workflow"),
  );
}

async function main() {
  const { tarball, mode, report } = parseArguments(process.argv.slice(2));
  const tarballPath = path.resolve(tarball);
  const reportPath = path.resolve(report);
  const identity = packageIdentityFromTarballBytes(await readFile(tarballPath));
  const selectedModes =
    mode === "all" ? ["local", "global"] : [mode];
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "lore-installed-smoke-"));
  const environment = sanitizedEnvironment();
  try {
    for (const selectedMode of selectedModes) {
      if (selectedMode === "local") {
        await smokeLocal(tarballPath, identity, environment, temporaryRoot);
      } else {
        await smokeGlobal(tarballPath, identity, environment, temporaryRoot);
      }
    }
    const result = createSmokeReport(
      process.platform,
      process.versions.node,
      selectedModes,
    );
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(result, null, 2)}\n`);
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } finally {
    await rm(temporaryRoot, { recursive: true, force: true });
  }
}

const entryPath = process.argv[1]
  ? fileURLToPath(new URL(import.meta.url)) === path.resolve(process.argv[1])
  : false;
if (entryPath) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(
      `INSTALLED_SMOKE_FAILED: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
