import { execFile } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { createGitClient } from "../../src/git/git-client.js";
import { semanticDiff } from "../../src/diff/semantic-diff.js";

const exec = promisify(execFile);

async function repositoryFixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), "lore-git-"));
  const run = (args: string[]) => exec("git", args, { cwd: root });
  await run(["init"]);
  await run(["config", "user.name", "LORE Test"]);
  await run(["config", "user.email", "lore-test@example.invalid"]);
  await writeFile(
    path.join(root, "lore.yaml"),
    "schema_version: 1\nrepository:\n  id: example.repository\n  name: Example\n  root: .\n",
  );
  await run(["add", "lore.yaml"]);
  await run(["commit", "-m", "fixture"]);
  return root;
}

describe("Git revision handling", () => {
  it("resolves ordinary revisions to exact commit IDs", async () => {
    const root = await repositoryFixture();
    const git = createGitClient(root);
    await expect(git.resolveCommit("HEAD")).resolves.toMatch(/^[0-9a-f]{40}$/);
  });

  it("preserves exact file bytes when reading historical evidence", async () => {
    const root = await repositoryFixture();
    const git = createGitClient(root);
    await expect(git.readFileAtRevision("HEAD", "lore.yaml")).resolves.toMatch(/\n$/);
  });

  it("rejects option-shaped revisions", async () => {
    const root = await repositoryFixture();
    const git = createGitClient(root);
    await expect(git.resolveCommit("--help")).rejects.toThrow("Invalid Git revision");
  });

  it("rejects revisions containing control characters", async () => {
    const root = await repositoryFixture();
    const git = createGitClient(root);
    await expect(git.resolveCommit("HEAD\n--help")).rejects.toThrow("Invalid Git revision");
    await expect(git.resolveCommit("HEAD\0suffix")).rejects.toThrow("Invalid Git revision");
  });

  it("rejects repository paths that can alter object expressions", async () => {
    const root = await repositoryFixture();
    const git = createGitClient(root);
    await expect(git.readFileAtRevision("HEAD", "../outside")).rejects.toThrow(
      "Invalid Git repository path",
    );
  });

  it("fails semantic diff closed for option-shaped revisions", async () => {
    const root = await repositoryFixture();
    const result = await semanticDiff(root, "--help", "HEAD");
    expect(result.ok).toBe(false);
  });
});
