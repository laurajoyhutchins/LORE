import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { inspectPackageArtifact } from "../../scripts/lib/package-contract.mjs";

const BLOCK = 512;
const COMMIT = "a".repeat(40);
const REQUIRED = [
  "package/package.json",
  "package/README.md",
  "package/LICENSE",
  "package/BOOTSTRAP.md",
  "package/dist/cli/main.js",
  "package/schemas/manifest.schema.json",
  "package/schemas/record.schema.json",
  "package/schemas/proposal.schema.json",
  "package/schemas/task.schema.json",
  "package/schemas/hydration.schema.json",
  "package/schemas/extracted-facts.schema.json",
  "package/schemas/transaction.schema.json",
  "package/skills/maintain-repository-documentation/SKILL.md",
  "package/skills/maintain-repository-documentation/INPUTS.md",
  "package/skills/maintain-repository-documentation/OUTPUTS.md",
  "package/skills/maintain-repository-documentation/schemas/proposal.schema.json",
];

function writeString(buffer, offset, length, value) {
  buffer.write(value, offset, Math.min(length, Buffer.byteLength(value)), "utf8");
}

function writeOctal(buffer, offset, length, value) {
  writeString(
    buffer,
    offset,
    length,
    `${value.toString(8).padStart(length - 1, "0")}\0`,
  );
}

function writeChecksum(header) {
  header.fill(0x20, 148, 156);
  const checksum = header.reduce((sum, byte) => sum + byte, 0);
  writeString(
    header,
    148,
    8,
    `${checksum.toString(8).padStart(6, "0")}\0 `,
  );
}

function makeHeader({ name, mode = 0o644, size, type = "0" }) {
  const header = Buffer.alloc(BLOCK);
  let fileName = name;
  let prefix = "";
  if (Buffer.byteLength(fileName) > 100) {
    const split = fileName.lastIndexOf("/");
    prefix = fileName.slice(0, split);
    fileName = fileName.slice(split + 1);
  }
  writeString(header, 0, 100, fileName);
  writeOctal(header, 100, 8, mode);
  writeOctal(header, 108, 8, 0);
  writeOctal(header, 116, 8, 0);
  writeOctal(header, 124, 12, size);
  writeOctal(header, 136, 12, 0);
  writeString(header, 156, 1, type);
  writeString(header, 257, 6, "ustar\0");
  writeString(header, 263, 2, "00");
  writeString(header, 345, 155, prefix);
  writeChecksum(header);
  return header;
}

function makeTarGzip(entries) {
  const parts = [];
  for (const entry of entries) {
    const content = Buffer.from(entry.content ?? "");
    parts.push(
      makeHeader({
        name: entry.name,
        mode: entry.mode,
        size: content.length,
        type: entry.type,
      }),
      content,
      Buffer.alloc((BLOCK - (content.length % BLOCK)) % BLOCK),
    );
  }
  parts.push(Buffer.alloc(BLOCK * 2));
  return gzipSync(Buffer.concat(parts));
}

function packageManifest() {
  return JSON.stringify({
    name: "@laurajoyhutchins/lore",
    version: "0.0.0-bootstrap.0",
    type: "module",
    bin: { lore: "./dist/cli/main.js" },
    engines: { node: ">=22" },
    publishConfig: { access: "public" },
  });
}

function validEntries() {
  return REQUIRED.map((name) => ({
    name,
    mode: name === "package/dist/cli/main.js" ? 0o755 : 0o644,
    content:
      name === "package/package.json"
        ? packageManifest()
        : name === "package/dist/cli/main.js"
          ? "#!/usr/bin/env node\nconsole.log('lore');\n"
          : name.endsWith(".json")
            ? "{}\n"
            : `${name}\n`,
  }));
}

