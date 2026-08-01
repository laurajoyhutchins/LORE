import { readFile } from "node:fs/promises";
import path from "node:path";
import { loadManifest } from "../config/load-manifest.js";
import { ERROR_CODES, fail, ok } from "../domain/errors.js";
import type {
  ExtractedFacts,
  SemanticRecord,
  ValidatedRepository,
  ValidationProblem,
  ValidationResult,
} from "../domain/types.js";
import { validateEvidence } from "../evidence/validate-evidence.js";
import { requiredExtractionFiles } from "../extraction/extractor-configuration.js";
import {
  resolveExistingInsideRoot,
  resolvePotentialInsideRoot,
} from "../filesystem/repository-paths.js";
import { createGitClient } from "../git/git-client.js";
import { loadRecords } from "../records/load-records.js";
import { deriveEffectiveStatuses, validateRecordSet } from "../records/validate-records.js";
import { createSchemaRegistry } from "../schemas/schema-registry.js";
import { parseYamlDocument } from "../serialization/yaml.js";

function generatedOnlyEvidence(record: SemanticRecord, generatedDocs: string): boolean {
  const generatedRoot = generatedDocs.replace(/\\/g, "/").replace(/\/$/, "");
  return record.evidence.length > 0 && record.evidence.every(({ path: evidencePath }) => {
    const normalized = evidencePath.replace(/\\/g, "/");
    return normalized === "README.md" || normalized.startsWith(`${generatedRoot}/`);
  });
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

export async function validateRepository(
  root: string,
): Promise<ValidationResult<ValidatedRepository>> {
  const manifestResult = await loadManifest(root);
  if (!manifestResult.ok) return manifestResult;
  const manifest = manifestResult.value;
  const extractionRequirements = requiredExtractionFiles(manifest);
  if (!extractionRequirements.ok) return extractionRequirements;
  const problems: ValidationProblem[] = [];

  for (const candidate of [
    manifest.paths.extracted,
    manifest.paths.records,
    manifest.paths.proposals,
    manifest.paths.transactions,
    manifest.paths.generated_docs,
    manifest.paths.skills,
    manifest.maintenance.skill,
    manifest.maintenance.proposal_schema,
    ...manifest.projections.map(({ output }) => output),
  ]) {
    const resolved = await resolvePotentialInsideRoot(root, candidate);
    if (!resolved.ok) problems.push(...resolved.errors);
  }
  if (problems.length > 0) return fail(...problems);

  const recordsResult = await loadRecords(root, manifest);
  if (!recordsResult.ok) return recordsResult;
  const records = recordsResult.value;
  const semanticResult = validateRecordSet(records, manifest.repository.id);
  if (!semanticResult.ok) return semanticResult;

  for (const record of records) {
    if (generatedOnlyEvidence(record, manifest.paths.generated_docs)) {
      problems.push({
        code: "GENERATED_EVIDENCE_ONLY",
        message: `Record ${record.id}@${record.revision} uses generated output as its only evidence`,
        record: record.id,
      });
    }
  }

  const git = createGitClient(root);
  const evidenceResult = await validateEvidence(
    root,
    records.flatMap(({ evidence }) => evidence),
    git,
  );
  if (!evidenceResult.ok) problems.push(...evidenceResult.errors);

  let registry;
  try {
    registry = createSchemaRegistry(root);
  } catch (error) {
    return fail({
      code: ERROR_CODES.SCHEMA_VALIDATION_FAILED,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const extracted: ExtractedFacts = {};
  for (const { fileName, key } of extractionRequirements.value) {
    const relativePath = path.posix.join(manifest.paths.extracted, fileName);
    const extractedFile = await readContained(root, relativePath);
    if (!extractedFile.ok) {
      problems.push(
        ...extractedFile.errors.map((problem) => ({
          ...problem,
          code: problem.code === "PATH_NOT_FOUND" ? "EXTRACTED_FACTS_MISSING" : problem.code,
        })),
      );
      continue;
    }
    const parsed = parseYamlDocument<unknown>(extractedFile.value, relativePath);
    if (!parsed.ok) {
      problems.push(...parsed.errors);
      continue;
    }
    const schema = registry.validateWithSchema<Record<string, unknown>>(
      "extracted-facts",
      parsed.value,
    );
    if (!schema.ok) {
      problems.push(...schema.errors);
      continue;
    }
    if (key === "repository") extracted.repository = schema.value.repository;
    else if (key === "components") extracted.components = schema.value.components as unknown[];
    else if (key === "relationships") extracted.relationships = schema.value.relationships as unknown[];
    else extracted.tests = schema.value.tests as unknown[];
  }

  const [rootSchema, skillSchema, skill] = await Promise.all([
    readContained(root, "schemas/proposal.schema.json"),
    readContained(root, manifest.maintenance.proposal_schema),
    readContained(root, manifest.maintenance.skill),
  ]);
  for (const result of [rootSchema, skillSchema, skill]) {
    if (!result.ok) problems.push(...result.errors);
  }
  if (rootSchema.ok && skillSchema.ok && rootSchema.value !== skillSchema.value) {
    problems.push({
      code: ERROR_CODES.SKILL_SCHEMA_DRIFT,
      message: "Root and skill proposal schemas differ",
    });
  }

  if (problems.length > 0) return fail(...problems);

  return ok({
    root,
    manifest,
    revision: await git.head(),
    records,
    effectiveStatus: deriveEffectiveStatuses(records, manifest.repository.id),
    extracted,
  });
}
