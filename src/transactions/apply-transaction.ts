import { access, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { ERROR_CODES, fail, ok } from "../domain/errors.js";
import { resolveInsideRoot } from "../filesystem/repository-paths.js";
import { createGitClient } from "../git/git-client.js";
import { stableYaml } from "../serialization/yaml.js";
import type {
  TransactionPlan,
  TransactionReceipt,
  ValidationResult,
} from "../domain/types.js";
import { createReceipt, transactionId } from "./receipt.js";

interface BackupEntry {
  relativePath: string;
  absolutePath: string;
  existed: boolean;
  backupPath: string;
}

function containedPath(root: string, relativePath: string): ValidationResult<string> {
  return resolveInsideRoot(root, relativePath.replace(/\\/g, "/"));
}

async function backupTarget(
  root: string,
  backupRoot: string,
  relativePath: string,
): Promise<BackupEntry> {
  const resolved = containedPath(root, relativePath);
  if (!resolved.ok) throw new Error(resolved.errors[0]?.message ?? "Unsafe transaction path");
  const absolutePath = resolved.value;
  const backupPath = path.join(backupRoot, relativePath);
  try {
    await access(absolutePath);
    await mkdir(path.dirname(backupPath), { recursive: true });
    await writeFile(backupPath, await readFile(absolutePath));
    return { relativePath, absolutePath, existed: true, backupPath };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    return { relativePath, absolutePath, existed: false, backupPath };
  }
}

async function restore(entries: BackupEntry[]): Promise<void> {
  for (const entry of [...entries].reverse()) {
    if (entry.existed) {
      await mkdir(path.dirname(entry.absolutePath), { recursive: true });
      await writeFile(entry.absolutePath, await readFile(entry.backupPath));
    } else {
      await rm(entry.absolutePath, { force: true });
    }
  }
}

export async function applyTransaction(
  root: string,
  plan: TransactionPlan,
): Promise<ValidationResult<TransactionReceipt>> {
  const git = createGitClient(root);
  if ((await git.head()) !== plan.proposal.base_revision) {
    return fail({
      code: ERROR_CODES.STALE_BASE_REVISION,
      message: "HEAD moved before apply",
    });
  }
  if (!(await git.isClean())) {
    return fail({ code: "DIRTY_WORKTREE", message: "Working tree must be clean" });
  }

  const id = transactionId(plan.proposal);
  const receipt = createReceipt(
    plan.proposal,
    await git.commitTimestamp(plan.proposal.base_revision),
    plan.recordsToCreate.map(({ path: recordPath }) => recordPath),
    [...plan.generatedOutputs.keys()],
  );
  if (receipt.transaction_id !== id) {
    return fail({
      code: "TRANSACTION_ID_MISMATCH",
      message: "Receipt transaction ID differs from the planned transaction ID",
    });
  }

  const receiptPath = plan.transactionReceiptPath;
  const targets = [
    ...plan.recordsToCreate.map(({ path: recordPath }) => recordPath),
    ...plan.generatedOutputs.keys(),
    receiptPath,
  ];
  if (new Set(targets).size !== targets.length) {
    return fail({
      code: "TRANSACTION_TARGET_COLLISION",
      message: "Transaction plan contains duplicate target paths",
    });
  }

  const backupRoot = path.join(root, ".lore", ".transaction-backup", id);
  const backups: BackupEntry[] = [];

  try {
    for (const relativePath of targets) {
      backups.push(await backupTarget(root, backupRoot, relativePath));
    }

    for (const item of plan.recordsToCreate) {
      const resolved = containedPath(root, item.path);
      if (!resolved.ok) throw new Error(resolved.errors[0]?.message);
      await mkdir(path.dirname(resolved.value), { recursive: true });
      await writeFile(resolved.value, stableYaml(item.record));
    }

    for (const [relativePath, content] of plan.generatedOutputs) {
      const resolved = containedPath(root, relativePath);
      if (!resolved.ok) throw new Error(resolved.errors[0]?.message);
      await mkdir(path.dirname(resolved.value), { recursive: true });
      await writeFile(resolved.value, content);
    }

    const resolvedReceipt = containedPath(root, receiptPath);
    if (!resolvedReceipt.ok) throw new Error(resolvedReceipt.errors[0]?.message);
    await mkdir(path.dirname(resolvedReceipt.value), { recursive: true });
    await writeFile(resolvedReceipt.value, stableYaml(receipt));

    for (const item of plan.recordsToCreate) {
      const resolved = containedPath(root, item.path);
      if (!resolved.ok || (await readFile(resolved.value, "utf8")) !== stableYaml(item.record)) {
        throw new Error(`Post-write verification failed for ${item.path}`);
      }
    }
    for (const [relativePath, expected] of plan.generatedOutputs) {
      const resolved = containedPath(root, relativePath);
      if (!resolved.ok || (await readFile(resolved.value, "utf8")) !== expected) {
        throw new Error(`Post-write verification failed for ${relativePath}`);
      }
    }
    if ((await readFile(resolvedReceipt.value, "utf8")) !== stableYaml(receipt)) {
      throw new Error(`Post-write verification failed for ${receiptPath}`);
    }

    await rm(backupRoot, { recursive: true, force: true });
    return ok(receipt);
  } catch (error) {
    try {
      await restore(backups);
    } finally {
      await rm(backupRoot, { recursive: true, force: true });
    }
    return fail({
      code: ERROR_CODES.TRANSACTION_ROLLED_BACK,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
