import { cp, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { ValidatedRepository } from "../../src/domain/types.js";
import { validateProposal } from "../../src/proposals/validate-proposal.js";
import { verifySelf } from "../../src/verification/verify-self.js";

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
