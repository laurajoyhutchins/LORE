import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fail, ok } from "../domain/errors.js";
import type {
  LoreManifest,
  SemanticRecord,
  ValidationProblem,
  ValidationResult,
} from "../domain/types.js";
import {
  resolveExistingInsideRoot,
  resolvePotentialInsideRoot,
} from "../filesystem/repository-paths.js";
import { createSchemaRegistry } from "../schemas/schema-registry.js";
import { parseYamlDocument } from "../serialization/yaml.js";

interface WalkResult {
  files: string[];
  problems: ValidationProblem[];
}

async function walk(directory: string, base: string): Promise<WalkResult> {
  const files: string[] = [];
  const problems: ValidationProblem[] = [];
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    const relative = path.relative(base, candidate).replace(/\\/g, "/");
    const stat = await lstat(candidate);
    if (stat.isSymbolicLink()) {
      problems.push({
        code: "INVALID_RECORD_PATH",
        message: `Symlink record path rejected: ${relative}`,
        location: relative,
      });
    } else if (stat.isDirectory()) {
      const nested = await walk(candidate, base);
      files.push(...nested.files);
      problems.push(...nested.problems);
    } else if (stat.isFile()) {
      files.push(candidate);
    }
  }
  return { files, problems };
}

export async function loadRecords(
  root: string,
  manifest: LoreManifest,
): Promise<ValidationResult<SemanticRecord[]>> {
  const baseResult = await resolvePotentialInsideRoot(root, manifest.paths.records);
  if (!baseResult.ok) return baseResult;
  const base = baseResult.value;
  const walked = await walk(base, base);
  const problems = [...walked.problems];
  const records: SemanticRecord[] = [];
  const registry = createSchemaRegistry(root);

  for (const file of walked.files.sort()) {
    const relative = path.relative(base, file).replace(/\\/g, "/");
    const match = /^(repository|component|relationship|decision|finding|constraint|procedure)\/([a-z0-9]+(?:[.-][a-z0-9]+)*)\/(\d+)\.yaml$/.exec(relative);
    if (!match) {
      problems.push({
        code: "INVALID_RECORD_PATH",
        message: `Invalid record path: ${relative}`,
        location: relative,
      });
      continue;
    }

    const repositoryRelative = path.relative(path.resolve(root), file).replace(/\\/g, "/");
    const safeFile = await resolveExistingInsideRoot(root, repositoryRelative);
    if (!safeFile.ok) {
      problems.push(...safeFile.errors);
      continue;
    }
    const parsed = parseYamlDocument<unknown>(await readFile(safeFile.value, "utf8"), relative);
    if (!parsed.ok) {
      problems.push(...parsed.errors);
      continue;
    }
    const validated = registry.validateWithSchema<SemanticRecord>("record", parsed.value);
    if (!validated.ok) {
      problems.push(...validated.errors.map((problem) => ({ ...problem, location: relative })));
      continue;
    }

    const record = validated.value;
    if (
      record.kind !== match[1] ||
      record.id !== match[2] ||
      record.revision !== Number(match[3])
    ) {
      problems.push({
        code: "RECORD_PATH_MISMATCH",
        message: `Envelope does not match ${relative}`,
        location: relative,
      });
      continue;
    }
    records.push(record);
  }

  if (problems.length > 0) return fail(...problems);
  records.sort(
    (left, right) =>
      left.kind.localeCompare(right.kind) ||
      left.id.localeCompare(right.id) ||
      left.revision - right.revision,
  );
  return ok(records);
}
