import { readFile } from "node:fs/promises";
import { ERROR_CODES, fail } from "../domain/errors.js";
import type { LoreManifest, ValidationResult } from "../domain/types.js";
import { resolveExistingInsideRoot } from "../filesystem/repository-paths.js";
import { parseYamlDocument } from "../serialization/yaml.js";

export async function loadManifest(
  root: string,
): Promise<ValidationResult<LoreManifest>> {
  const manifestPath = await resolveExistingInsideRoot(root, "lore.yaml");
  if (!manifestPath.ok) {
    return fail(
      ...manifestPath.errors.map((problem) => ({
        ...problem,
        code: problem.code === "PATH_NOT_FOUND" ? "MANIFEST_MISSING" : problem.code,
      })),
    );
  }

  let text: string;
  try {
    text = await readFile(manifestPath.value, "utf8");
  } catch {
    return fail({
      code: "MANIFEST_MISSING",
      message: "lore.yaml could not be read",
      location: "lore.yaml",
    });
  }

  const parsed = parseYamlDocument<LoreManifest>(text, "lore.yaml");
  if (!parsed.ok) return parsed;
  if (parsed.value.schema_version !== 1) {
    return fail({
      code: ERROR_CODES.UNSUPPORTED_SCHEMA_VERSION,
      message: `Unsupported manifest schema ${String(parsed.value.schema_version)}`,
    });
  }
  return parsed;
}
