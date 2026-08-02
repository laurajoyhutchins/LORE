#!/usr/bin/env node

import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const CHUNK_BYTES = 8_000;

function digest(algorithm, bytes) {
  return createHash(algorithm).update(bytes).digest("hex");
}

function gitBlobId(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, "utf8");
  return digest("sha1", Buffer.concat([header, bytes]));
}

export function createVerifiedLockfileArtifact(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) {
    throw new Error("LOCKFILE_ARTIFACT_INPUT_INVALID");
  }

  const parts = [];
  for (let offset = 0, index = 0; offset < bytes.length; offset += CHUNK_BYTES, index += 1) {
    const raw = Buffer.from(bytes.subarray(offset, offset + CHUNK_BYTES));
    const compressed = gzipSync(raw, { level: 9 });
    const name = `part-${String(index).padStart(3, "0")}.gz`;
    parts.push({
      name,
      compressed,
      manifest: {
        path: name,
        compressed_bytes: compressed.length,
        raw_bytes: raw.length,
        sha256: digest("sha256", compressed),
        git_blob: gitBlobId(compressed),
      },
    });
  }

  return {
    manifest: {
      schema_version: 1,
      package_manager: "pnpm@10.14.0",
      output: "pnpm-lock.yaml",
      raw_bytes: bytes.length,
      sha256: digest("sha256", bytes),
      git_blob: gitBlobId(bytes),
      compression: "concatenated-gzip-members",
      parts: parts.map(({ manifest }) => manifest),
    },
    parts,
  };
}

export async function writeVerifiedLockfileArtifact(
  lockfilePath = path.resolve("pnpm-lock.yaml"),
  artifactDirectory = path.resolve("artifacts", "verified-lockfile"),
) {
  const bytes = await readFile(lockfilePath);
  const artifact = createVerifiedLockfileArtifact(bytes);
  await mkdir(artifactDirectory, { recursive: true });

  for (const entry of await readdir(artifactDirectory, { withFileTypes: true })) {
    if (entry.isFile() && /^part-\d{3}\.gz$/u.test(entry.name)) {
      await rm(path.join(artifactDirectory, entry.name));
    }
  }

  for (const part of artifact.parts) {
    await writeFile(path.join(artifactDirectory, part.name), part.compressed);
  }
  await writeFile(
    path.join(artifactDirectory, "manifest.json"),
    `${JSON.stringify(artifact.manifest, null, 2)}\n`,
  );
  return artifact.manifest;
}

const isEntryPoint = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;
if (isEntryPoint) {
  try {
    const manifest = await writeVerifiedLockfileArtifact();
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  } catch (error) {
    process.stderr.write(
      `LOCKFILE_ARTIFACT_REFRESH_FAILED: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
