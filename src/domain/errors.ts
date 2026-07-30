import type { ValidationProblem } from "./types.js";

export const ERROR_CODES = {
  INVALID_YAML: "INVALID_YAML",
  INVALID_RECORD_REFERENCE: "INVALID_RECORD_REFERENCE",
  PATH_OUTSIDE_ROOT: "PATH_OUTSIDE_ROOT",
  UNSUPPORTED_SCHEMA_VERSION: "UNSUPPORTED_SCHEMA_VERSION",
  SCHEMA_VALIDATION_FAILED: "SCHEMA_VALIDATION_FAILED",
  SEMANTIC_INVARIANT_FAILED: "SEMANTIC_INVARIANT_FAILED",
  STALE_BASE_REVISION: "STALE_BASE_REVISION",
  EVIDENCE_PATH_MISSING: "EVIDENCE_PATH_MISSING",
  EVIDENCE_LINE_RANGE_INVALID: "EVIDENCE_LINE_RANGE_INVALID",
  GENERATED_OUTPUT_STALE: "GENERATED_OUTPUT_STALE",
  TRANSACTION_ROLLED_BACK: "TRANSACTION_ROLLED_BACK",
  SKILL_SCHEMA_DRIFT: "SKILL_SCHEMA_DRIFT",
} as const;

export class LoreError extends Error {
  constructor(
    readonly problem: ValidationProblem,
    options?: ErrorOptions,
  ) {
    super(problem.message, options);
    this.name = "LoreError";
  }
}

export const ok = <T>(
  value: T,
  warnings: ValidationProblem[] = [],
): { ok: true; value: T; warnings: ValidationProblem[] } => ({
  ok: true,
  value,
  warnings,
});

export const fail = (
  ...errors: ValidationProblem[]
): { ok: false; errors: ValidationProblem[] } => ({
  ok: false,
  errors: errors.sort(
    (left, right) =>
      (left.location ?? "").localeCompare(right.location ?? "") ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message),
  ),
});
