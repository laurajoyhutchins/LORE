#!/usr/bin/env node

import path from "node:path";
import process from "node:process";
import {
  EXPECTED_LOCKFILE_GIT_BLOB,
  EXPECTED_LOCKFILE_SHA256,
  ensureVerifiedLockfile,
} from "./verified-lockfile.mjs";

try {
  const destination = path.resolve(process.argv[2] ?? "pnpm-lock.yaml");
  const result = ensureVerifiedLockfile(destination);
  process.stdout.write(
    result.created
      ? `Restored verified lockfile at ${destination}\n`
      : `Existing lockfile already matches the verified artifact at ${destination}\n`,
  );
  process.stdout.write(`SHA-256: ${EXPECTED_LOCKFILE_SHA256}\n`);
  process.stdout.write(`Git blob: ${EXPECTED_LOCKFILE_GIT_BLOB}\n`);
} catch (error) {
  process.stderr.write(
    `LOCKFILE_RESTORE_FAILED: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
