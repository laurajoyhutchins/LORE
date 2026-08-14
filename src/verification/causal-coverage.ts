import { recordReference } from "../domain/references.js";
import type { RelationshipPayload, SemanticRecord, ValidatedRepository, ValidationProblem } from "../domain/types.js";

const ref = (repository: ValidatedRepository, record: SemanticRecord) => recordReference(repository.manifest.repository.id, record);
const active = (repository: ValidatedRepository, record: SemanticRecord) => (repository.effectiveStatus.get(ref(repository, record)) ?? record.status) === "active";

export function verifyCausalCoverage(repository: ValidatedRepository): ValidationProblem[] {
  const roots = repository.manifest.causality?.roots;
  if (!roots) return [];
  const records = repository.records.filter((record) => record.kind !== "relationship" && active(repository, record));
  const activeRefs = new Set(records.map((record) => ref(repository, record)));
  const problems: ValidationProblem[] = [];
  for (const root of roots) {
    if (!activeRefs.has(root)) problems.push({ code: "CAUSAL_ROOT_INVALID", message: `Causal root is not an active semantic record: ${root}`, record: root });
  }
  const adjacency = new Map<string, string[]>();
  for (const relationship of repository.records) {
    if (relationship.kind !== "relationship" || !active(repository, relationship)) continue;
    const payload = relationship.payload as unknown as RelationshipPayload;
    if (!activeRefs.has(payload.from) || !activeRefs.has(payload.to)) continue;
    const targets = adjacency.get(payload.from) ?? [];
    targets.push(payload.to);
    adjacency.set(payload.from, targets);
  }
  const reachable = new Set<string>();
  const visit = (value: string): void => {
    if (reachable.has(value) || !activeRefs.has(value)) return;
    reachable.add(value);
    for (const target of adjacency.get(value) ?? []) visit(target);
  };
  for (const root of roots) visit(root);
  for (const record of records) {
    const value = ref(repository, record);
    if (!reachable.has(value)) problems.push({ code: "CAUSAL_COVERAGE_MISSING", message: `Active semantic record is not reachable from a configured causal root: ${value}`, record: value });
  }
  return problems;
}
