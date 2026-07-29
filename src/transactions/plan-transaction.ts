import path from "node:path";
import { ERROR_CODES, fail, ok } from "../domain/errors.js";
import { recordReference } from "../domain/references.js";
import type {
  LoreProposal,
  SemanticRecord,
  TransactionPlan,
  ValidatedRepository,
  ValidationProblem,
  ValidationResult,
} from "../domain/types.js";
import { validateEvidence } from "../evidence/validate-evidence.js";
import { createGitClient } from "../git/git-client.js";
import { projectRepository } from "../projection/project.js";
import { validateRecordSet } from "../records/validate-records.js";
import { transactionId } from "./receipt.js";

function isGeneratedEvidence(record: SemanticRecord, repository: ValidatedRepository): boolean {
  const generated = repository.manifest.paths.generated_docs.replace(/\\/g, "/").replace(/\/$/, "");
  return record.evidence.length > 0 && record.evidence.every((evidence) => {
    const evidencePath = evidence.path.replace(/\\/g, "/");
    return evidencePath === "README.md" || evidencePath.startsWith(`${generated}/`);
  });
}

export async function planTransaction(
  root: string,
  proposal: LoreProposal,
  repository: ValidatedRepository,
): Promise<ValidationResult<TransactionPlan>> {
  if (repository.revision !== proposal.base_revision) {
    return fail({
      code: ERROR_CODES.STALE_BASE_REVISION,
      message: "Proposal base revision is not current HEAD",
    });
  }

  const txId = transactionId(proposal);
  const latest = new Map<string, SemanticRecord>();
  for (const record of repository.records) {
    const previous = latest.get(record.id);
    if (!previous || previous.revision < record.revision) latest.set(record.id, record);
  }

  const recordsToCreate: TransactionPlan["recordsToCreate"] = [];
  for (const operation of proposal.operations) {
    let record: SemanticRecord;
    if (operation.operation === "append_record") {
      record = {
        ...operation.record,
        provenance: {
          ...operation.record.provenance,
          source: "proposal",
          transaction: txId,
          producer: proposal.producer?.name ?? operation.record.provenance.producer ?? "maintainer",
        },
      };
    } else {
      const prior = latest.get(operation.record_id);
      if (!prior) {
        return fail({
          code: "MISSING_SUPERSESSION_TARGET",
          message: `Missing record ${operation.record_id}`,
        });
      }
      if (prior.status !== operation.from) {
        return fail({
          code: "STATUS_MISMATCH",
          message: `Expected ${operation.from} for ${operation.record_id}`,
        });
      }
      record = {
        ...prior,
        revision: prior.revision + 1,
        status: operation.to,
        evidence: operation.evidence,
        supersedes: recordReference(repository.manifest.repository.id, prior),
        provenance: {
          source: "proposal",
          transaction: txId,
          producer: proposal.producer?.name ?? "maintainer",
        },
      };
    }

    recordsToCreate.push({
      path: path.posix.join(
        repository.manifest.paths.records,
        record.kind,
        record.id,
        `${record.revision}.yaml`,
      ),
      record,
    });
    latest.set(record.id, record);
  }

  const allRecords = [...repository.records, ...recordsToCreate.map(({ record }) => record)];
  const recordValidation = validateRecordSet(allRecords, repository.manifest.repository.id);
  if (!recordValidation.ok) return recordValidation as ValidationResult<TransactionPlan>;

  const problems: ValidationProblem[] = [];
  const git = createGitClient(root);
  for (const { record } of recordsToCreate) {
    if (isGeneratedEvidence(record, repository)) {
      problems.push({
        code: "GENERATED_EVIDENCE_ONLY",
        message: `Record ${record.id}@${record.revision} uses generated output as its only evidence`,
        record: record.id,
      });
      continue;
    }
    const evidence = await validateEvidence(root, record.evidence, git);
    if (!evidence.ok) problems.push(...evidence.errors);
  }
  if (problems.length > 0) return fail(...problems);

  const candidate: ValidatedRepository = {
    ...repository,
    records: allRecords,
  };
  const outputs = await projectRepository(candidate);
  if (!outputs.ok) return outputs as ValidationResult<TransactionPlan>;

  return ok({
    proposal,
    recordsToCreate,
    transactionReceiptPath: path.posix.join(
      repository.manifest.paths.transactions,
      `${txId}.yaml`,
    ),
    generatedOutputs: outputs.value,
  });
}
