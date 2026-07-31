#!/usr/bin/env node

import { chmod, readFile, stat } from "node:fs/promises";
import process from "node:process";

const CLI_PATH = "dist/cli/main.js";

function fail(code, detail) {
  throw new Error(detail ? `${code}: ${detail}` : code);
}

async function main() {
  const content = await readFile(CLI_PATH, "utf8");
  if (!content.startsWith("#!/usr/bin/env node\n")) {
    fail("PACKAGE_CLI_SHEBANG_INVALID", CLI_PATH);
  }
  await chmod(CLI_PATH, 0o755);
  if (process.platform !== "win32" && ((await stat(CLI_PATH)).mode & 0o111) === 0) {
    fail("PACKAGE_CLI_NOT_EXECUTABLE", CLI_PATH);
  }
}

try {
  await main();
} catch (error) {
  process.stderr.write(
    `PREPARE_PACKAGE_FAILED: ${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
}
