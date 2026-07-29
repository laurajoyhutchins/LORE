import { mkdtemp, readFile, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { initializeRepository } from "../../../src/init/initialize.js";

async function temporaryRepository(): Promise<string> {
  return mkdtemp(path.join(os.tmpdir(), "lore-init-"));
}

describe("initializeRepository", () => {
  it("installs the trust root into an empty repository", async () => {
    const root = await temporaryRepository();
    const result = await initializeRepository(root, {
      repositoryId: "example.repository",
      repositoryName: "Example Repository",
      force: false,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.created).toContain("lore.yaml");
    expect(result.value.created).toContain("BOOTSTRAP.md");
    expect(await readFile(path.join(root, "lore.yaml"), "utf8")).toContain(
      "id: example.repository",
    );
  });

  it("preserves existing files unless force is enabled", async () => {
    const root = await temporaryRepository();
    await writeFile(path.join(root, "BOOTSTRAP.md"), "custom\n");

    const preserved = await initializeRepository(root, {
      repositoryId: "example",
      repositoryName: "Example",
      force: false,
    });
    expect(preserved.ok).toBe(true);
    expect(await readFile(path.join(root, "BOOTSTRAP.md"), "utf8")).toBe("custom\n");

    const replaced = await initializeRepository(root, {
      repositoryId: "example",
      repositoryName: "Example",
      force: true,
    });
    expect(replaced.ok).toBe(true);
    expect(await readFile(path.join(root, "BOOTSTRAP.md"), "utf8")).not.toBe("custom\n");
  });

  it("rejects a symbolic-link destination", async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), "lore-init-link-"));
    const root = path.join(parent, "repository");
    const outside = path.join(parent, "outside.md");
    await import("node:fs/promises").then(({ mkdir }) => mkdir(root));
    await writeFile(outside, "outside\n");
    try {
      await symlink(outside, path.join(root, "BOOTSTRAP.md"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EPERM") return;
      throw error;
    }

    const result = await initializeRepository(root, {
      repositoryId: "example",
      repositoryName: "Example",
      force: true,
    });
    expect(result.ok).toBe(false);
    expect(await readFile(outside, "utf8")).toBe("outside\n");
  });
});
