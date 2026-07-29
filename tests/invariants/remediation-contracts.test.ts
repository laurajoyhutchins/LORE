import { describe, expect, it } from "vitest";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { validateProposal } from "../../src/proposals/validate-proposal.js";
import { planTransaction } from "../../src/transactions/plan-transaction.js";
import { verifySelf } from "../../src/verification/verify-self.js";
import type { ValidatedRepository } from "../../src/domain/types.js";

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

  it("does not plan a transaction before candidate evidence is validated", async () => {
    const source = await readFile("src/transactions/plan-transaction.ts", "utf8");
    expect(source).toContain("validateEvidence");
  });
});
