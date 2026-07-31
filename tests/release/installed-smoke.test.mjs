import { createHash } from "node:crypto";
import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import {
  createSmokeReport,
  globalExecutable,
  globalPathDirectory,
  localExecutable,
  packageIdentityFromTarballBytes,
  sanitizedEnvironment,
  verifyArtifactEvidence,
} from "../../scripts/smoke-installed-package.mjs";

const BLOCK = 512;

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

function makeTarball(entries) {
  const parts = [];
  for (const entry of entries) {
    const content = Buffer.from(entry.content);
    const header = Buffer.alloc(BLOCK);
    writeString(header, 0, 100, entry.name);
    writeOctal(header, 100, 8, entry.mode ?? 0o644);
    writeOctal(header, 108, 8, 0);
    writeOctal(header, 116, 8, 0);
    writeOctal(header, 124, 12, content.length);
    writeOctal(header, 136, 12, 0);
    writeString(header, 156, 1, "0");
    writeString(header, 257, 6, "ustar\0");
    writeString(header, 263, 2, "00");
    writeChecksum(header);
    parts.push(
      header,
      content,
      Buffer.alloc((BLOCK - (content.length % BLOCK)) % BLOCK),
    );
  }
  parts.push(Buffer.alloc(BLOCK * 2));
  return gzipSync(Buffer.concat(parts));
}

function identityTarball() {
  return makeTarball([
    {
      name: "package/package.json",
      content: JSON.stringify({
        name: "@laurajoyhutchins/lore",
        version: "0.0.0-bootstrap.0",
        bin: { lore: "./dist/cli/main.js" },
      }),
    },
  ]);
}

describe("installed CLI paths", () => {
  it("resolves isolated global wrappers", () => {
    expect(globalExecutable("win32")).toBe("lore.cmd");
    expect(globalPathDirectory("C:\\prefix", "win32")).toBe("C:\\prefix");
    expect(globalExecutable("linux")).toBe("lore");
    expect(globalPathDirectory("/tmp/prefix", "linux")).toBe(
      "/tmp/prefix/bin",
    );
  });

  it("resolves local npm wrappers", () => {
    expect(localExecutable("C:\\consumer", "win32")).toBe(
      "C:\\consumer\\node_modules\\.bin\\lore.cmd",
    );
    expect(localExecutable("/tmp/consumer", "linux")).toBe(
      "/tmp/consumer/node_modules/.bin/lore",
    );
  });
});

describe("installed smoke environment", () => {
  it("removes source-checkout escape hatches", () => {
    const environment = sanitizedEnvironment({
      PATH: "/bin",
      NODE_PATH: "/source/node_modules",
      TSX_TSCONFIG_PATH: "/source/tsconfig.json",
      LORE_SOURCE_ROOT: "/source",
      LORE_SOURCE_OTHER: "x",
      KEEP_ME: "yes",
    });

    expect(environment).toEqual({ PATH: "/bin", KEEP_ME: "yes" });
  });
});

describe("installed package identity", () => {
  it("reads the exact package name, version, and bin from the tarball", () => {
    expect(packageIdentityFromTarballBytes(identityTarball())).toEqual({
      name: "@laurajoyhutchins/lore",
      version: "0.0.0-bootstrap.0",
    });
  });

  it("rejects a package with the wrong executable mapping", () => {
    const bytes = makeTarball([
      {
        name: "package/package.json",
        content: JSON.stringify({
          name: "@laurajoyhutchins/lore",
          version: "0.0.0-bootstrap.0",
          bin: { other: "./dist/cli/main.js" },
        }),
      },
    ]);

    expect(() => packageIdentityFromTarballBytes(bytes)).toThrow(
      "SMOKE_PACKAGE_IDENTITY_INVALID",
    );
  });

  it("requires the tarball bytes to match release evidence", () => {
    const bytes = identityTarball();
    const identity = packageIdentityFromTarballBytes(bytes);
    const evidence = {
      package: identity,
      artifact: {
        filename: "package.tgz",
        sha256: createHash("sha256").update(bytes).digest("hex"),
        integrity: `sha512-${createHash("sha512")
          .update(bytes)
          .digest("base64")}`,
      },
    };

    expect(() =>
      verifyArtifactEvidence(bytes, "package.tgz", identity, evidence),
    ).not.toThrow();
    expect(() =>
      verifyArtifactEvidence(bytes, "package.tgz", identity, {
        ...evidence,
        artifact: { ...evidence.artifact, sha256: "a".repeat(64) },
      }),
    ).toThrow("SMOKE_ARTIFACT_EVIDENCE_MISMATCH");
  });
});

describe("smoke report", () => {
  it("records only requested passing modes", () => {
    expect(createSmokeReport("linux", "22.16.0", ["local", "global"]))
      .toEqual({
        schema_version: 1,
        platform: "linux",
        node: "22.16.0",
        modes: [
          { mode: "local", passed: true },
          { mode: "global", passed: true },
        ],
      });
  });
});
