import { fail, ok } from "../domain/errors.js";
import type {
  LoreManifest,
  ValidationResult,
} from "../domain/types.js";

export type ExtractedFactKey =
  | "repository"
  | "scripts"
  | "components"
  | "relationships"
  | "tests";

export interface ExtractionFileRequirement {
  fileName: string;
  key: ExtractedFactKey;
}

const EXTRACTION_REQUIREMENTS = [
  {
    id: "repository-metadata",
    fileName: "repository.yaml",
    key: "repository",
  },
  { id: "package-scripts", fileName: "scripts.yaml", key: "scripts" },
  {
    id: "typescript-modules",
    fileName: "components.yaml",
    key: "components",
  },
  {
    id: "typescript-imports",
    fileName: "relationships.yaml",
    key: "relationships",
  },
  { id: "vitest-tests", fileName: "tests.yaml", key: "tests" },
] as const;

const KNOWN_EXTRACTOR_IDS = EXTRACTION_REQUIREMENTS.map(({ id }) => id);
const KNOWN_EXTRACTORS = new Set<string>(KNOWN_EXTRACTOR_IDS);

export function enabledExtractorIds(
  manifest: LoreManifest,
): ValidationResult<Set<string>> {
  const configured =
    manifest.extractors ??
    KNOWN_EXTRACTOR_IDS.map((id) => ({ id, enabled: true }));
  const counts = new Map<string, number>();
  for (const { id } of configured) counts.set(id, (counts.get(id) ?? 0) + 1);
  const duplicates = [...counts]
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort();
  if (duplicates.length > 0) {
    return fail(
      ...duplicates.map((id) => ({
        code: "DUPLICATE_EXTRACTOR",
        message: `Duplicate extractor configuration: ${id}`,
        location: "lore.yaml",
      })),
    );
  }

  const enabled = new Set(
    configured.filter(({ enabled }) => enabled).map(({ id }) => id),
  );
  const unknown = [...enabled]
    .filter((id) => !KNOWN_EXTRACTORS.has(id))
    .sort();
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

export function managedExtractionFileNames(): string[] {
  return [...new Set(EXTRACTION_REQUIREMENTS.map(({ fileName }) => fileName))].sort();
}

export function requiredExtractionFiles(
  manifest: LoreManifest,
): ValidationResult<ExtractionFileRequirement[]> {
  const enabledResult = enabledExtractorIds(manifest);
  if (!enabledResult.ok) return enabledResult;
  const enabled = enabledResult.value;

  return ok(
    EXTRACTION_REQUIREMENTS.filter(({ id }) => enabled.has(id)).map(
      ({ fileName, key }) => ({ fileName, key }),
    ),
  );
}
