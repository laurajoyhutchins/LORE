import Ajv2020, { type ErrorObject, type ValidateFunction } from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ERROR_CODES, fail, ok } from "../domain/errors.js";
import type { ValidationProblem, ValidationResult } from "../domain/types.js";

export interface SchemaRegistry {
  validateWithSchema<T>(id: string, value: unknown): ValidationResult<T>;
}

const registries = new Map<string, SchemaRegistry>();
const SCHEMA_NAMES = [
  "manifest",
  "record",
  "proposal",
  "task",
  "hydration",
  "extracted-facts",
  "transaction",
] as const;

function problemFromAjv(error: ErrorObject): ValidationProblem {
  return {
    code: ERROR_CODES.SCHEMA_VALIDATION_FAILED,
    message: `${error.instancePath || "/"} ${error.message ?? error.keyword}`,
    location: error.instancePath || "/",
    details: {
      keyword: error.keyword,
      schemaPath: error.schemaPath,
    },
  };
}

function compareAjvErrors(left: ErrorObject, right: ErrorObject): number {
  return (
    left.instancePath.localeCompare(right.instancePath) ||
    left.schemaPath.localeCompare(right.schemaPath) ||
    left.keyword.localeCompare(right.keyword)
  );
}

export function createSchemaRegistry(root = process.cwd()): SchemaRegistry {
  const resolvedRoot = path.resolve(root);
  const cached = registries.get(resolvedRoot);
  if (cached) return cached;

  const ajv = new Ajv2020({ allErrors: true, strict: true });
  addFormats(ajv);
  const declaredIds = new Map<string, string>();

  for (const name of SCHEMA_NAMES) {
    const schemaPath = path.join(resolvedRoot, "schemas", `${name}.schema.json`);
    const schema = JSON.parse(readFileSync(schemaPath, "utf8")) as Record<string, unknown>;
    ajv.addSchema(schema, name);
    const declaredId = schema.$id;
    if (typeof declaredId === "string") declaredIds.set(declaredId, name);
  }

  const validators = new Map<string, ValidateFunction>();
  for (const name of SCHEMA_NAMES) {
    const validator = ajv.getSchema(name);
    if (!validator) throw new Error(`Schema did not compile: ${name}`);
    validators.set(name, validator);
  }
  for (const [declaredId, name] of declaredIds) {
    const validator = validators.get(name);
    if (validator) validators.set(declaredId, validator);
  }

  const registry: SchemaRegistry = {
    validateWithSchema<T>(id: string, value: unknown): ValidationResult<T> {
      const validator = validators.get(id);
      if (!validator) {
        return fail({
          code: ERROR_CODES.SCHEMA_VALIDATION_FAILED,
          message: `Unknown schema: ${id}`,
        });
      }
      if (validator(value)) return ok(value as T);
      const errors = [...(validator.errors ?? [])].sort(compareAjvErrors).map(problemFromAjv);
      return fail(...errors);
    },
  };

  registries.set(resolvedRoot, registry);
  return registry;
}

export function validateWithSchema<T>(
  schemaId: string,
  value: unknown,
  root = process.cwd(),
): ValidationResult<T> {
  return createSchemaRegistry(root).validateWithSchema<T>(schemaId, value);
}
