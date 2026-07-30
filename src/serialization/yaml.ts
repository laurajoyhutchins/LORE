import YAML from "yaml";
import { ERROR_CODES, fail, ok } from "../domain/errors.js";
import type { ValidationResult } from "../domain/types.js";

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortDeep(nested)]),
    );
  }
  return value;
}

export function stableYaml(value: unknown): string {
  return YAML.stringify(sortDeep(value), {
    lineWidth: 0,
    aliasDuplicateObjects: false,
  })
    .replace(/\r\n/g, "\n")
    .replace(/\n*$/, "\n");
}

export function parseYamlDocument<T>(
  content: string,
  location: string,
): ValidationResult<T> {
  try {
    const document = YAML.parseDocument(content, { customTags: [] });
    if (document.errors.length > 0) {
      return fail(
        ...document.errors.map((error) => ({
          code: ERROR_CODES.INVALID_YAML,
          message: error.message,
          location,
        })),
      );
    }
    return ok(document.toJS({ maxAliasCount: 20 }) as T);
  } catch (error) {
    return fail({
      code: ERROR_CODES.INVALID_YAML,
      message: error instanceof Error ? error.message : String(error),
      location,
    });
  }
}
