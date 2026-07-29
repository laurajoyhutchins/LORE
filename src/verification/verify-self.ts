import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fail, ok } from "../domain/errors.js";
import type {
  LoreTask,
  ValidationProblem,
  ValidationResult,
} from "../domain/types.js";
import { extractRepository } from "../extraction/extract.js";
import { hydrateTask, hydrationMarkdown } from "../hydration/hydrate.js";
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

async function walkFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const files: string[] = [];
  for (const entry of entries) {
    const candidate = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walkFiles(candidate)));
    else if (entry.isFile()) files.push(candidate);
  }
  return files.sort();
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
    for (const [relativePath, expected] of extractionA.value.files) {
      const actual = await readFile(path.join(root, relativePath), "utf8").catch(() => null);
      if (actual !== expected) {
        problems.push({
          code: "GENERATED_OUTPUT_STALE",
          message: `Stale extracted facts: ${relativePath}`,
          location: relativePath,
        });
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
      const actual = await readFile(path.join(root, relativePath), "utf8").catch(() => null);
      if (actual !== expected) {
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
  const forbidden = /\b(Seshat|cartridge|heartbeat|OpenAI|Anthropic|Claude|ChatGPT|Codex|Hatchable)\b/i;
  for (const relativePath of requiredSkillFiles) {
    const text = await readFile(path.join(root, relativePath), "utf8").catch(() => null);
    if (text === null) {
      problems.push({ code: "SKILL_MISSING", message: `Missing ${relativePath}` });
    } else if (forbidden.test(text)) {
      problems.push({
        code: "SKILL_NOT_NEUTRAL",
        message: `Provider or orchestration dependency found in ${relativePath}`,
      });
    }
  }

  const proposalFiles = (await walkFiles(path.join(root, repository.manifest.paths.proposals))).filter(
    (file) => file.endsWith(".yaml") || file.endsWith(".yml"),
  );
  if (proposalFiles.length === 0) {
    problems.push({ code: "PROPOSAL_FIXTURE_MISSING", message: "No proposal fixtures found" });
  }
  for (const proposalFile of proposalFiles) {
    const relative = path.relative(root, proposalFile).replace(/\\/g, "/");
    const proposal = await validateProposal(root, relative, repository);
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
  const taskFiles = (await walkFiles(path.join(root, "fixtures", "tasks"))).filter(
    (file) => file.endsWith(".yaml") || file.endsWith(".yml"),
  );
  if (taskFiles.length === 0) {
    problems.push({ code: "HYDRATION_FIXTURE_MISSING", message: "No hydration task fixtures found" });
  }
  for (const taskFile of taskFiles) {
    const relative = path.relative(root, taskFile).replace(/\\/g, "/");
    const parsed = parseYamlDocument<unknown>(await readFile(taskFile, "utf8"), relative);
    if (!parsed.ok) {
      problems.push(...parsed.errors);
      continue;
    }
    const validated = registry?.validateWithSchema<LoreTask>("task", parsed.value);
    if (!validated || !validated.ok) {
      if (validated && !validated.ok) problems.push(...validated.errors);
      continue;
    }
    const packet = hydrateTask(validated.value, repository);
    const stem = path.basename(taskFile).replace(/\.ya?ml$/, "");
    const yamlPath = path.join(root, ".lore", "snapshots", `${stem}.context.yaml`);
    const markdownPath = path.join(root, ".lore", "snapshots", `${stem}.context.md`);
    if ((await readFile(yamlPath, "utf8").catch(() => null)) !== stableYaml(packet)) {
      problems.push({ code: "HYDRATION_SNAPSHOT_STALE", message: `Stale ${yamlPath}` });
    }
    if ((await readFile(markdownPath, "utf8").catch(() => null)) !== hydrationMarkdown(packet)) {
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
        const receiptPath = path.join(
          root,
          repository.manifest.paths.transactions,
          `${record.provenance.transaction}.yaml`,
        );
        if ((await readFile(receiptPath, "utf8").catch(() => null)) === null) {
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
