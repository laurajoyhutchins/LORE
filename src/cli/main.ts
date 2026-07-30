#!/usr/bin/env node

import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { loadManifest } from "../config/load-manifest.js";
import { createMaintainerContext } from "../context/create-context.js";
import { runDemo } from "../demo/run-demo.js";
import { semanticDiff } from "../diff/semantic-diff.js";
import { fail, ok } from "../domain/errors.js";
import type {
  LoreTask,
  TransactionReceipt,
  ValidationProblem,
  ValidationResult,
} from "../domain/types.js";
import { explainRecord } from "../explain/explain-record.js";
import { extractRepository, writeExtraction } from "../extraction/extract.js";
import {
  prepareWritePathInsideRoot,
  resolveExistingInsideRoot,
  resolvePotentialInsideRoot,
} from "../filesystem/repository-paths.js";
import { hydrateTask } from "../hydration/hydrate.js";
import { initializeRepository } from "../init/initialize.js";
import { projectRepository } from "../projection/project.js";
import { validateProposal } from "../proposals/validate-proposal.js";
import { createSchemaRegistry } from "../schemas/schema-registry.js";
import { parseYamlDocument, stableYaml } from "../serialization/yaml.js";
import { applyTransaction } from "../transactions/apply-transaction.js";
import { planTransaction } from "../transactions/plan-transaction.js";
import { validateRepository } from "../validation/validate-repository.js";
import { verifySelf } from "../verification/verify-self.js";
import { HELP_TEXT, isLoreCommand } from "./output.js";

export interface CliIo {
  stdout(message: string): void;
  stderr(message: string): void;
}

const DEFAULT_IO: CliIo = {
  stdout: (message) => process.stdout.write(`${message}\n`),
  stderr: (message) => process.stderr.write(`${message}\n`),
};

async function readContainedText(
  root: string,
  candidate: string,
): Promise<ValidationResult<string>> {
  const resolved = await resolveExistingInsideRoot(root, candidate);
  if (!resolved.ok) return resolved;
  try {
    return ok(await readFile(resolved.value, "utf8"));
  } catch (error) {
    return fail({
      code: "PATH_NOT_READABLE",
      message: error instanceof Error ? error.message : String(error),
      location: candidate,
    });
  }
}

async function writeMap(root: string, files: Map<string, string>): Promise<void> {
  for (const [relativePath, content] of files) {
    const target = await prepareWritePathInsideRoot(root, relativePath);
    if (!target.ok) throw new Error(target.errors.map(({ message }) => message).join("; "));
    await writeFile(target.value, content);
  }
}

function printProblems(io: CliIo, result: { ok: false; errors: ValidationProblem[] }): number {
  for (const problem of result.errors) {
    io.stderr(`${problem.code}: ${problem.message}`);
  }
  return 1;
}

function requirePositionals(
  command: string,
  positionals: string[],
  expected: number,
): ValidationResult<string[]> {
  if (positionals.length !== expected) {
    return {
      ok: false,
      errors: [
        {
          code: "USAGE_ERROR",
          message: `${command} expects ${expected} argument${expected === 1 ? "" : "s"}`,
        },
      ],
    };
  }
  return { ok: true, value: positionals, warnings: [] };
}

async function loadReceipts(root: string, directory: string): Promise<TransactionReceipt[]> {
  const safeDirectory = await resolvePotentialInsideRoot(root, directory);
  if (!safeDirectory.ok) {
    throw new Error(safeDirectory.errors.map(({ message }) => message).join("; "));
  }
  const names = await readdir(safeDirectory.value).catch(() => []);
  const registry = createSchemaRegistry(root);
  const receipts: TransactionReceipt[] = [];
  for (const name of names.filter((value) => value.endsWith(".yaml")).sort()) {
    const relativePath = path.posix.join(directory.replace(/\\/g, "/"), name);
    const file = await readContainedText(root, relativePath);
    if (!file.ok) throw new Error(file.errors.map(({ message }) => message).join("; "));
    const parsed = parseYamlDocument<unknown>(file.value, relativePath);
    if (!parsed.ok) throw new Error(parsed.errors.map(({ message }) => message).join("; "));
    const validated = registry.validateWithSchema<TransactionReceipt>("transaction", parsed.value);
    if (!validated.ok) throw new Error(validated.errors.map(({ message }) => message).join("; "));
    receipts.push(validated.value);
  }
  return receipts;
}

async function generatedMatches(
  root: string,
  relativePath: string,
  expected: string,
): Promise<ValidationResult<boolean>> {
  const current = await readContainedText(root, relativePath);
  if (!current.ok) {
    if (current.errors.every(({ code }) => code === "PATH_NOT_FOUND")) return ok(false);
    return current;
  }
  return ok(current.value === expected);
}

