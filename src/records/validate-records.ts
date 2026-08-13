import { ERROR_CODES, fail, ok } from "../domain/errors.js";
import { parseRecordReference, recordReference } from "../domain/references.js";
import type {
  CausalRelation,
  RecordStatus,
  RelationshipPayload,
  SemanticRecord,
  ValidationProblem,
  ValidationResult,
} from "../domain/types.js";

const CAUSAL_RELATIONS = new Set<CausalRelation>([
  "leads_to",
  "requires",
  "enables",
  "chosen",
  "rejected",
]);

function readRelationshipPayload(
  record: SemanticRecord,
  problems: ValidationProblem[],
): RelationshipPayload | null {
  const { from, to, relation, rationale } = record.payload;
  if (
    typeof from !== "string" ||
    typeof to !== "string" ||
    typeof relation !== "string" ||
    !CAUSAL_RELATIONS.has(relation as CausalRelation) ||
    typeof rationale !== "string" ||
    rationale.length === 0
  ) {
    problems.push({
      code: ERROR_CODES.SEMANTIC_INVARIANT_FAILED,
      message: `Invalid relationship payload for ${record.id}`,
      record: record.id,
    });
    return null;
  }
  return { from, to, relation: relation as CausalRelation, rationale };
}

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

  const supersededReferences = new Set(
    records.map(({ supersedes }) => supersedes).filter((value): value is string => value !== null),
  );
  const causalEdges = new Map<string, string[]>();
  for (const relationship of records.filter(({ kind }) => kind === "relationship")) {
    const payload = readRelationshipPayload(relationship, problems);
    if (!payload) continue;

    let parsedFrom;
    let parsedTo;
    try {
      parsedFrom = parseRecordReference(payload.from);
      parsedTo = parseRecordReference(payload.to);
    } catch {
      problems.push({
        code: ERROR_CODES.SEMANTIC_INVARIANT_FAILED,
        message: `Invalid relationship endpoint for ${relationship.id}`,
        record: relationship.id,
      });
      continue;
    }

    if (parsedFrom.repositoryId !== repositoryId || parsedTo.repositoryId !== repositoryId) {
      problems.push({
        code: ERROR_CODES.SEMANTIC_INVARIANT_FAILED,
        message: `Relationship endpoint outside repository ${repositoryId}`,
        record: relationship.id,
      });
      continue;
    }
    if (parsedFrom.kind === "relationship" || parsedTo.kind === "relationship") {
      problems.push({
        code: ERROR_CODES.SEMANTIC_INVARIANT_FAILED,
        message: "Relationship endpoints must reference semantic records, not relationship records",
        record: relationship.id,
      });
      continue;
    }
    if (payload.from === payload.to) {
      problems.push({
        code: ERROR_CODES.SEMANTIC_INVARIANT_FAILED,
        message: "Relationship may not link a record to itself",
        record: relationship.id,
      });
      continue;
    }

    const missing = [payload.from, payload.to].filter((reference) => !byReference.has(reference));
    if (missing.length > 0) {
      for (const reference of missing) {
        problems.push({
          code: ERROR_CODES.SEMANTIC_INVARIANT_FAILED,
          message: `Missing relationship endpoint ${reference}`,
          record: relationship.id,
        });
      }
      continue;
    }

    const relationshipReference = recordReference(repositoryId, relationship);
    if (relationship.status === "active" && !supersededReferences.has(relationshipReference)) {
      const targets = causalEdges.get(payload.from) ?? [];
      targets.push(payload.to);
      causalEdges.set(payload.from, targets);
    }
  }

  const causalVisiting = new Set<string>();
  const causalComplete = new Set<string>();
  const visitCausal = (reference: string): void => {
    if (causalVisiting.has(reference)) {
      problems.push({
        code: ERROR_CODES.SEMANTIC_INVARIANT_FAILED,
        message: `Causal relationship cycle at ${reference}`,
        record: reference,
      });
      return;
    }
    if (causalComplete.has(reference)) return;
    causalVisiting.add(reference);
    for (const target of causalEdges.get(reference) ?? []) visitCausal(target);
    causalVisiting.delete(reference);
    causalComplete.add(reference);
  };
  for (const reference of causalEdges.keys()) visitCausal(reference);

  const activeDecisions = records.filter(
    (record) =>
      record.kind === "decision" &&
      record.status === "active" &&
      !supersededReferences.has(recordReference(repositoryId, record)),
  );
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
