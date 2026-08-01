import { fail, ok } from "../domain/errors.js";
import type {
  LoreManifest,
  ValidationResult,
} from "../domain/types.js";

export type ExtractedFactKey = "repository" | "components" | "relationships" | "tests";

export interface ExtractionFileRequirement {
  fileName: string;
  key: ExtractedFactKey;
}

const KNOWN_EXTRACTOR_IDS = [
  "repository-metadata",
  "package-scripts",
  "typescript-modules",
  "typescript-imports",
  "vitest-tests",
] as const;
const KNOWN_EXTRACTORS = new Set<string>(KNOWN_EXTRACTOR_IDS);

export function enabledExtractorIds(
  manifest: LoreManifest,
): ValidationResult<Set<string>> {
  const configured = manifest.extractors ?? KNOWN_EXTRACTOR_IDS.map((id) => ({ id, enabled: true }));
  const enabled = new Set(
    configured.filter(({ enabled }) => enabled).map(({ id }) => id),
  );
  const unknown = [...enabled].filter((id) => !KNOWN_EXTRACTORS.has(id)).sort();
  if (unknown.length > 0) {
    return fail(
      ...unknown.map((id) => ({
        code: "UNKNOWN_EXTRACTOR",
        message: `Unknown enabled extractor: ${id}`,
        location: "lore.yaml",
      })),
    );
  }
  return ok(enabled);
}

export function requiredExtractionFiles(
  manifest: LoreManifest,
): ValidationResult<ExtractionFileRequirement[]> {
  const enabledResult = enabledExtractorIds(manifest);
  if (!enabledResult.ok) return enabledResult;
  const enabled = enabledResult.value;

  const files: ExtractionFileRequirement[] = [];
  if (enabled.has("repository-metadata") || enabled.has("package-scripts")) {
    files.push({ fileName: "repository.yaml", key: "repository" });
  }
  if (enabled.has("typescript-modules")) {
    files.push({ fileName: "components.yaml", key: "components" });
  }
  if (enabled.has("typescript-imports")) {
    files.push({ fileName: "relationships.yaml", key: "relationships" });
  }
  if (enabled.has("vitest-tests")) {
    files.push({ fileName: "tests.yaml", key: "tests" });
  }
  return ok(files);
}
