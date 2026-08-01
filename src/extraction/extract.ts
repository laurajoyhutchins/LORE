import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { fail, ok } from "../domain/errors.js";
import type {
  LoreManifest,
  ValidationProblem,
  ValidationResult,
} from "../domain/types.js";
import {
  prepareWritePathInsideRoot,
  resolveExistingInsideRoot,
} from "../filesystem/repository-paths.js";
import { stableYaml } from "../serialization/yaml.js";
import { requiredExtractionFiles } from "./extractor-configuration.js";

export interface ExtractionResult {
  files: Map<string, string>;
  warnings: ValidationProblem[];
}

interface PackageJson {
  scripts?: Record<string, string>;
}

interface ExtractedModule {
  path: string;
  exports: string[];
}

interface ExtractedRelationship {
  from: string;
  to: string;
  type: "imports";
}

interface ExtractedTest {
  file: string;
  name: string;
  kind: string;
}

interface WalkResult {
  files: string[];
  problems: ValidationProblem[];
}

type ParsedSourceFile = ts.SourceFile & {
  parseDiagnostics?: readonly ts.Diagnostic[];
};

async function walk(root: string, directory = root): Promise<WalkResult> {
  const files: string[] = [];
  const problems: ValidationProblem[] = [];
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);

  for (const entry of entries) {
    if ([".git", "node_modules", "dist"].includes(entry.name)) continue;
    const filePath = path.join(directory, entry.name);
    const relativePath = path.relative(root, filePath).replace(/\\/g, "/");

    if (entry.isSymbolicLink()) {
      problems.push({
        code: "SYMLINK_PATH_REJECTED",
        message: `Symbolic links are not allowed during extraction: ${relativePath}`,
        location: relativePath,
      });
      continue;
    }
    if (entry.isDirectory()) {
      const nested = await walk(root, filePath);
      files.push(...nested.files);
      problems.push(...nested.problems);
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }

  return { files: files.sort(), problems };
}

async function loadPackageJson(root: string): Promise<ValidationResult<PackageJson>> {
  const packagePath = await resolveExistingInsideRoot(root, "package.json");
  if (!packagePath.ok) {
    if (packagePath.errors.every(({ code }) => code === "PATH_NOT_FOUND")) return ok({ scripts: {} });
    return packagePath;
  }

  try {
    return ok(JSON.parse(await readFile(packagePath.value, "utf8")) as PackageJson);
  } catch (error) {
    return fail({
      code: "INVALID_PACKAGE_JSON",
      message: error instanceof Error ? error.message : String(error),
      location: "package.json",
    });
  }
}

function detectedLanguages(files: string[]): string[] {
  return [
    ...new Set(
      files
        .map((file) =>
          file.endsWith(".py")
            ? "Python"
            : file.endsWith(".ts")
              ? "TypeScript"
              : file.endsWith(".js")
                ? "JavaScript"
                : file.endsWith(".md")
                  ? "Markdown"
                  : null,
        )
        .filter((language) => language !== null),
    ),
  ].sort();
}

function detectedPackageManager(files: string[]): string {
  if (files.includes("pnpm-lock.yaml")) return "pnpm";
  if (files.includes("yarn.lock")) return "yarn";
  if (files.includes("bun.lock") || files.includes("bun.lockb")) return "bun";
  if (files.includes("package-lock.json")) return "npm";
  if (files.includes("uv.lock")) return "uv";
  if (files.includes("poetry.lock")) return "poetry";
  if (files.includes("Pipfile.lock")) return "pipenv";
  if (files.includes("pyproject.toml")) return "python";
  if (files.includes("package.json")) return "npm";
  if (files.some((file) => /^requirements(?:-[^/]+)?\.txt$/.test(file))) return "pip";
  return "unknown";
}

