import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";
import { ok } from "../domain/errors.js";
import type {
  LoreManifest,
  ValidationProblem,
  ValidationResult,
} from "../domain/types.js";
import { stableYaml } from "../serialization/yaml.js";

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

type ParsedSourceFile = ts.SourceFile & {
  parseDiagnostics?: readonly ts.Diagnostic[];
};

async function walk(root: string, directory = root): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true }).catch(() => [])) {
    if ([".git", "node_modules", "dist"].includes(entry.name)) continue;
    const filePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(root, filePath)));
    else files.push(path.relative(root, filePath).replace(/\\/g, "/"));
  }
  return files.sort();
}

export async function extractRepository(
  root: string,
  manifest: LoreManifest,
): Promise<ValidationResult<ExtractionResult>> {
  const allFiles = await walk(root);
  const packageJson = JSON.parse(
    await readFile(path.join(root, "package.json"), "utf8").catch(() => '{"scripts":{}}'),
  ) as PackageJson;
  const languages = [
    ...new Set(
      allFiles
        .map((file) =>
          file.endsWith(".ts")
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
  const modules: ExtractedModule[] = [];
  const relationships: ExtractedRelationship[] = [];
  const tests: ExtractedTest[] = [];
  const warnings: ValidationProblem[] = [];

  for (const file of allFiles.filter((candidate) => candidate.endsWith(".ts"))) {
    const sourceText = await readFile(path.join(root, file), "utf8");
    const sourceFile = ts.createSourceFile(
      file,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
    );
    const exports: string[] = [];
    sourceFile.forEachChild((node) => {
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
    });
    modules.push({ path: file, exports: exports.sort() });
    for (const diagnostic of (sourceFile as ParsedSourceFile).parseDiagnostics ?? []) {
      warnings.push({
        code: "UNSUPPORTED_SYNTAX",
        message: ts.flattenDiagnosticMessageText(diagnostic.messageText, "\n"),
        location: file,
      });
    }
  }

  const files = new Map<string, string>();
  files.set(
    `${manifest.paths.extracted}/repository.yaml`,
    stableYaml({
      schema_version: 1,
      extractor: "repository-metadata",
      repository: {
        id: manifest.repository.id,
        name: manifest.repository.name,
        package_manager: "pnpm",
        languages,
      },
      scripts: Object.fromEntries(Object.entries(packageJson.scripts ?? {}).sort()),
    }),
  );
  files.set(
    `${manifest.paths.extracted}/components.yaml`,
    stableYaml({
      schema_version: 1,
      extractor: "typescript-modules",
      components: modules.sort((left, right) => left.path.localeCompare(right.path)),
    }),
  );
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
  return ok({ files, warnings }, warnings);
}

export async function writeExtraction(
  root: string,
  result: ExtractionResult,
): Promise<void> {
  for (const [filePath, content] of result.files) {
    await mkdir(path.dirname(path.join(root, filePath)), { recursive: true });
    await writeFile(path.join(root, filePath), content);
  }
}
