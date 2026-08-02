import { execFile } from "node:child_process";
import { cp, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import type {
  LoreManifest,
  LoreProposal,
  SemanticRecord,
  ValidatedRepository,
} from "../../src/domain/types.js";
import { validateProposal } from "../../src/proposals/validate-proposal.js";
import { planTransaction } from "../../src/transactions/plan-transaction.js";
import { verifySelf } from "../../src/verification/verify-self.js";

const exec = promisify(execFile);

describe("remediation contracts", () => {
  it("does not report self-verification categories without checking required artifacts", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "lore-verify-"));
    const result = await verifySelf(root);
    expect(result.ok).toBe(false);
  });

  it("rejects a proposal that does not satisfy the proposal schema", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "lore-proposal-"));
    await mkdir(path.join(root, ".lore", "proposals"), { recursive: true });
    await writeFile(path.join(root, ".lore", "proposals", "bad.yaml"), "protocol: lore-proposal/v1\n");
    const result = await validateProposal(root, ".lore/proposals/bad.yaml", {} as ValidatedRepository);
    expect(result.ok).toBe(false);
  });

  it("projects candidate effective statuses when planning a transaction", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "lore-plan-"));
    const run = (args: string[]) => exec("git", args, { cwd: root });
    await run(["init"]);
    await run(["config", "user.name", "LORE Test"]);
    await run(["config", "user.email", "lore-test@example.invalid"]);
    await writeFile(path.join(root, "evidence.txt"), "candidate state evidence\n");
    await run(["add", "evidence.txt"]);
    await run(["commit", "-m", "fixture"]);
    const revision = (await run(["rev-parse", "HEAD"])).stdout.trim();

    const manifest: LoreManifest = {
      schema_version: 1,
      repository: { id: "fixture", name: "Fixture", root: "." },
      paths: {
        extracted: ".lore/extracted",
        records: ".lore/records",
        proposals: ".lore/proposals",
        transactions: ".lore/transactions",
        generated_docs: "docs/generated",
        skills: "skills",
      },
      extractors: [],
      projections: [
        {
          id: "component-catalog",
          output: "docs/generated/component-catalog.md",
        },
      ],
      maintenance: {
        skill: "skills/maintain-repository-documentation/SKILL.md",
        proposal_schema: "skills/maintain-repository-documentation/schemas/proposal.schema.json",
      },
      hydration: { max_records: 20, max_characters: 40000 },
    };
    const record: SemanticRecord = {
      schema_version: 1,
      id: "component.fixture",
      kind: "component",
      revision: 1,
      status: "active",
      title: "Fixture component",
      summary: "A component used to verify candidate projections.",
      scope: { repository: "fixture", components: [] },
      evidence: [{ revision, path: "evidence.txt" }],
      disclosure: { audiences: ["maintainer"], tags: ["fixture"], weight: 50 },
      provenance: { source: "bootstrap", transaction: null, producer: "test" },
      supersedes: null,
      payload: {},
    };
    const repository: ValidatedRepository = {
      root,
      manifest,
      revision,
      records: [record],
      effectiveStatus: new Map([
        ["lore://fixture/component/component.fixture@1", "active"],
      ]),
      extracted: {},
    };
    const proposal: LoreProposal = {
      protocol: "lore-proposal/v1",
      proposal_id: "proposal.candidate-status",
      base_revision: revision,
      skill: { path: manifest.maintenance.skill, digest: "fixture" },
      result: "changes_proposed",
      operations: [
        {
          operation: "transition_record",
          record_id: record.id,
          from: "active",
          to: "deprecated",
          evidence: [{ revision, path: "evidence.txt" }],
        },
      ],
      uncertainties: [],
    };

    const result = await planTransaction(root, proposal, repository);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const catalog = result.value.generatedOutputs.get(
      "docs/generated/component-catalog.md",
    );
    expect(catalog).toContain("| Fixture component | superseded |");
    expect(catalog).toContain("| Fixture component | deprecated |");
    expect(catalog).not.toContain("undefined");
  });

  it("restores the exact approved lockfile and is idempotent", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "lore-lock-artifact-"));
    await mkdir(path.join(root, "scripts"), { recursive: true });
    await cp("scripts/verified-lockfile.mjs", path.join(root, "scripts", "verified-lockfile.mjs"));
    await cp(
      "scripts/restore-verified-lockfile.mjs",
      path.join(root, "scripts", "restore-verified-lockfile.mjs"),
    );
    await cp(
      "artifacts/verified-lockfile",
      path.join(root, "artifacts", "verified-lockfile"),
      { recursive: true },
    );

    const { spawnSync } = await import("node:child_process");
    const restore = () =>
      spawnSync(
        process.execPath,
        [path.join(root, "scripts", "restore-verified-lockfile.mjs")],
        { cwd: root, encoding: "utf8" },
      );
    const first = restore();
    expect(first.status).toBe(0);
    const bytes = await readFile(path.join(root, "pnpm-lock.yaml"));
    const manifest = JSON.parse(
      await readFile(
        path.join(root, "artifacts", "verified-lockfile", "manifest.json"),
        "utf8",
      ),
    ) as { sha256: string };
    const { createHash } = await import("node:crypto");
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(
      manifest.sha256,
    );

    const second = restore();
    expect(second.status).toBe(0);
    expect(second.stdout).toContain("already matches");
  });

  it("rejects a modified verified-lockfile member", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "lore-lock-tamper-"));
    await mkdir(path.join(root, "scripts"), { recursive: true });
    await cp("scripts/verified-lockfile.mjs", path.join(root, "scripts", "verified-lockfile.mjs"));
    await cp(
      "scripts/restore-verified-lockfile.mjs",
      path.join(root, "scripts", "restore-verified-lockfile.mjs"),
    );
    await cp(
      "artifacts/verified-lockfile",
      path.join(root, "artifacts", "verified-lockfile"),
      { recursive: true },
    );
    const part = path.join(root, "artifacts", "verified-lockfile", "part-003.gz");
    const bytes = await readFile(part);
    bytes[0] = (bytes[0] ?? 0) ^ 0xff;
    await writeFile(part, bytes);

    const { spawnSync } = await import("node:child_process");
    const result = spawnSync(
      process.execPath,
      [path.join(root, "scripts", "restore-verified-lockfile.mjs")],
      { cwd: root, encoding: "utf8" },
    );
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("SHA-256 mismatch");
  });

  it("does not overwrite a different destination lockfile", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "lore-lock-existing-"));
    await mkdir(path.join(root, "scripts"), { recursive: true });
    await cp("scripts/verified-lockfile.mjs", path.join(root, "scripts", "verified-lockfile.mjs"));
    await cp(
      "scripts/restore-verified-lockfile.mjs",
      path.join(root, "scripts", "restore-verified-lockfile.mjs"),
    );
    await cp(
      "artifacts/verified-lockfile",
      path.join(root, "artifacts", "verified-lockfile"),
      { recursive: true },
    );
    await writeFile(path.join(root, "pnpm-lock.yaml"), "not the approved lockfile\n");

    const { spawnSync } = await import("node:child_process");
    const result = spawnSync(
      process.execPath,
      [path.join(root, "scripts", "restore-verified-lockfile.mjs")],
      { cwd: root, encoding: "utf8" },
    );
    expect(result.status).not.toBe(0);
    expect(await readFile(path.join(root, "pnpm-lock.yaml"), "utf8")).toBe(
      "not the approved lockfile\n",
    );
  });
});
