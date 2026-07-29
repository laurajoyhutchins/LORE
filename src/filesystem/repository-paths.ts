import { lstat, mkdir } from "node:fs/promises";
import { lstatSync } from "node:fs";
import path from "node:path";
import { ERROR_CODES, fail, ok } from "../domain/errors.js";
import type { ValidationResult } from "../domain/types.js";

function pathFailure(code: string, message: string, candidate: string) {
  return fail({ code, message, location: candidate });
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === "ENOENT";
}

function relativeParts(root: string, target: string): string[] {
  const relative = path.relative(root, target);
  return relative === "" ? [] : relative.split(path.sep).filter(Boolean);
}

async function rejectLinkedComponents(
  root: string,
  target: string,
  candidate: string,
  allowMissing: boolean,
): Promise<ValidationResult<string>> {
  const parts = relativeParts(root, target);
  let current = root;

  if (parts.length === 0) {
    try {
      await lstat(current);
      return ok(target);
    } catch (error) {
      return pathFailure(
        "PATH_NOT_FOUND",
        error instanceof Error ? error.message : String(error),
        candidate,
      );
    }
  }

  for (const part of parts) {
    current = path.join(current, part);
    try {
      const stat = await lstat(current);
      if (stat.isSymbolicLink()) {
        return pathFailure(
          "SYMLINK_PATH_REJECTED",
          `Symbolic links are not allowed in repository paths: ${candidate}`,
          candidate,
        );
      }
    } catch (error) {
      if (allowMissing && isMissing(error)) return ok(target);
      return pathFailure(
        "PATH_NOT_FOUND",
        error instanceof Error ? error.message : String(error),
        candidate,
      );
    }
  }

  return ok(target);
}

function rejectLinkedComponentsSync(
  root: string,
  target: string,
  candidate: string,
): ValidationResult<string> {
  const parts = relativeParts(root, target);
  let current = root;

  if (parts.length === 0) {
    try {
      lstatSync(current);
      return ok(target);
    } catch (error) {
      return pathFailure(
        "PATH_NOT_FOUND",
        error instanceof Error ? error.message : String(error),
        candidate,
      );
    }
  }

  for (const part of parts) {
    current = path.join(current, part);
    try {
      if (lstatSync(current).isSymbolicLink()) {
        return pathFailure(
          "SYMLINK_PATH_REJECTED",
          `Symbolic links are not allowed in repository paths: ${candidate}`,
          candidate,
        );
      }
    } catch (error) {
      return pathFailure(
        "PATH_NOT_FOUND",
        error instanceof Error ? error.message : String(error),
        candidate,
      );
    }
  }

  return ok(target);
}

export function resolveInsideRoot(
  root: string,
  candidate: string,
): ValidationResult<string> {
  const rootPath = path.resolve(root);
  const normalized = candidate.replace(/\\/g, "/");
  const resolved = path.resolve(rootPath, normalized);
  const relative = path.relative(rootPath, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return pathFailure(
      ERROR_CODES.PATH_OUTSIDE_ROOT,
      `Path escapes repository root: ${candidate}`,
      candidate,
    );
  }
  return ok(resolved);
}

export async function resolveExistingInsideRoot(
  root: string,
  candidate: string,
): Promise<ValidationResult<string>> {
  const lexical = resolveInsideRoot(root, candidate);
  if (!lexical.ok) return lexical;
  return rejectLinkedComponents(
    path.resolve(root),
    lexical.value,
    candidate,
    false,
  );
}

export function resolveExistingInsideRootSync(
  root: string,
  candidate: string,
): ValidationResult<string> {
  const lexical = resolveInsideRoot(root, candidate);
  if (!lexical.ok) return lexical;
  return rejectLinkedComponentsSync(path.resolve(root), lexical.value, candidate);
}

export async function resolvePotentialInsideRoot(
  root: string,
  candidate: string,
): Promise<ValidationResult<string>> {
  const lexical = resolveInsideRoot(root, candidate);
  if (!lexical.ok) return lexical;
  return rejectLinkedComponents(
    path.resolve(root),
    lexical.value,
    candidate,
    true,
  );
}

export async function prepareDirectoryInsideRoot(
  root: string,
  candidate: string,
): Promise<ValidationResult<string>> {
  const potential = await resolvePotentialInsideRoot(root, candidate);
  if (!potential.ok) return potential;

  try {
    await mkdir(potential.value, { recursive: true });
  } catch (error) {
    return pathFailure(
      "PATH_PREPARATION_FAILED",
      error instanceof Error ? error.message : String(error),
      candidate,
    );
  }

  return resolveExistingInsideRoot(root, candidate);
}

export async function prepareWritePathInsideRoot(
  root: string,
  candidate: string,
): Promise<ValidationResult<string>> {
  const potential = await resolvePotentialInsideRoot(root, candidate);
  if (!potential.ok) return potential;

  const rootPath = path.resolve(root);
  if (potential.value === rootPath) {
    return pathFailure(
      "INVALID_WRITE_PATH",
      "A repository root cannot be used as a file target",
      candidate,
    );
  }

  const parent = path.dirname(potential.value);
  const parentCandidate = path.relative(rootPath, parent) || ".";
  const preparedParent = await prepareDirectoryInsideRoot(root, parentCandidate);
  if (!preparedParent.ok) return preparedParent;

  try {
    const stat = await lstat(potential.value);
    if (stat.isSymbolicLink()) {
      return pathFailure(
        "SYMLINK_PATH_REJECTED",
        `Symbolic links are not allowed in repository paths: ${candidate}`,
        candidate,
      );
    }
  } catch (error) {
    if (!isMissing(error)) {
      return pathFailure(
        "PATH_PREPARATION_FAILED",
        error instanceof Error ? error.message : String(error),
        candidate,
      );
    }
  }

  return ok(potential.value);
}

export const toPosix = (value: string) => value.replace(/\\/g, "/");
