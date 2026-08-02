import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  readTarGzip,
  sha256Hex,
  sha512Integrity,
} from "./tarball.mjs";

const PACKAGE_NAME = "@laurajoyhutchins/lore";
const REPOSITORY = "laurajoyhutchins/LORE";
const CLI_PATH = "package/dist/cli/main.js";
const REQUIRED_FILES = [
  "package/package.json",
  "package/README.md",
  "package/LICENSE",
  "package/BOOTSTRAP.md",
  CLI_PATH,
  "package/schemas/manifest.schema.json",
  "package/schemas/record.schema.json",
  "package/schemas/proposal.schema.json",
  "package/schemas/task.schema.json",
  "package/schemas/hydration.schema.json",
  "package/schemas/extracted-facts.schema.json",
  "package/schemas/transaction.schema.json",
  "package/skills/maintain-repository-documentation/SKILL.md",
  "package/skills/maintain-repository-documentation/INPUTS.md",
  "package/skills/maintain-repository-documentation/OUTPUTS.md",
  "package/skills/maintain-repository-documentation/schemas/proposal.schema.json",
];
const EXACT_FILES = new Set([
  "package/package.json",
  "package/README.md",
  "package/LICENSE",
  "package/BOOTSTRAP.md",
]);
const ALLOWED_PREFIXES = [
  "package/dist/",
  "package/schemas/",
  "package/skills/maintain-repository-documentation/",
];

function fail(code, detail) {
  throw new Error(detail ? `${code}: ${detail}` : code);
}

function isAllowedPath(name) {
  return (
    EXACT_FILES.has(name) ||
    ALLOWED_PREFIXES.some((prefix) => name.startsWith(prefix))
  );
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateManifest(entry) {
  let manifest;
  try {
    manifest = JSON.parse(entry.content.toString("utf8"));
  } catch (error) {
    fail(
      "PACKAGE_MANIFEST_INVALID",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (!isPlainObject(manifest)) fail("PACKAGE_MANIFEST_INVALID");
  if (manifest.name !== PACKAGE_NAME) {
    fail("PACKAGE_NAME_INVALID", String(manifest.name));
  }
  if (
    typeof manifest.version !== "string" ||
    !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u.test(
      manifest.version,
    )
  ) {
    fail("PACKAGE_VERSION_INVALID", String(manifest.version));
  }
  if (
    !isPlainObject(manifest.bin) ||
    Object.keys(manifest.bin).length !== 1 ||
    manifest.bin.lore !== "./dist/cli/main.js"
  ) {
    fail("PACKAGE_BIN_INVALID");
  }
  if (manifest.private !== undefined) fail("PACKAGE_PRIVATE_INVALID");
  if (
    manifest.main !== undefined ||
    manifest.module !== undefined ||
    manifest.types !== undefined ||
    manifest.exports !== undefined
  ) {
    fail("PACKAGE_LIBRARY_SURFACE_INVALID");
  }
  if (manifest.engines?.node !== ">=22") fail("PACKAGE_ENGINE_INVALID");
  if (manifest.publishConfig?.access !== "public") {
    fail("PACKAGE_ACCESS_INVALID");
  }
  return manifest;
}

export async function inspectPackageArtifact({
  tarballPath,
  repository,
  tag,
  commit,
}) {
  if (repository !== REPOSITORY) {
    fail("PACKAGE_REPOSITORY_INVALID", String(repository));
  }
  if (!/^[0-9a-f]{40}$/u.test(commit)) {
    fail("PACKAGE_COMMIT_INVALID", String(commit));
  }

  const bytes = await readFile(tarballPath);
  if (bytes.length === 0) fail("PACKAGE_ARTIFACT_EMPTY");
  const entries = readTarGzip(bytes);
  const regularFiles = new Map();

  for (const entry of entries) {
    if (!isAllowedPath(entry.name)) {
      fail("PACKAGE_PATH_NOT_ALLOWED", entry.name);
    }
    if (entry.type === "5") {
      if (!ALLOWED_PREFIXES.some((prefix) => entry.name.startsWith(prefix))) {
        fail("PACKAGE_PATH_NOT_ALLOWED", entry.name);
      }
      if (entry.size !== 0) fail("PACKAGE_DIRECTORY_NOT_EMPTY", entry.name);
      continue;
    }
    if (entry.type !== "0") {
      fail("PACKAGE_ENTRY_TYPE_NOT_ALLOWED", entry.name);
    }
    if (entry.content.includes(0)) fail("PACKAGE_FILE_BINARY", entry.name);
    regularFiles.set(entry.name, entry);
  }

  for (const required of REQUIRED_FILES) {
    if (!regularFiles.has(required)) {
      fail("PACKAGE_REQUIRED_FILE_MISSING", required);
    }
  }

  const manifest = validateManifest(regularFiles.get("package/package.json"));
  if (tag !== `v${manifest.version}`) {
    fail("PACKAGE_TAG_MISMATCH", `${tag} != v${manifest.version}`);
  }

  const cli = regularFiles.get(CLI_PATH);
  if ((cli.mode & 0o111) === 0) {
    fail("PACKAGE_CLI_NOT_EXECUTABLE", CLI_PATH);
  }
  if (!cli.content.toString("utf8").startsWith("#!/usr/bin/env node\n")) {
    fail("PACKAGE_CLI_SHEBANG_INVALID", CLI_PATH);
  }

  const files = [...regularFiles.values()]
    .map((entry) => ({
      path: entry.name,
      type: entry.type,
      mode: entry.mode,
      bytes: entry.size,
      sha256: sha256Hex(entry.content),
    }))
    .sort((left, right) =>
      left.path < right.path ? -1 : left.path > right.path ? 1 : 0,
    );

  return {
    schema_version: 1,
    package: { name: manifest.name, version: manifest.version },
    source: { repository, tag, commit },
    artifact: {
      filename: path.basename(tarballPath),
      bytes: bytes.length,
      sha256: sha256Hex(bytes),
      integrity: sha512Integrity(bytes),
    },
    files,
    platforms: [],
  };
}
