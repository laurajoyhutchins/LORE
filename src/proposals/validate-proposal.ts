import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ERROR_CODES, fail, ok } from "../domain/errors.js";
import type {
  LoreProposal,
  SemanticRecord,
  ValidatedRepository,
  ValidationProblem,
  ValidationResult,
} from "../domain/types.js";
import { createGitClient } from "../git/git-client.js";
import { validateRecordSet } from "../records/validate-records.js";
import { createSchemaRegistry } from "../schemas/schema-registry.js";
import { parseYamlDocument } from "../serialization/yaml.js";

const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

export async function validateProposal(
  root: string,
  proposalPath: string,
  repository: ValidatedRepository,
): Promise<ValidationResult<LoreProposal>> {
  let content: string;
  try {
    content = await readFile(path.resolve(root, proposalPath), "utf8");
  } catch (error) {
    return fail({
      code: ERROR_CODES.INVALID_YAML,
      message: error instanceof Error ? error.message : String(error),
      location: proposalPath,
    });
  }

  const parsed = parseYamlDocument<unknown>(content, proposalPath);
  if (!parsed.ok) return parsed as ValidationResult<LoreProposal>;

  let registry;
  try {
    registry = createSchemaRegistry(root);
  } catch (error) {
    return fail({
      code: ERROR_CODES.SCHEMA_VALIDATION_FAILED,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const envelope = registry.validateWithSchema<LoreProposal>("proposal", parsed.value);
  if (!envelope.ok) return envelope;
  const proposal = envelope.value;

  if (!DIGEST_PATTERN.test(proposal.skill.digest)) {
    return fail({
      code: "SKILL_DIGEST_MISMATCH",
      message: "Skill digest must use sha256:<64 lowercase hexadecimal characters>",
    });
  }

  if (repository.manifest && proposal.skill.path !== repository.manifest.maintenance.skill) {
    return fail({
      code: "SKILL_PATH_MISMATCH",
      message: `Proposal skill must be ${repository.manifest.maintenance.skill}`,
    });
  }

  const problems: ValidationProblem[] = [];
  const appended: SemanticRecord[] = [];
  for (const operation of proposal.operations) {
    if (operation.operation !== "append_record") continue;
    const record = registry.validateWithSchema<SemanticRecord>("record", operation.record);
    if (!record.ok) problems.push(...record.errors);
    else appended.push(record.value);
  }
  if (problems.length > 0) return fail(...problems);

  const git = createGitClient(root);
  let skill: string;
  try {
    skill = await git.readFileAtRevision(proposal.base_revision, proposal.skill.path);
  } catch {
    return fail({
      code: "SKILL_DIGEST_MISMATCH",
      message: "Skill unavailable at proposal base revision",
    });
  }
  const digest = `sha256:${createHash("sha256").update(skill).digest("hex")}`;
  if (digest !== proposal.skill.digest) {
    return fail({
      code: "SKILL_DIGEST_MISMATCH",
      message: "Skill digest does not match proposal base revision",
    });
  }

  if (repository.records) {
    const accepted = new Set(
      repository.records.map((record) => `${record.kind}/${record.id}@${record.revision}`),
    );
    for (const record of appended) {
      if (accepted.has(`${record.kind}/${record.id}@${record.revision}`)) {
        problems.push({
          code: "ACCEPTED_HISTORY_MUTATION",
          message: `Proposal attempts to replace accepted record ${record.kind}/${record.id}@${record.revision}`,
        });
      }
    }

    if (proposal.base_revision === repository.revision) {
      const candidate = [...repository.records, ...appended];
      const valid = validateRecordSet(candidate, repository.manifest.repository.id);
      if (!valid.ok) problems.push(...valid.errors);
    }
  }

  return problems.length > 0 ? fail(...problems) : ok(proposal);
}
