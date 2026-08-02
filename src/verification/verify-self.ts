import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fail, ok } from "../domain/errors.js";
import type {
  LoreTask,
  ValidationProblem,
  ValidationResult,
} from "../domain/types.js";
import { extractRepository } from "../extraction/extract.js";
import {
  resolveExistingInsideRoot,
  resolvePotentialInsideRoot,
} from "../filesystem/repository-paths.js";
import {
  hydrateTask,
  hydrationMarkdown,
  normalizeHydrationPacketForSnapshot,
} from "../hydration/hydrate.js";
import { projectRepository } from "../projection/project.js";
import { validateProposal } from "../proposals/validate-proposal.js";
import { createSchemaRegistry } from "../schemas/schema-registry.js";
import { parseYamlDocument, stableYaml } from "../serialization/yaml.js";
import { validateRepository } from "../validation/validate-repository.js";

export interface SelfVerificationReport {
  manifest: "passed";
  extraction: "passed";
  records: "passed";
  evidence: "passed";
  skill: "passed";
  proposals: "passed";
  projections: "passed";
  hydration: "passed";
  history: "passed";
  determinism: "passed";
}

async function readContained(
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

async function walkFiles(
  root: string,
  directory: string,
): Promise<ValidationResult<string[]>> {
  const safeDirectory = await resolvePotentialInsideRoot(root, directory);
  if (!safeDirectory.ok) return safeDirectory;
  const entries = await readdir(safeDirectory.value, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  const problems: ValidationProblem[] = [];

  for (const entry of entries) {
    const relative = path.posix.join(directory.replace(/\\/g, "/"), entry.name);
    if (entry.isSymbolicLink()) {
      problems.push({
        code: "SYMLINK_PATH_REJECTED",
        message: `Symbolic links are not allowed during self-verification: ${relative}`,
        location: relative,
      });
    } else if (entry.isDirectory()) {
      const nested = await walkFiles(root, relative);
      if (nested.ok) files.push(...nested.value);
      else problems.push(...nested.errors);
    } else if (entry.isFile()) {
      const safeFile = await resolveExistingInsideRoot(root, relative);
      if (safeFile.ok) files.push(relative);
      else problems.push(...safeFile.errors);
    }
  }

  return problems.length > 0 ? fail(...problems) : ok(files.sort());
}

function equalMaps(left: Map<string, string>, right: Map<string, string>): boolean {
  if (left.size !== right.size) return false;
  for (const [key, value] of left) if (right.get(key) !== value) return false;
  return true;
}

export async function verifySelf(
  root: string,
): Promise<ValidationResult<SelfVerificationReport>> {
  const repositoryResult = await validateRepository(root);
  if (!repositoryResult.ok) return repositoryResult;
  const repository = repositoryResult.value;
  const problems: ValidationProblem[] = [];

  const extractionA = await extractRepository(root, repository.manifest);
  const extractionB = await extractRepository(root, repository.manifest);
  if (!extractionA.ok) problems.push(...extractionA.errors);
  if (!extractionB.ok) problems.push(...extractionB.errors);
  if (extractionA.ok && extractionB.ok) {
    if (!equalMaps(extractionA.value.files, extractionB.value.files)) {
      problems.push({ code: "DETERMINISM_FAILED", message: "Two extraction runs differ" });
    }
    if (
      JSON.stringify(extractionA.value.obsoleteFiles) !==
      JSON.stringify(extractionB.value.obsoleteFiles)
    ) {
      problems.push({
        code: "DETERMINISM_FAILED",
        message: "Two extraction cleanup plans differ",
      });
    }
    for (const [relativePath, expected] of extractionA.value.files) {
      const actual = await readContained(root, relativePath);
      if (!actual.ok) problems.push(...actual.errors);
      else if (actual.value !== expected) {
        problems.push({
          code: "GENERATED_OUTPUT_STALE",
          message: `Stale extracted facts: ${relativePath}`,
          location: relativePath,
        });
      }
    }
    for (const relativePath of extractionA.value.obsoleteFiles) {
      const actual = await readContained(root, relativePath);
      if (actual.ok) {
        problems.push({
          code: "GENERATED_OUTPUT_STALE",
          message: `Obsolete extracted facts: ${relativePath}`,
          location: relativePath,
        });
      } else if (!actual.errors.every(({ code }) => code === "PATH_NOT_FOUND")) {
        problems.push(...actual.errors);
      }
    }
  }

  const projectionA = await projectRepository(repository);
  const projectionB = await projectRepository(repository);
  if (!projectionA.ok) problems.push(...projectionA.errors);
  if (!projectionB.ok) problems.push(...projectionB.errors);
  if (projectionA.ok && projectionB.ok) {
    if (!equalMaps(projectionA.value, projectionB.value)) {
      problems.push({ code: "DETERMINISM_FAILED", message: "Two projection runs differ" });
    }
    for (const [relativePath, expected] of projectionA.value) {
      const actual = await readContained(root, relativePath);
      if (!actual.ok) problems.push(...actual.errors);
      else if (actual.value !== expected) {
        problems.push({
          code: "GENERATED_OUTPUT_STALE",
          message: `Stale projection: ${relativePath}`,
          location: relativePath,
        });
      }
    }
  }

  const requiredSkillFiles = [
    repository.manifest.maintenance.skill,
    "skills/maintain-repository-documentation/INPUTS.md",
    "skills/maintain-repository-documentation/OUTPUTS.md",
    repository.manifest.maintenance.proposal_schema,
  ];
  const forbiddenProviderDependency = /\b(OpenAI|Anthropic|Claude|ChatGPT|Codex)\b/i;
  for (const relativePath of requiredSkillFiles) {
    const text = await readContained(root, relativePath);
    if (!text.ok) {
      problems.push(
        ...text.errors.map((problem) => ({
          ...problem,
          code: problem.code === "PATH_NOT_FOUND" ? "SKILL_MISSING" : problem.code,
        })),
      );
    } else if (forbiddenProviderDependency.test(text.value)) {
      problems.push({
        code: "SKILL_NOT_NEUTRAL",
        message: `Provider dependency found in ${relativePath}`,
      });
    }
  }

  const proposalWalk = await walkFiles(root, repository.manifest.paths.proposals);
  if (!proposalWalk.ok) problems.push(...proposalWalk.errors);
  const proposalFiles = proposalWalk.ok
    ? proposalWalk.value.filter((file) => file.endsWith(".yaml") || file.endsWith(".yml"))
    : [];
  if (proposalFiles.length === 0) {
    problems.push({ code: "PROPOSAL_FIXTURE_MISSING", message: "No proposal fixtures found" });
  }
  for (const proposalFile of proposalFiles) {
    const proposal = await validateProposal(root, proposalFile, repository);
    if (!proposal.ok) problems.push(...proposal.errors);
  }

  let registry;
  try {
    registry = createSchemaRegistry(root);
  } catch (error) {
    problems.push({
      code: "SCHEMA_VALIDATION_FAILED",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const taskWalk = await walkFiles(root, "fixtures/tasks");
  if (!taskWalk.ok) problems.push(...taskWalk.errors);
  const taskFiles = taskWalk.ok
    ? taskWalk.value.filter((file) => file.endsWith(".yaml") || file.endsWith(".yml"))
    : [];
  if (taskFiles.length === 0) {
    problems.push({ code: "HYDRATION_FIXTURE_MISSING", message: "No hydration task fixtures found" });
  }
  for (const taskFile of taskFiles) {
    const task = await readContained(root, taskFile);
    if (!task.ok) {
      problems.push(...task.errors);
      continue;
    }
    const parsed = parseYamlDocument<unknown>(task.value, taskFile);
    if (!parsed.ok) {
      problems.push(...parsed.errors);
      continue;
    }
    const validated = registry?.validateWithSchema<LoreTask>("task", parsed.value);
    if (!validated || !validated.ok) {
      if (validated && !validated.ok) problems.push(...validated.errors);
      continue;
    }
    const packet = normalizeHydrationPacketForSnapshot(
      hydrateTask(validated.value, repository),
    );
    const stem = path.basename(taskFile).replace(/\.ya?ml$/, "");
    const yamlPath = path.posix.join(".lore", "snapshots", `${stem}.context.yaml`);
    const markdownPath = path.posix.join(".lore", "snapshots", `${stem}.context.md`);
    const yamlSnapshot = await readContained(root, yamlPath);
    if (!yamlSnapshot.ok) problems.push(...yamlSnapshot.errors);
    else if (yamlSnapshot.value !== stableYaml(packet)) {
      problems.push({ code: "HYDRATION_SNAPSHOT_STALE", message: `Stale ${yamlPath}` });
    }
    const markdownSnapshot = await readContained(root, markdownPath);
    if (!markdownSnapshot.ok) problems.push(...markdownSnapshot.errors);
    else if (markdownSnapshot.value !== hydrationMarkdown(packet)) {
      problems.push({ code: "HYDRATION_SNAPSHOT_STALE", message: `Stale ${markdownPath}` });
    }
  }

  for (const record of repository.records) {
    if (record.provenance.source === "proposal") {
      if (!record.provenance.transaction) {
        problems.push({
          code: "HISTORY_PROVENANCE_MISSING",
          message: `Proposal record ${record.id}@${record.revision} has no transaction ID`,
        });
      } else {
        const receiptPath = path.posix.join(
          repository.manifest.paths.transactions,
          `${record.provenance.transaction}.yaml`,
        );
        const receipt = await readContained(root, receiptPath);
        if (!receipt.ok) {
          problems.push({
            code: "HISTORY_RECEIPT_MISSING",
            message: `Missing receipt for ${record.id}@${record.revision}`,
          });
        }
      }
    }
  }

  if (problems.length > 0) return fail(...problems);
  return ok({
    manifest: "passed",
    extraction: "passed",
    records: "passed",
    evidence: "passed",
    skill: "passed",
    proposals: "passed",
    projections: "passed",
    hydration: "passed",
    history: "passed",
    determinism: "passed",
  });
}
