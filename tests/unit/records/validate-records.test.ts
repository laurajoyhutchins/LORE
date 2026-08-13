import { expect, it } from "vitest";
import type { SemanticRecord } from "../../../src/domain/types.js";
import { validateRecordSet } from "../../../src/records/validate-records.js";

const revision = "0123456789abcdef0123456789abcdef01234567";
const ref = (kind: string, id: string) => `lore://example/${kind}/${id}@1`;

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
    disclosure: { audiences: ["maintainer"], tags: [kind], weight: 90 },
    provenance: { source: "bootstrap", transaction: null, producer: "human-reviewed" },
    supersedes: null,
    payload: {},
  };
}

function relationship(id: string, from: string, to: string): SemanticRecord {
  return {
    ...record("relationship", id),
    payload: {
      from,
      to,
      relation: "leads_to",
      rationale: "The source state motivates the target state.",
    },
  };
}

it("rejects a causal relationship whose endpoint is missing", () => {
  const source = record("decision", "decision.source");
  const edge = relationship("relationship.source-to-missing", ref("decision", "decision.source"), ref("decision", "decision.missing"));
  const result = validateRecordSet([source, edge], "example");
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors.map((error) => error.message).join("\n")).toContain("Missing relationship endpoint");
});

it("rejects a causal relationship from a record to itself", () => {
  const source = record("decision", "decision.source");
  const sourceRef = ref("decision", "decision.source");
  const result = validateRecordSet([source, relationship("relationship.source-self", sourceRef, sourceRef)], "example");
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors.map((error) => error.message).join("\n")).toContain("Relationship may not link a record to itself");
});

it("rejects a cycle in active causal relationships", () => {
  const first = record("decision", "decision.first");
  const second = record("decision", "decision.second");
  const result = validateRecordSet([
    first,
    second,
    relationship("relationship.first-to-second", ref("decision", "decision.first"), ref("decision", "decision.second")),
    relationship("relationship.second-to-first", ref("decision", "decision.second"), ref("decision", "decision.first")),
  ], "example");
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors.map((error) => error.message).join("\n")).toContain("Causal relationship cycle");
});

it("accepts an acyclic causal relationship chain", () => {
  const first = record("finding", "finding.first");
  const second = record("decision", "decision.second");
  const third = record("constraint", "constraint.third");
  expect(validateRecordSet([
    first,
    second,
    third,
    relationship("relationship.first-to-second", ref("finding", "finding.first"), ref("decision", "decision.second")),
    relationship("relationship.second-to-third", ref("decision", "decision.second"), ref("constraint", "constraint.third")),
  ], "example").ok).toBe(true);
});
