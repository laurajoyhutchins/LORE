import { expect, it } from "vitest";
import type { SemanticRecord, ValidatedRepository } from "../../../src/domain/types.js";
import { explainRecord } from "../../../src/explain/explain-record.js";

const revision = "0123456789abcdef0123456789abcdef01234567";
const reference = (kind: string, id: string) => `lore://example/${kind}/${id}@1`;

function record(kind: SemanticRecord["kind"], id: string): SemanticRecord {
  return {
    schema_version: 1,
    id,
    kind,
    revision: 1,
    status: "active",
    title: id,
    summary: `${id} summary`,
    scope: { repository: "example", components: [] },
    evidence: [{ revision, path: "docs/design.md" }],
    disclosure: { audiences: [], tags: [], weight: 1 },
    provenance: { source: "bootstrap", transaction: null, producer: "test" },
    supersedes: null,
    payload: {},
  };
}

it("traces accepted causal ancestors when requested", () => {
  const finding = record("finding", "finding.first");
  const decision = record("decision", "decision.second");
  const constraint = record("constraint", "constraint.third");
  const first = record("relationship", "relationship.first-second");
  first.payload = {
    from: reference("finding", "finding.first"),
    to: reference("decision", "decision.second"),
    relation: "leads_to",
    rationale: "Observed first.",
  };
  const second = record("relationship", "relationship.second-third");
  second.payload = {
    from: reference("decision", "decision.second"),
    to: reference("constraint", "constraint.third"),
    relation: "requires",
    rationale: "Decision requires constraint.",
  };
  const repository = {
    root: ".",
    revision,
    records: [finding, decision, constraint, first, second],
    effectiveStatus: new Map(),
    extracted: {},
    manifest: {
      schema_version: 1,
      repository: { id: "example", name: "Example", root: "." },
      paths: { extracted: ".lore/extracted", records: ".lore/records", proposals: ".lore/proposals", transactions: ".lore/transactions", generated_docs: "docs/generated", skills: "skills" },
      extractors: [],
      projections: [],
      maintenance: { skill: "skills/x", proposal_schema: "schemas/x" },
      hydration: { max_records: 20, max_characters: 40000 },
    },
  } as ValidatedRepository;

  const explain = explainRecord as unknown as (
    value: string,
    repo: ValidatedRepository,
    receipts: [],
    includeWhy: boolean,
  ) => ReturnType<typeof explainRecord>;
  const result = explain(reference("constraint", "constraint.third"), repository, [], true);

  expect(result.ok).toBe(true);
  if (!result.ok) return;
  expect((result.value as unknown as { causal_ancestors: string[] }).causal_ancestors).toEqual([
    reference("decision", "decision.second"),
    reference("finding", "finding.first"),
  ]);
});