async function withTarball(entries, run) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "lore-package-contract-"));
  const tarballPath = path.join(
    directory,
    "laurajoyhutchins-lore-0.0.0-bootstrap.0.tgz",
  );
  await writeFile(tarballPath, makeTarGzip(entries));
  try {
    return await run(tarballPath);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function inspect(tarballPath, overrides = {}) {
  return inspectPackageArtifact({
    tarballPath,
    repository: "laurajoyhutchins/LORE",
    tag: "v0.0.0-bootstrap.0",
    commit: COMMIT,
    ...overrides,
  });
}

describe("inspectPackageArtifact", () => {
  it("returns sorted evidence for the exact CLI artifact", async () => {
    await withTarball(validEntries(), async (tarballPath) => {
      const evidence = await inspect(tarballPath);

      expect(evidence).toMatchObject({
        schema_version: 1,
        package: {
          name: "@laurajoyhutchins/lore",
          version: "0.0.0-bootstrap.0",
        },
        source: {
          repository: "laurajoyhutchins/LORE",
          tag: "v0.0.0-bootstrap.0",
          commit: COMMIT,
        },
        artifact: {
          filename: "laurajoyhutchins-lore-0.0.0-bootstrap.0.tgz",
        },
        platforms: [],
      });
      expect(evidence.artifact.bytes).toBeGreaterThan(0);
      expect(evidence.artifact.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(evidence.artifact.integrity).toMatch(/^sha512-/);
      expect(evidence.files.map(({ path: filePath }) => filePath)).toEqual(
        [...REQUIRED].sort(),
      );
    });
  });

  it.each([
    ["package/src/index.ts", "PACKAGE_PATH_NOT_ALLOWED"],
    ["package/tests/main.test.ts", "PACKAGE_PATH_NOT_ALLOWED"],
    ["package/scripts/release.mjs", "PACKAGE_PATH_NOT_ALLOWED"],
    ["package/.lore/records/x.yaml", "PACKAGE_PATH_NOT_ALLOWED"],
  ])("rejects disallowed path %s", async (name, code) => {
    await withTarball(
      [...validEntries(), { name, content: "x" }],
      async (tarballPath) => {
        await expect(inspect(tarballPath)).rejects.toThrow(code);
      },
    );
  });

  it("rejects missing required files", async () => {
    const entries = validEntries().filter(
      ({ name }) => name !== "package/BOOTSTRAP.md",
    );
    await withTarball(entries, async (tarballPath) => {
      await expect(inspect(tarballPath)).rejects.toThrow(
        "PACKAGE_REQUIRED_FILE_MISSING",
      );
    });
  });

  it.each([
    [
      "symlink",
      (entries) => [
        ...entries,
        { name: "package/dist/link.js", type: "2", content: "main.js" },
      ],
      "PACKAGE_ENTRY_TYPE_NOT_ALLOWED",
    ],
    [
      "binary file",
      (entries) => [
        ...entries,
        { name: "package/dist/binary.js", content: Buffer.from([0]) },
      ],
      "PACKAGE_FILE_BINARY",
    ],
    [
      "non-executable CLI",
      (entries) =>
        entries.map((entry) =>
          entry.name === "package/dist/cli/main.js"
            ? { ...entry, mode: 0o644 }
            : entry,
        ),
      "PACKAGE_CLI_NOT_EXECUTABLE",
    ],
    [
      "invalid CLI shebang",
      (entries) =>
        entries.map((entry) =>
          entry.name === "package/dist/cli/main.js"
            ? { ...entry, content: "console.log('lore');\n" }
            : entry,
        ),
      "PACKAGE_CLI_SHEBANG_INVALID",
    ],
  ])("rejects %s", async (_name, mutate, code) => {
    await withTarball(mutate(validEntries()), async (tarballPath) => {
      await expect(inspect(tarballPath)).rejects.toThrow(code);
    });
  });

  it.each([
    [
      { repository: "other/repository" },
      "PACKAGE_REPOSITORY_INVALID",
    ],
    [{ tag: "v0.1.0" }, "PACKAGE_TAG_MISMATCH"],
    [{ commit: "abc" }, "PACKAGE_COMMIT_INVALID"],
  ])("rejects invalid source identity %#", async (overrides, code) => {
    await withTarball(validEntries(), async (tarballPath) => {
      await expect(inspect(tarballPath, overrides)).rejects.toThrow(code);
    });
  });
});
