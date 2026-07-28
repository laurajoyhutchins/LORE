#!/usr/bin/env node

import { parseArgs } from "node:util";
import { HELP_TEXT, isLoreCommand } from "./output.js";

export interface CliIo {
  stdout(message: string): void;
  stderr(message: string): void;
}

const DEFAULT_IO: CliIo = {
  stdout: (message) => process.stdout.write(`${message}\n`),
  stderr: (message) => process.stderr.write(`${message}\n`),
};

export async function runCli(
  argv: string[],
  io: CliIo = DEFAULT_IO,
): Promise<number> {
  let parsed: ReturnType<typeof parseArgs>;

  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        help: { type: "boolean", short: "h" },
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    io.stderr(`USAGE_ERROR: ${message}`);
    return 2;
  }

  const [command, ...extraPositionals] = parsed.positionals;

  if (parsed.values.help === true || command === undefined || command === "help") {
    io.stdout(HELP_TEXT);
    return 0;
  }

  if (!isLoreCommand(command)) {
    io.stderr(`Unknown command: ${command}`);
    return 2;
  }

  if (extraPositionals.length > 0) {
    io.stderr(`USAGE_ERROR: Unexpected arguments: ${extraPositionals.join(" ")}`);
    return 2;
  }

  io.stderr(`NOT_IMPLEMENTED: ${command}`);
  return 1;
}

const invokedPath = process.argv[1];
if (invokedPath !== undefined && import.meta.url === new URL(invokedPath, "file:").href) {
  process.exitCode = await runCli(process.argv.slice(2));
}
