import { readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { ERROR_CODES, fail, ok } from "../domain/errors.js";
import {
  prepareDirectoryInsideRoot,
  prepareWritePathInsideRoot,
  resolveExistingInsideRoot,
  resolvePotentialInsideRoot,
} from "../filesystem/repository-paths.js";
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

function resultMessage(result: { ok: false; errors: Array<{ message: string }> }): string {
  return result.errors.map(({ message }) => message).join("; ");
}

function repositoryRelative(root: string, absolutePath: string): string {
  return path.relative(path.resolve(root), absolutePath).replace(/\\/g, "/");
}

async function backupTarget(
  root: string,
  backupRootRelative: string,
  relativePath: string,
): Promise<BackupEntry> {
  const potential = await resolvePotentialInsideRoot(root, relativePath);
  if (!potential.ok) throw new Error(resultMessage(potential));

  const normalizedTarget = repositoryRelative(root, potential.value);
  const backupRelative = path.posix.join(backupRootRelative, normalizedTarget);
  const existing = await resolveExistingInsideRoot(root, relativePath);
  if (!existing.ok) {
    if (existing.errors.every(({ code }) => code === "PATH_NOT_FOUND")) {
      return {
        relativePath,
        absolutePath: potential.value,
        existed: false,
        backupPath: backupRelative,
      };
    }
    throw new Error(resultMessage(existing));
  }

  const backup = await prepareWritePathInsideRoot(root, backupRelative);
  if (!backup.ok) throw new Error(resultMessage(backup));
  await writeFile(backup.value, await readFile(existing.value));
  return {
    relativePath,
    absolutePath: existing.value,
    existed: true,
    backupPath: backupRelative,
  };
}

async function restore(root: string, entries: BackupEntry[]): Promise<void> {
  for (const entry of [...entries].reverse()) {
    if (entry.existed) {
      const target = await prepareWritePathInsideRoot(root, entry.relativePath);
      if (!target.ok) throw new Error(resultMessage(target));
      const backup = await resolveExistingInsideRoot(root, entry.backupPath);
      if (!backup.ok) throw new Error(resultMessage(backup));
      await writeFile(target.value, await readFile(backup.value));
    } else {
      const target = await resolvePotentialInsideRoot(root, entry.relativePath);
      if (!target.ok) throw new Error(resultMessage(target));
      await rm(target.value, { force: true });
    }
  }
}

async function removeBackup(root: string, backupRootRelative: string): Promise<void> {
  const backupRoot = await resolvePotentialInsideRoot(root, backupRootRelative);
  if (!backupRoot.ok) throw new Error(resultMessage(backupRoot));
  await rm(backupRoot.value, { recursive: true, force: true });
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

  const backupRootRelative = path.posix.join(".lore", ".transaction-backup", id);
  const preparedBackupRoot = await prepareDirectoryInsideRoot(root, backupRootRelative);
  if (!preparedBackupRoot.ok) return preparedBackupRoot;
  const backups: BackupEntry[] = [];

  try {
    for (const relativePath of targets) {
      backups.push(await backupTarget(root, backupRootRelative, relativePath));
    }

    for (const item of plan.recordsToCreate) {
      const target = await prepareWritePathInsideRoot(root, item.path);
      if (!target.ok) throw new Error(resultMessage(target));
      await writeFile(target.value, stableYaml(item.record));
    }

    for (const [relativePath, content] of plan.generatedOutputs) {
      const target = await prepareWritePathInsideRoot(root, relativePath);
      if (!target.ok) throw new Error(resultMessage(target));
      await writeFile(target.value, content);
    }

    const resolvedReceipt = await prepareWritePathInsideRoot(root, receiptPath);
    if (!resolvedReceipt.ok) throw new Error(resultMessage(resolvedReceipt));
    await writeFile(resolvedReceipt.value, stableYaml(receipt));

    for (const item of plan.recordsToCreate) {
      const resolved = await resolveExistingInsideRoot(root, item.path);
      if (!resolved.ok || (await readFile(resolved.value, "utf8")) !== stableYaml(item.record)) {
        throw new Error(`Post-write verification failed for ${item.path}`);
      }
    }
    for (const [relativePath, expected] of plan.generatedOutputs) {
      const resolved = await resolveExistingInsideRoot(root, relativePath);
      if (!resolved.ok || (await readFile(resolved.value, "utf8")) !== expected) {
        throw new Error(`Post-write verification failed for ${relativePath}`);
      }
    }
    const verifiedReceipt = await resolveExistingInsideRoot(root, receiptPath);
    if (!verifiedReceipt.ok || (await readFile(verifiedReceipt.value, "utf8")) !== stableYaml(receipt)) {
      throw new Error(`Post-write verification failed for ${receiptPath}`);
    }

    await removeBackup(root, backupRootRelative);
    return ok(receipt);
  } catch (error) {
    try {
      await restore(root, backups);
    } finally {
      await removeBackup(root, backupRootRelative);
    }
    return fail({
      code: ERROR_CODES.TRANSACTION_ROLLED_BACK,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}
