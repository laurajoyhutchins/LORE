import { rmSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { removeRestoredLockfile } from "../verified-lockfile.mjs";

export const GATE_TEMPORARY_PATHS = Object.freeze([
  "pnpm-lock.yaml",
  ".release-artifacts",
]);

export function removeGateTemporaryPaths({ lockfileCreated }) {
  rmSync(path.resolve(process.cwd(), ".release-artifacts"), {
    recursive: true,
    force: true,
  });
  if (lockfileCreated) {
    removeRestoredLockfile(path.resolve(process.cwd(), "pnpm-lock.yaml"));
  }
}
