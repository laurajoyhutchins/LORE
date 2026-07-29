import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

export interface GitClient {
  head(): Promise<string>;
  resolveCommit(revision: string): Promise<string>;
  isClean(): Promise<boolean>;
  fileExistsAtRevision(revision: string, repositoryPath: string): Promise<boolean>;
  readFileAtRevision(revision: string, repositoryPath: string): Promise<string>;
  commitTimestamp(revision: string): Promise<string>;
}

function validateRevisionArgument(revision: string): void {
  if (
    revision.length === 0 ||
    revision.startsWith("-") ||
    revision.includes("\0") ||
    revision.includes("\r") ||
    revision.includes("\n")
  ) {
    throw new Error("Invalid Git revision argument");
  }
}

function validateRepositoryPath(repositoryPath: string): void {
  if (
    repositoryPath.length === 0 ||
    repositoryPath.startsWith("/") ||
    repositoryPath.includes("\\") ||
    repositoryPath.split("/").includes("..") ||
    repositoryPath.includes("\0") ||
    repositoryPath.includes("\r") ||
    repositoryPath.includes("\n")
  ) {
    throw new Error("Invalid Git repository path");
  }
}

export function createGitClient(root: string): GitClient {
  const run = async (args: string[]) => {
    const result = await exec("git", args, {
      cwd: root,
      timeout: 10_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    return result.stdout.trimEnd();
  };

  const resolveCommit = async (revision: string): Promise<string> => {
    validateRevisionArgument(revision);
    const resolved = await run([
      "rev-parse",
      "--verify",
      "--end-of-options",
      `${revision}^{commit}`,
    ]);
    if (!/^[0-9a-f]{40}$/i.test(resolved)) {
      throw new Error("Git revision did not resolve to a commit");
    }
    return resolved.toLowerCase();
  };

  return {
    head: async () => resolveCommit("HEAD"),
    resolveCommit,
    isClean: async () => (await run(["status", "--porcelain"])) === "",
    fileExistsAtRevision: async (revision, repositoryPath) => {
      try {
        validateRepositoryPath(repositoryPath);
        const commit = await resolveCommit(revision);
        await run(["cat-file", "-e", `${commit}:${repositoryPath}`]);
        return true;
      } catch {
        return false;
      }
    },
    readFileAtRevision: async (revision, repositoryPath) => {
      validateRepositoryPath(repositoryPath);
      const commit = await resolveCommit(revision);
      return run(["show", `${commit}:${repositoryPath}`]);
    },
    commitTimestamp: async (revision) => {
      const commit = await resolveCommit(revision);
      return run(["show", "-s", "--format=%cI", commit]);
    },
  };
}