export async function runCli(argv: string[], io: CliIo = DEFAULT_IO): Promise<number> {
  let parsed: ReturnType<typeof parseArgs>;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        help: { type: "boolean", short: "h" },
        check: { type: "boolean" },
        force: { type: "boolean" },
        name: { type: "string" },
        id: { type: "string" },
        json: { type: "boolean" },
      },
    });
  } catch (error) {
    io.stderr(`USAGE_ERROR: ${error instanceof Error ? error.message : String(error)}`);
    return 2;
  }

  const [command, ...positionals] = parsed.positionals;
  if (parsed.values.help === true || command === undefined || command === "help") {
    io.stdout(HELP_TEXT);
    return 0;
  }
  if (!isLoreCommand(command)) {
    io.stderr(`USAGE_ERROR: Unknown command: ${command}`);
    return 2;
  }

  const root = process.cwd();
  try {
    if (command === "init") {
      const args = requirePositionals(command, positionals, 0);
      if (!args.ok) return printProblems(io, args);
      const result = await initializeRepository(root, {
        repositoryId: String(parsed.values.id ?? "repository"),
        repositoryName: String(parsed.values.name ?? "Repository"),
        force: Boolean(parsed.values.force),
      });
      if (!result.ok) return printProblems(io, result);
      io.stdout(stableYaml(result.value));
      return 0;
    }

    if (command === "extract") {
      const args = requirePositionals(command, positionals, 0);
      if (!args.ok) return printProblems(io, args);
      const manifest = await loadManifest(root);
      if (!manifest.ok) return printProblems(io, manifest);
      const extraction = await extractRepository(root, manifest.value);
      if (!extraction.ok) return printProblems(io, extraction);
      if (parsed.values.check === true) {
        for (const [relativePath, expected] of extraction.value.files) {
          const matches = await generatedMatches(root, relativePath, expected);
          if (!matches.ok) return printProblems(io, matches);
          if (!matches.value) {
            io.stderr(`GENERATED_OUTPUT_STALE: ${relativePath}`);
            return 14;
          }
        }
      } else {
        await writeExtraction(root, extraction.value);
      }
      return 0;
    }

    const repository = await validateRepository(root);
    if (!repository.ok) return printProblems(io, repository);

    if (command === "validate") {
      const args = requirePositionals(command, positionals, 0);
      if (!args.ok) return printProblems(io, args);
      io.stdout("VALID");
      return 0;
    }

    if (command === "project") {
      const args = requirePositionals(command, positionals, 0);
      if (!args.ok) return printProblems(io, args);
      const projections = await projectRepository(repository.value);
      if (!projections.ok) return printProblems(io, projections);
      if (parsed.values.check === true) {
        for (const [relativePath, expected] of projections.value) {
          const matches = await generatedMatches(root, relativePath, expected);
          if (!matches.ok) return printProblems(io, matches);
          if (!matches.value) {
            io.stderr(`GENERATED_OUTPUT_STALE: ${relativePath}`);
            return 14;
          }
        }
      } else {
        await writeMap(root, projections.value);
      }
      return 0;
    }

    if (command === "hydrate" || command === "context") {
      const args = requirePositionals(command, positionals, 1);
      if (!args.ok) return printProblems(io, args);
      const taskPath = args.value[0] as string;
      const task = await readContainedText(root, taskPath);
      if (!task.ok) return printProblems(io, task);
      const parsedTask = parseYamlDocument<unknown>(task.value, taskPath);
      if (!parsedTask.ok) return printProblems(io, parsedTask);
      const validatedTask = createSchemaRegistry(root).validateWithSchema<LoreTask>(
        "task",
        parsedTask.value,
      );
      if (!validatedTask.ok) return printProblems(io, validatedTask);
      const packet = hydrateTask(validatedTask.value, repository.value);
      io.stdout(
        stableYaml(
          command === "hydrate"
            ? packet
            : createMaintainerContext(validatedTask.value, packet, repository.value),
        ),
      );
      return 0;
    }

    if (command === "validate-proposal" || command === "apply") {
      const args = requirePositionals(command, positionals, 1);
      if (!args.ok) return printProblems(io, args);
      const proposal = await validateProposal(root, args.value[0] as string, repository.value);
      if (!proposal.ok) return printProblems(io, proposal);
      if (command === "validate-proposal") {
        io.stdout("VALID");
        return 0;
      }
      const plan = await planTransaction(root, proposal.value, repository.value);
      if (!plan.ok) return printProblems(io, plan);
      const applied = await applyTransaction(root, plan.value);
      if (!applied.ok) return printProblems(io, applied);
      io.stdout(stableYaml(applied.value));
      return 0;
    }

    if (command === "diff") {
      const args = requirePositionals(command, positionals, 2);
      if (!args.ok) return printProblems(io, args);
      const result = await semanticDiff(root, args.value[0] as string, args.value[1] as string);
      if (!result.ok) return printProblems(io, result);
      io.stdout(parsed.values.json === true ? JSON.stringify(result.value, null, 2) : stableYaml(result.value));
      return 0;
    }

    if (command === "explain") {
      const args = requirePositionals(command, positionals, 1);
      if (!args.ok) return printProblems(io, args);
      const receipts = await loadReceipts(root, repository.value.manifest.paths.transactions);
      const result = explainRecord(args.value[0] as string, repository.value, receipts);
      if (!result.ok) return printProblems(io, result);
      io.stdout(parsed.values.json === true ? JSON.stringify(result.value, null, 2) : stableYaml(result.value));
      return 0;
    }

    if (command === "verify-self") {
      const args = requirePositionals(command, positionals, 0);
      if (!args.ok) return printProblems(io, args);
      const result = await verifySelf(root);
      if (!result.ok) return printProblems(io, result);
      io.stdout(stableYaml(result.value));
      return 0;
    }

    if (command === "demo") {
      const args = requirePositionals(command, positionals, 0);
      if (!args.ok) return printProblems(io, args);
      const result = await runDemo(root);
      if (!result.ok) return printProblems(io, result);
      io.stdout(stableYaml(result.value));
      return 0;
    }

    io.stderr(`NOT_IMPLEMENTED: ${String(command)}`);
    return 1;
  } catch (error) {
    io.stderr(`INTERNAL_ERROR: ${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], "file:").href) {
  process.exitCode = await runCli(process.argv.slice(2));
}
