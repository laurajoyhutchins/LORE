import { ERROR_CODES, fail, ok } from "../domain/errors.js";
import { recordReference } from "../domain/references.js";
import type {
  RecordStatus,
  SemanticRecord,
  ValidationProblem,
  ValidationResult,
} from "../domain/types.js";

export function validateRecordSet(
  records: SemanticRecord[],
  repositoryId: string,
): ValidationResult<SemanticRecord[]> {
  const problems: ValidationProblem[] = [];
  const byReference = new Map<string, SemanticRecord>();
  const byIdentity = new Map<string, SemanticRecord[]>();

  for (const record of records) {
    const reference = recordReference(repositoryId, record);
    if (byReference.has(reference)) {
      problems.push({
        code: ERROR_CODES.SEMANTIC_INVARIANT_FAILED,
        message: `Duplicate record revision ${reference}`,
        record: reference,
      });
    }
    byReference.set(reference, record);

    if (record.scope.repository !== repositoryId) {
      problems.push({
        code: ERROR_CODES.SEMANTIC_INVARIANT_FAILED,
        message: `Wrong repository scope for ${reference}`,
        record: reference,
      });
    }

    const identity = `${record.kind}/${record.id}`;
    const revisions = byIdentity.get(identity) ?? [];
    revisions.push(record);
    byIdentity.set(identity, revisions);
  }

  for (const [identity, revisions] of byIdentity) {
    revisions.sort((left, right) => left.revision - right.revision);
    for (let index = 0; index < revisions.length; index += 1) {
      const record = revisions[index] as SemanticRecord;
      if (record.revision !== index + 1) {
        problems.push({
          code: ERROR_CODES.SEMANTIC_INVARIANT_FAILED,
          message: `Non-monotonic revision for ${identity}`,
          record: identity,
        });
      }
      if (record.revision === 1 && record.supersedes !== null) {
        problems.push({
          code: ERROR_CODES.SEMANTIC_INVARIANT_FAILED,
          message: `First revision may not supersede another record: ${identity}`,
          record: identity,
        });
      }
      if (record.revision > 1) {
        const prior = revisions[index - 1];
        const expected = prior ? recordReference(repositoryId, prior) : null;
        if (record.supersedes !== expected) {
          problems.push({
            code: ERROR_CODES.SEMANTIC_INVARIANT_FAILED,
            message: `Revision ${record.revision} of ${identity} must supersede ${expected ?? "its prior revision"}`,
            record: identity,
          });
        }
      }
      if (record.supersedes && !byReference.has(record.supersedes)) {
        problems.push({
          code: ERROR_CODES.SEMANTIC_INVARIANT_FAILED,
          message: `Missing supersession target ${record.supersedes}`,
          record: identity,
        });
      }
    }
  }

  const visiting = new Set<string>();
  const complete = new Set<string>();
  const visit = (reference: string): void => {
    if (visiting.has(reference)) {
      problems.push({
        code: ERROR_CODES.SEMANTIC_INVARIANT_FAILED,
        message: `Supersession cycle at ${reference}`,
        record: reference,
      });
      return;
    }
    if (complete.has(reference)) return;
    visiting.add(reference);
    const supersedes = byReference.get(reference)?.supersedes;
    if (supersedes) visit(supersedes);
    visiting.delete(reference);
    complete.add(reference);
  };
  for (const reference of byReference.keys()) visit(reference);

  const components = new Set(records.filter(({ kind }) => kind === "component").map(({ id }) => id));
  for (const record of records) {
    for (const component of record.scope.components) {
      if (!components.has(component)) {
        problems.push({
          code: ERROR_CODES.SEMANTIC_INVARIANT_FAILED,
          message: `Missing component ${component}`,
          record: record.id,
        });
      }
    }
  }

  const activeDecisions = records.filter(({ kind, status }) => kind === "decision" && status === "active");
  const exclusivity = new Map<string, SemanticRecord>();
  for (const decision of activeDecisions) {
    const key = decision.payload.exclusivity_key;
    if (typeof key !== "string" || key.length === 0) continue;
    const previous = exclusivity.get(key);
    if (previous) {
      problems.push({
        code: ERROR_CODES.SEMANTIC_INVARIANT_FAILED,
        message: `Active decisions ${previous.id} and ${decision.id} share exclusivity key ${key}`,
        record: decision.id,
      });
    } else {
      exclusivity.set(key, decision);
    }
  }

  return problems.length > 0 ? fail(...problems) : ok(records);
}

export function deriveEffectiveStatuses(
  records: SemanticRecord[],
  repositoryId: string,
): Map<string, RecordStatus> {
  const statuses = new Map(
    records.map((record) => [recordReference(repositoryId, record), record.status]),
  );
  for (const record of records) {
    if (record.supersedes) statuses.set(record.supersedes, "superseded");
  }
  return statuses;
}
