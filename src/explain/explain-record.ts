import { fail, ok } from "../domain/errors.js";
import { parseRecordReference, recordReference } from "../domain/references.js";
import type {
  RecordExplanation,
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

export function explainRecord(
  reference: string,
  repository: ValidatedRepository,
  transactions: TransactionReceipt[],
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
  });
}
