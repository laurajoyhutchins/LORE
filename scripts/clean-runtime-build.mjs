#!/usr/bin/env node

import { rm } from "node:fs/promises";
import process from "node:process";

try {
  await rm("dist", { recursive: true, force: true });
} catch (error) {
  process.stderr.write(
    `CLEAN_RUNTIME_BUILD_FAILED: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
