import { fail, ok } from "../domain/errors.js";
import { parseRecordReference, recordReference } from "../domain/references.js";
import type {
  CausalExplanationEdge,
  RecordExplanation,
  RelationshipPayload,
  SemanticRecord,
  TransactionReceipt,
  ValidatedRepository,
  ValidationResult,
} from "../domain/types.js";

function receiptForRecord(
  receipts: TransactionReceipt[],
  kind: string,
  id: string,
  revision: number,
): string | null {
  const suffix = `/${kind}/${id}/${revision}.yaml`;
  return (
    receipts.find((receipt) =>
      receipt.records.some(
        (recordPath) => recordPath === `${kind}/${id}/${revision}.yaml` || recordPath.endsWith(suffix),
      ),
    )?.transaction_id ?? null
  );
}

function causalHistory(
  reference: string,
  repository: ValidatedRepository,
): { causal_ancestors: string[]; causal_relationships: CausalExplanationEdge[] } {
  const activeRelationships = repository.records
    .filter(
      (record) =>
        record.kind === "relationship" &&
        repository.effectiveStatus.get(
          recordReference(repository.manifest.repository.id, record),
        ) !== "superseded",
    )
    .sort((left, right) => left.id.localeCompare(right.id));
  const incoming = new Map<string, SemanticRecord[]>();
  for (const relationship of activeRelationships) {
    const payload = relationship.payload as unknown as RelationshipPayload;
    const edges = incoming.get(payload.to) ?? [];
    edges.push(relationship);
    incoming.set(payload.to, edges);
  }

  const ancestors: string[] = [];
  const relationships: CausalExplanationEdge[] = [];
  const seenAncestors = new Set<string>();
  const seenRelationships = new Set<string>();
  const visit = (target: string): void => {
    for (const relationship of incoming.get(target) ?? []) {
      const payload = relationship.payload as unknown as RelationshipPayload;
      const relationshipReference = recordReference(
        repository.manifest.repository.id,
        relationship,
      );
      if (!seenRelationships.has(relationshipReference)) {
        seenRelationships.add(relationshipReference);
        relationships.push({
          relationship: relationshipReference,
          from: payload.from,
          to: payload.to,
          relation: payload.relation,
          rationale: payload.rationale,
        });
      }
      if (!seenAncestors.has(payload.from)) {
        seenAncestors.add(payload.from);
        ancestors.push(payload.from);
        visit(payload.from);
      }
    }
  };
  visit(reference);
  return { causal_ancestors: ancestors, causal_relationships: relationships };
}

export function explainRecord(
  reference: string,
  repository: ValidatedRepository,
  transactions: TransactionReceipt[],
  includeWhy = false,
): ValidationResult<RecordExplanation> {
  let parsed;
  try {
    parsed = parseRecordReference(reference);
  } catch (error) {
    return fail({
      code: "INVALID_RECORD_REFERENCE",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const record = repository.records.find(
    (candidate) =>
      candidate.id === parsed.id &&
      candidate.kind === parsed.kind &&
      candidate.revision === parsed.revision,
  );
  if (!record) {
    return fail({ code: "RECORD_NOT_FOUND", message: `Record not found: ${reference}` });
  }

  const successors = repository.records
    .filter((candidate) => candidate.supersedes === reference)
    .map((candidate) => recordReference(repository.manifest.repository.id, candidate))
    .sort();

  const predecessors: string[] = [];
  let current = record;
  while (current.supersedes) {
    predecessors.unshift(current.supersedes);
    const priorReference = parseRecordReference(current.supersedes);
    const prior = repository.records.find(
      (candidate) =>
        candidate.id === priorReference.id &&
        candidate.revision === priorReference.revision &&
        candidate.kind === priorReference.kind,
    );
    if (!prior) break;
    current = prior;
  }

  const related = repository.records
    .filter(
      (candidate) =>
        candidate !== record &&
        candidate.scope.components.some((component) => record.scope.components.includes(component)),
    )
    .map((candidate) => recordReference(repository.manifest.repository.id, candidate))
    .sort();

  const introducingTransaction =
    record.provenance.transaction ??
    receiptForRecord(transactions, record.kind, record.id, record.revision);
  const successorRecord = repository.records
    .filter((candidate) => candidate.supersedes === reference)
    .sort((left, right) => left.revision - right.revision)[0];
  const supersedingTransaction = successorRecord
    ? successorRecord.provenance.transaction ??
      receiptForRecord(
        transactions,
        successorRecord.kind,
        successorRecord.id,
        successorRecord.revision,
      )
    : null;

  return ok({
    reference,
    record,
    current_status: repository.effectiveStatus.get(reference) ?? record.status,
    predecessors,
    successors,
    related,
    introducing_transaction: introducingTransaction,
    superseding_transaction: supersedingTransaction,
    ...(includeWhy ? causalHistory(reference, repository) : {}),
  });
}
