import { mkdtemp, mkdir, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { loadManifest } from "../../src/config/load-manifest.js";
import { extractRepository } from "../../src/extraction/extract.js";
import {
  prepareWritePathInsideRoot,
  resolveExistingInsideRoot,
  resolveExistingInsideRootSync,
  resolvePotentialInsideRoot,
} from "../../src/filesystem/repository-paths.js";
import { validateProposal } from "../../src/proposals/validate-proposal.js";
import type { LoreManifest, ValidatedRepository } from "../../src/domain/types.js";

async function temporaryDirectories() {
  const parent = await mkdtemp(path.join(os.tmpdir(), "lore-paths-"));
  const root = path.join(parent, "repository");
  const outside = path.join(parent, "outside");
  await mkdir(root);
  await mkdir(outside);
  return { parent, root, outside };
}

async function linkOrSkip(target: string, linkPath: string): Promise<boolean> {
  try {
    await symlink(target, linkPath, process.platform === "win32" ? "junction" : undefined);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "EPERM") return false;
    throw error;
  }
}

describe("repository filesystem containment", () => {
  it("rejects lexical traversal outside the selected root", async () => {
    const { root } = await temporaryDirectories();
    const result = await resolvePotentialInsideRoot(root, "../outside/secret.yaml");
    expect(result.ok).toBe(false);
  });

  it("rejects an existing file reached through a symbolic-link directory", async () => {
    const { root, outside } = await temporaryDirectories();
    await writeFile(path.join(outside, "secret.yaml"), "secret: true\n");
    if (!(await linkOrSkip(outside, path.join(root, "linked")))) return;

    const result = await resolveExistingInsideRoot(root, "linked/secret.yaml");
    expect(result.ok).toBe(false);
  });

  it("rejects the same symbolic-link escape in synchronous schema reads", async () => {
    const { root, outside } = await temporaryDirectories();
    await writeFile(path.join(outside, "schema.json"), "{}\n");
    if (!(await linkOrSkip(outside, path.join(root, "linked")))) return;

    const result = resolveExistingInsideRootSync(root, "linked/schema.json");
    expect(result.ok).toBe(false);
  });

  it("creates a bounded write target and rejects a linked parent", async () => {
    const { root, outside } = await temporaryDirectories();

    const safe = await prepareWritePathInsideRoot(root, "generated/nested/output.md");
    expect(safe.ok).toBe(true);
    if (safe.ok) {
      await writeFile(safe.value, "safe\n");
      expect(await readFile(safe.value, "utf8")).toBe("safe\n");
    }

    if (!(await linkOrSkip(outside, path.join(root, "linked")))) return;
    const unsafe = await prepareWritePathInsideRoot(root, "linked/output.md");
    expect(unsafe.ok).toBe(false);
  });

  it("rejects a symlinked manifest before parsing it", async () => {
    const { root, outside } = await temporaryDirectories();
    await writeFile(path.join(outside, "lore.yaml"), "schema_version: 1\n");
    if (!(await linkOrSkip(path.join(outside, "lore.yaml"), path.join(root, "lore.yaml")))) {
      return;
    }

    const result = await loadManifest(root);
    expect(result.ok).toBe(false);
  });

  it("rejects source extraction through a symbolic link", async () => {
    const { root, outside } = await temporaryDirectories();
    await writeFile(path.join(root, "package.json"), '{"scripts":{}}\n');
    await writeFile(path.join(outside, "external.ts"), "export const secret = true;\n");
    if (!(await linkOrSkip(path.join(outside, "external.ts"), path.join(root, "external.ts")))) {
      return;
    }

    const manifest = {
      repository: { id: "lore", name: "LORE", root: "." },
      paths: { extracted: ".lore/extracted" },
    } as LoreManifest;
    const result = await extractRepository(root, manifest);
    expect(result.ok).toBe(false);
  });

  it("rejects a proposal path outside the selected repository", async () => {
    const { root, outside } = await temporaryDirectories();
    await writeFile(path.join(outside, "proposal.yaml"), "protocol: lore-proposal/v1\n");

    const result = await validateProposal(
      root,
      "../outside/proposal.yaml",
      {} as ValidatedRepository,
    );
    expect(result.ok).toBe(false);
  });
});
