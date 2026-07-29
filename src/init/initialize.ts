import { access, copyFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { fail, ok } from "../domain/errors.js";
import type { ValidationResult } from "../domain/types.js";
import {
  prepareWritePathInsideRoot,
  resolveExistingInsideRoot,
  resolvePotentialInsideRoot,
} from "../filesystem/repository-paths.js";
import { stableYaml } from "../serialization/yaml.js";

export interface InitOptions {
  repositoryId: string;
  repositoryName: string;
  force: boolean;
}

const TEMPLATE_FILES = [
  "BOOTSTRAP.md",
  "schemas/manifest.schema.json",
  "schemas/record.schema.json",
  "schemas/proposal.schema.json",
  "schemas/task.schema.json",
  "schemas/hydration.schema.json",
  "schemas/extracted-facts.schema.json",
  "schemas/transaction.schema.json",
  "skills/maintain-repository-documentation/SKILL.md",
  "skills/maintain-repository-documentation/INPUTS.md",
  "skills/maintain-repository-documentation/OUTPUTS.md",
  "skills/maintain-repository-documentation/schemas/proposal.schema.json",
] as const;

async function locateTemplateRoot(): Promise<string> {
  const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));
  const candidates = [
    path.resolve(moduleDirectory, "../.."),
    path.resolve(moduleDirectory, "../../.."),
    process.cwd(),
  ];

  for (const candidate of candidates) {
    try {
      await access(path.join(candidate, "BOOTSTRAP.md"));
      await access(path.join(candidate, "schemas", "manifest.schema.json"));
      return candidate;
    } catch {
      continue;
    }
  }
  throw new Error("LORE initialization templates are unavailable");
}

function resultMessage(result: { ok: false; errors: Array<{ message: string }> }): string {
  return result.errors.map(({ message }) => message).join("; ");
}

export async function initializeRepository(
  root: string,
  options: InitOptions,
): Promise<ValidationResult<{ created: string[]; preserved: string[] }>> {
  if (!/^[a-z0-9.-]+$/.test(options.repositoryId)) {
    return fail({
      code: "INVALID_REPOSITORY_ID",
      message: "Repository ID must be lower-case dotted text",
    });
  }

  let source: string;
  try {
    source = await locateTemplateRoot();
  } catch (error) {
    return fail({
      code: "INIT_TEMPLATE_MISSING",
      message: error instanceof Error ? error.message : String(error),
    });
  }

  const created: string[] = [];
  const preserved: string[] = [];

  const copy = async (relativePath: string): Promise<ValidationResult<void>> => {
    const potential = await resolvePotentialInsideRoot(root, relativePath);
    if (!potential.ok) return potential;
    const existing = await resolveExistingInsideRoot(root, relativePath);
    if (existing.ok && !options.force) {
      preserved.push(relativePath);
      return ok(undefined);
    }
    if (!existing.ok && !existing.errors.every(({ code }) => code === "PATH_NOT_FOUND")) {
      return existing;
    }

    const target = await prepareWritePathInsideRoot(root, relativePath);
    if (!target.ok) return target;
    try {
      await copyFile(path.join(source, relativePath), target.value);
      created.push(relativePath);
      return ok(undefined);
    } catch (error) {
      return fail({
        code: "INIT_TEMPLATE_COPY_FAILED",
        message: error instanceof Error ? error.message : String(error),
        location: relativePath,
      });
    }
  };

  for (const relativePath of TEMPLATE_FILES) {
    const copied = await copy(relativePath);
    if (!copied.ok) return copied;
  }

  const manifest = {
    schema_version: 1,
    repository: { id: options.repositoryId, name: options.repositoryName, root: "." },
    paths: {
      extracted: ".lore/extracted",
      records: ".lore/records",
      proposals: ".lore/proposals",
      transactions: ".lore/transactions",
      generated_docs: "docs/generated",
      skills: "skills",
    },
    extractors: [{ id: "repository-metadata", enabled: true }],
    projections: [{ id: "readme", output: "README.md" }],
    maintenance: {
      skill: "skills/maintain-repository-documentation/SKILL.md",
      proposal_schema: "skills/maintain-repository-documentation/schemas/proposal.schema.json",
    },
    hydration: { max_records: 20, max_characters: 40000 },
  };

  const manifestPath = "lore.yaml";
  const existingManifest = await resolveExistingInsideRoot(root, manifestPath);
  if (existingManifest.ok && !options.force) {
    preserved.push(manifestPath);
  } else {
    if (
      !existingManifest.ok &&
      !existingManifest.errors.every(({ code }) => code === "PATH_NOT_FOUND")
    ) {
      return existingManifest;
    }
    const target = await prepareWritePathInsideRoot(root, manifestPath);
    if (!target.ok) return target;
    try {
      await import("node:fs/promises").then(({ writeFile }) =>
        writeFile(target.value, stableYaml(manifest)),
      );
      created.push(manifestPath);
    } catch (error) {
      return fail({
        code: "INIT_MANIFEST_WRITE_FAILED",
        message: error instanceof Error ? error.message : String(error),
        location: manifestPath,
      });
    }
  }

  return ok({ created: created.sort(), preserved: preserved.sort() });
}
