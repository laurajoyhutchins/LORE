import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fail, ok } from "../domain/errors.js";
import { recordReference } from "../domain/references.js";
import type { SemanticRecord, ValidationResult } from "../domain/types.js";
import { parseYamlDocument } from "../serialization/yaml.js";

const exec = promisify(execFile);

export interface SemanticDiff {
  base: string;
  target: string;
  records: {
    added: string[];
    superseded: Array<{ from: string; to: string }>;
    resolved: string[];
    deprecated: string[];
  };
  components: {
    added: string[];
    removed: string[];
    relationshipsAdded: string[];
    relationshipsRemoved: string[];
  };
  projectionsChanged: string[];
  hydrationChanged: Array<{
    task: string;
    addedReferences: string[];
    removedReferences: string[];
  }>;
}

async function run(root: string, args: string[]): Promise<string> {
  const result = await exec("git", args, {
    cwd: root,
    timeout: 10_000,
    maxBuffer: 10 * 1024 * 1024,
  });
  return result.stdout.trimEnd();
}

async function filesAt(root: string, revision: string, prefix: string): Promise<string[]> {
  const output = await run(root, ["ls-tree", "-r", "--name-only", revision, "--", prefix]);
  return output ? output.split("\n").filter(Boolean).sort() : [];
}

async function readAt(root: string, revision: string, file: string): Promise<string> {
  return run(root, ["show", `${revision}:${file}`]);
}

async function loadRecordsAt(root: string, revision: string): Promise<SemanticRecord[]> {
  const files = (await filesAt(root, revision, ".lore/records")).filter((file) =>
    file.endsWith(".yaml"),
  );
  const records: SemanticRecord[] = [];
  for (const file of files) {
    const parsed = parseYamlDocument<SemanticRecord>(await readAt(root, revision, file), file);
    if (!parsed.ok) throw new Error(parsed.errors.map(({ message }) => message).join("; "));
    records.push(parsed.value);
  }
  return records;
}

async function readYamlAt<T>(
  root: string,
  revision: string,
  file: string,
  fallback: T,
): Promise<T> {
  try {
    const parsed = parseYamlDocument<T>(await readAt(root, revision, file), file);
    if (!parsed.ok) throw new Error(parsed.errors[0]?.message);
    return parsed.value;
  } catch {
    return fallback;
  }
}

function stableItems(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => JSON.stringify(item)).sort();
}

async function snapshotSelections(
  root: string,
  revision: string,
): Promise<Map<string, string[]>> {
  const files = (await filesAt(root, revision, ".lore/snapshots")).filter((file) =>
    file.endsWith(".context.yaml"),
  );
  const snapshots = new Map<string, string[]>();
  for (const file of files) {
    const value = await readYamlAt<{ selected?: Array<{ reference?: string }> }>(
      root,
      revision,
      file,
      {},
    );
    snapshots.set(
      path.basename(file, ".context.yaml"),
      (value.selected ?? [])
        .map(({ reference }) => reference)
        .filter((reference): reference is string => typeof reference === "string")
        .sort(),
    );
  }
  return snapshots;
}

function difference(left: string[], right: string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((item) => !rightSet.has(item)).sort();
}

export async function semanticDiff(
  root: string,
  base: string,
  target: string,
): Promise<ValidationResult<SemanticDiff>> {
  try {
    const [baseSha, targetSha] = await Promise.all([
      run(root, ["rev-parse", base]),
      run(root, ["rev-parse", target]),
    ]);
    const [baseRecords, targetRecords] = await Promise.all([
      loadRecordsAt(root, baseSha),
      loadRecordsAt(root, targetSha),
    ]);
    const repositoryId = "lore";
    const baseReferences = new Set(baseRecords.map((record) => recordReference(repositoryId, record)));
    const targetReferences = new Set(
      targetRecords.map((record) => recordReference(repositoryId, record)),
    );
    const addedRecords = targetRecords
      .filter((record) => !baseReferences.has(recordReference(repositoryId, record)))
      .sort((left, right) => recordReference(repositoryId, left).localeCompare(recordReference(repositoryId, right)));

    const baseComponents = await readYamlAt<{ components?: unknown[] }>(
      root,
      baseSha,
      ".lore/extracted/components.yaml",
      {},
    );
    const targetComponents = await readYamlAt<{ components?: unknown[] }>(
      root,
      targetSha,
      ".lore/extracted/components.yaml",
      {},
    );
    const baseRelationships = await readYamlAt<{ relationships?: unknown[] }>(
      root,
      baseSha,
      ".lore/extracted/relationships.yaml",
      {},
    );
    const targetRelationships = await readYamlAt<{ relationships?: unknown[] }>(
      root,
      targetSha,
      ".lore/extracted/relationships.yaml",
      {},
    );

    const changedOutput = await run(root, [
      "diff",
      "--name-only",
      baseSha,
      targetSha,
      "--",
      "README.md",
      "docs/generated",
    ]);
    const projectionsChanged = changedOutput
      ? changedOutput.split("\n").filter(Boolean).sort()
      : [];

    const [baseSnapshots, targetSnapshots] = await Promise.all([
      snapshotSelections(root, baseSha),
      snapshotSelections(root, targetSha),
    ]);
    const hydrationChanged = [...new Set([...baseSnapshots.keys(), ...targetSnapshots.keys()])]
      .sort()
      .map((task) => {
        const before = baseSnapshots.get(task) ?? [];
        const after = targetSnapshots.get(task) ?? [];
        return {
          task,
          addedReferences: difference(after, before),
          removedReferences: difference(before, after),
        };
      })
      .filter(({ addedReferences, removedReferences }) =>
        addedReferences.length > 0 || removedReferences.length > 0,
      );

    return ok({
      base: baseSha.toLowerCase(),
      target: targetSha.toLowerCase(),
      records: {
        added: addedRecords.map((record) => recordReference(repositoryId, record)),
        superseded: addedRecords
          .filter((record) => record.supersedes !== null)
          .map((record) => ({
            from: record.supersedes as string,
            to: recordReference(repositoryId, record),
          })),
        resolved: addedRecords
          .filter((record) => record.status === "resolved")
          .map((record) => recordReference(repositoryId, record)),
        deprecated: addedRecords
          .filter((record) => record.status === "deprecated")
          .map((record) => recordReference(repositoryId, record)),
      },
      components: {
        added: difference(
          stableItems(targetComponents.components),
          stableItems(baseComponents.components),
        ),
        removed: difference(
          stableItems(baseComponents.components),
          stableItems(targetComponents.components),
        ),
        relationshipsAdded: difference(
          stableItems(targetRelationships.relationships),
          stableItems(baseRelationships.relationships),
        ),
        relationshipsRemoved: difference(
          stableItems(baseRelationships.relationships),
          stableItems(targetRelationships.relationships),
        ),
      },
      projectionsChanged,
      hydrationChanged,
    });
  } catch (error) {
    return fail({
      code: "SEMANTIC_DIFF_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