export async function extractRepository(
  root: string,
  manifest: LoreManifest,
): Promise<ValidationResult<ExtractionResult>> {
  const requirements = requiredExtractionFiles(manifest);
  if (!requirements.ok) return requirements;
  if (requirements.value.length === 0) return ok({ files: new Map(), warnings: [] });

  const walked = await walk(root);
  if (walked.problems.length > 0) return fail(...walked.problems);
  const allFiles = walked.files;

  const packageResult = await loadPackageJson(root);
  if (!packageResult.ok) return packageResult;
  const packageJson = packageResult.value;
  const enabled = new Set(
    manifest.extractors.filter(({ enabled }) => enabled).map(({ id }) => id),
  );
  const inspectTypeScript = [
    "typescript-modules",
    "typescript-imports",
    "vitest-tests",
  ].some((id) => enabled.has(id));

  const modules: ExtractedModule[] = [];
  const relationships: ExtractedRelationship[] = [];
  const tests: ExtractedTest[] = [];
  const warnings: ValidationProblem[] = [];

  if (inspectTypeScript) {
    for (const file of allFiles.filter((candidate) => candidate.endsWith(".ts"))) {
      const sourcePath = await resolveExistingInsideRoot(root, file);
      if (!sourcePath.ok) return sourcePath;
      const sourceText = await readFile(sourcePath.value, "utf8");
      const sourceFile = ts.createSourceFile(
        file,
        sourceText,
        ts.ScriptTarget.Latest,
        true,
      );
      const exports: string[] = [];
      const visit = (node: ts.Node): void => {
        if (
          (ts.getCombinedModifierFlags(node as ts.Declaration) & ts.ModifierFlags.Export) !== 0 &&
          "name" in node &&
          node.name !== undefined &&
          typeof node.name === "object" &&
          node.name !== null &&
          ts.isIdentifier(node.name as ts.Node)
        ) {
          exports.push((node.name as ts.Identifier).text);
        }
        if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
          relationships.push({
            from: file,
            to: node.moduleSpecifier.text,
            type: "imports",
          });
        }
        if (
          ts.isCallExpression(node) &&
          ts.isIdentifier(node.expression) &&
          ["describe", "it", "test"].includes(node.expression.text)
        ) {
          const argument = node.arguments[0];
          if (argument && ts.isStringLiteral(argument)) {
            tests.push({
              file,
              name: argument.text,
              kind: node.expression.text,
            });
          }
        }
        ts.forEachChild(node, visit);
      };
      visit(sourceFile);
      modules.push({ path: file, exports: exports.sort() });
      for (const diagnostic of (sourceFile as ParsedSourceFile).parseDiagnostics ?? []) {
        warnings.push({
          code: "UNSUPPORTED_SYNTAX",
          message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
          location: file,
        });
      }
    }
  }

  const required = new Set(requirements.value.map(({ fileName }) => fileName));
  const files = new Map<string, string>();
  if (required.has("repository.yaml")) {
    files.set(
      `${manifest.paths.extracted}/repository.yaml`,
      stableYaml({
        schema_version: 1,
        extractor: "repository-metadata",
        repository: {
          id: manifest.repository.id,
          name: manifest.repository.name,
          package_manager: detectedPackageManager(allFiles),
          languages: detectedLanguages(allFiles),
        },
        scripts: Object.fromEntries(Object.entries(packageJson.scripts ?? {}).sort()),
      }),
    );
  }
  if (required.has("components.yaml")) {
    files.set(
      `${manifest.paths.extracted}/components.yaml`,
      stableYaml({
        schema_version: 1,
        extractor: "typescript-modules",
        components: modules.sort((left, right) => left.path.localeCompare(right.path)),
      }),
    );
  }
  if (required.has("relationships.yaml")) {
    files.set(
      `${manifest.paths.extracted}/relationships.yaml`,
      stableYaml({
        schema_version: 1,
        extractor: "typescript-imports",
        relationships: relationships.sort((left, right) =>
          JSON.stringify(left).localeCompare(JSON.stringify(right)),
        ),
      }),
    );
  }
  if (required.has("tests.yaml")) {
    files.set(
      `${manifest.paths.extracted}/tests.yaml`,
      stableYaml({
        schema_version: 1,
        extractor: "vitest-tests",
        tests: tests.sort(
          (left, right) =>
            left.file.localeCompare(right.file) || left.name.localeCompare(right.name),
        ),
      }),
    );
  }
  return ok({ files, warnings }, warnings);
}

export async function writeExtraction(
  root: string,
  result: ExtractionResult,
): Promise<void> {
  for (const [filePath, content] of result.files) {
    const target = await prepareWritePathInsideRoot(root, filePath);
    if (!target.ok) throw new Error(target.errors.map(({ message }) => message).join("; "));
    await writeFile(target.value, content);
  }
}
