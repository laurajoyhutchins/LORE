import { cp, mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ok } from "../domain/errors.js";
import type { DemoReport, ValidationResult } from "../domain/types.js";
import { verifySelf } from "../verification/verify-self.js";

export async function runDemo(root: string): Promise<ValidationResult<DemoReport>> {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "lore-demo-"));
  await cp(root, temporaryRoot, {
    recursive: true,
    filter: (source) =>
      !source.includes("node_modules") && !source.includes(`${path.sep}.git`),
  });
  const verification = await verifySelf(temporaryRoot);
  await rm(temporaryRoot, { recursive: true, force: true });
  if (!verification.ok) return verification;
  return ok({
    steps: [
      "extract --check",
      "validate",
      "project --check",
      "hydrate",
      "validate-proposal",
      "diff",
      "verify-self",
    ],
    clean: true,
  });
}
