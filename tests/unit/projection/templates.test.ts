import { expect, it } from "vitest";
import type {
  RecordKind,
  SemanticRecord,
  ValidatedRepository,
} from "../../../src/domain/types.js";
import {
  renderAdoptionTutorial,
  renderAuthorityAndFileOwnership,
  renderCliReference,
  renderDataModelReference,
  renderMaintenanceWorkflow,
  renderProposalReview,
  renderReadme,
  renderRepositoryCard,
  renderTrustModel,
} from "../../../src/projection/templates.js";

function record(
  kind: RecordKind,
  id: string,
  title: string,
  summary: string,
): SemanticRecord {
  return {
    schema_version: 1,
    id,
    kind,
    revision: 1,
    status: "active",
    title,
    summary,
    scope: { repository: "example", components: [] },
    evidence: [
      {
        revision: "0123456789abcdef0123456789abcdef01234567",
        path: "docs/design.md",
      },
    ],
    disclosure: { audiences: ["maintainer"], tags: [kind], weight: 90 },
    provenance: {
      source: "bootstrap",
      transaction: null,
      producer: "human-reviewed",
    },
    supersedes: null,
    payload: {},
  };
}

function repository(): ValidatedRepository {
  return {
    root: ".",
    revision: "0123456789abcdef0123456789abcdef01234567",
    records: [],
    effectiveStatus: new Map(),
    extracted: {},
    manifest: {
      schema_version: 1,
      repository: { id: "example", name: "Example", root: "." },
      paths: {
        extracted: ".lore/extracted",
        records: ".lore/records",
        proposals: ".lore/proposals",
        transactions: ".lore/transactions",
        generated_docs: "docs/generated",
        skills: "skills",
      },
      extractors: [],
      projections: [],
      maintenance: {
        skill: "skills/maintain-repository-documentation/SKILL.md",
        proposal_schema: "schemas/proposal.schema.json",
      },
      hydration: { max_records: 20, max_characters: 40000 },
    },
  };
}

it("documents the installed CLI-only package", () => {
  const readme = renderReadme(repository());

  expect(readme).toContain(
    "npm install --save-dev @laurajoyhutchins/lore",
  );
  expect(readme).toContain("npm exec -- lore --help");
  expect(readme).toContain("npm exec -- lore version --json");
  expect(readme).toContain("CLI-only");
  expect(readme).toContain("## Source development");
  expect(readme).toContain("Corepack");
  expect(readme).toContain("pnpm 10.14.0");
  expect(readme).toContain("docs/generated/tutorials/adopt-lore.md");
  expect(readme).not.toContain('keeps `"private": true`');
  expect(readme.indexOf("## Install")).toBeLessThan(
    readme.indexOf("## Source development"),
  );
});

it("keeps the checked-in repository card independent of HEAD", () => {
  const example = repository();

  const card = renderRepositoryCard(example);

  expect(card).toContain("- ID: `example`");
  expect(card).toContain("- Records: 0");
  expect(card).not.toContain(example.revision);
});

it("projects product documentation from accepted records and repository contracts", () => {
  const example = repository();
  example.records = [
    record("repository", "repository.example", "Example", "Example purpose."),
    record("component", "component.validation", "Validation", "Validates evidence."),
    record("decision", "decision.git", "Git-backed storage", "Git is durable storage."),
    record("constraint", "constraint.append-only", "Append-only history", "Accepted history is immutable."),
    record("finding", "finding.bootstrap", "Bootstrap limitation", "The initial kernel is reviewed."),
    record("procedure", "procedure.maintain", "Maintain knowledge", "Use context and proposals."),
  ];

  expect(renderTrustModel(example)).toContain("Git-backed storage");
  expect(renderTrustModel(example)).toContain("Append-only history");
  expect(renderAuthorityAndFileOwnership(example)).toContain(".lore/transactions/");
  expect(renderMaintenanceWorkflow(example)).toContain("Maintain knowledge");
  expect(renderProposalReview(example)).toContain("no_documentation_change");
});

it("projects adoption, CLI, and data-model references deterministically", () => {
  const example = repository();

  expect(renderAdoptionTutorial(example)).toContain("lore init --id example-repository");
  expect(renderCliReference(example)).toContain("### `validate-proposal`");
  expect(renderCliReference(example)).toContain("### `verify-self`");
  expect(renderDataModelReference(example)).toContain("| `procedure` |");
  expect(renderDataModelReference(example)).toContain("lore-maintainer-context/v1");
});
