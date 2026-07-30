import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";

export const EXPECTED_LOCKFILE_SHA256 =
  "e5e1747bac45b623c375226759fce20857b50ee615926dce1aefd282104ee57d";
export const EXPECTED_LOCKFILE_GIT_BLOB =
  "7aec11b06bef06188262e0ca8ae44b8e35f158c9";
export const EXPECTED_LOCKFILE_BYTES = 62_769;

const SCRIPT_DIRECTORY = path.dirname(fileURLToPath(import.meta.url));
export const REPOSITORY_ROOT = path.resolve(SCRIPT_DIRECTORY, "..");
export const ARTIFACT_DIRECTORY = path.join(
  REPOSITORY_ROOT,
  "artifacts",
  "verified-lockfile",
);
export const MANIFEST_PATH = path.join(ARTIFACT_DIRECTORY, "manifest.json");

const EXPECTED_PART_PATHS = Array.from(
  { length: 8 },
  (_, index) => `part-${String(index).padStart(3, "0")}.gz`,
);

export function digest(algorithm, bytes) {
  return createHash(algorithm).update(bytes).digest("hex");
}

export function gitBlobId(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, "utf8");
  return digest("sha1", Buffer.concat([header, bytes]));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readManifest() {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  assert(manifest.schema_version === 1, "unsupported lock artifact schema");
  assert(manifest.package_manager === "pnpm@10.14.0", "unexpected package manager");
  assert(manifest.output === "pnpm-lock.yaml", "unexpected lockfile output path");
  assert(manifest.raw_bytes === EXPECTED_LOCKFILE_BYTES, "unexpected raw byte count");
  assert(manifest.sha256 === EXPECTED_LOCKFILE_SHA256, "unexpected lockfile SHA-256");
  assert(
    manifest.git_blob === EXPECTED_LOCKFILE_GIT_BLOB,
    "unexpected lockfile Git blob",
  );
  assert(
    manifest.compression === "concatenated-gzip-members",
    "unexpected lock artifact compression",
  );
  assert(Array.isArray(manifest.parts), "lock artifact parts must be an array");
  assert(
    manifest.parts.length === EXPECTED_PART_PATHS.length,
    "unexpected lock artifact part count",
  );
  for (const [index, part] of manifest.parts.entries()) {
    assert(
      part.path === EXPECTED_PART_PATHS[index],
      `unexpected lock artifact part at index ${index}`,
    );
  }
  return manifest;
}

function readPart(part) {
  const partPath = path.join(ARTIFACT_DIRECTORY, part.path);
  const relative = path.relative(ARTIFACT_DIRECTORY, partPath);
  assert(
    relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative),
    `lock artifact part escapes its directory: ${part.path}`,
  );
  const stat = lstatSync(partPath);
  assert(stat.isFile() && !stat.isSymbolicLink(), `invalid lock artifact part: ${part.path}`);
  const bytes = readFileSync(partPath);
  assert(bytes.length === part.compressed_bytes, `byte count mismatch for ${part.path}`);
  assert(digest("sha256", bytes) === part.sha256, `SHA-256 mismatch for ${part.path}`);
  assert(gitBlobId(bytes) === part.git_blob, `Git blob mismatch for ${part.path}`);
  return bytes;
}

export function verifyLockfileBytes(bytes) {
  assert(bytes.length === EXPECTED_LOCKFILE_BYTES, "lockfile byte count mismatch");
  assert(
    digest("sha256", bytes) === EXPECTED_LOCKFILE_SHA256,
    "lockfile SHA-256 mismatch",
  );
  assert(
    gitBlobId(bytes) === EXPECTED_LOCKFILE_GIT_BLOB,
    "lockfile Git blob mismatch",
  );
}

export function readVerifiedLockfileArtifact() {
  const manifest = readManifest();
  const compressed = Buffer.concat(manifest.parts.map(readPart));
  const bytes = gunzipSync(compressed);
  assert(
    manifest.parts.reduce((total, part) => total + part.raw_bytes, 0) ===
      EXPECTED_LOCKFILE_BYTES,
    "lock artifact raw byte accounting mismatch",
  );
  verifyLockfileBytes(bytes);
  return { bytes, manifest };
}

export function committedLockArtifactPaths() {
  const manifest = readManifest();
  return new Set(
    manifest.parts.map((part) =>
      path.posix.join("artifacts", "verified-lockfile", part.path),
    ),
  );
}

export function ensureVerifiedLockfile(
  destination = path.resolve(process.cwd(), "pnpm-lock.yaml"),
) {
  const { bytes } = readVerifiedLockfileArtifact();
  if (existsSync(destination)) {
    const current = readFileSync(destination);
    verifyLockfileBytes(current);
    return { created: false, destination };
  }

  writeFileSync(destination, bytes, { flag: "wx", mode: 0o644 });
  verifyLockfileBytes(readFileSync(destination));
  return { created: true, destination };
}

export function removeRestoredLockfile(destination) {
  if (!existsSync(destination)) return;
  verifyLockfileBytes(readFileSync(destination));
  unlinkSync(destination);
}
