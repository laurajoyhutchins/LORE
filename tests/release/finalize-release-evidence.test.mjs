import { describe, expect, it } from "vitest";
import { finalizeEvidence } from "../../scripts/finalize-release-evidence.mjs";

function baseEvidence() {
  return {
    schema_version: 1,
    package: {
      name: "@laurajoyhutchins/lore",
      version: "0.0.0-bootstrap.0",
    },
    source: {
      repository: "laurajoyhutchins/LORE",
      tag: "v0.0.0-bootstrap.0",
      commit: "a".repeat(40),
    },
    artifact: {
      filename: "laurajoyhutchins-lore-0.0.0-bootstrap.0.tgz",
      bytes: 123,
      sha256: "b".repeat(64),
      integrity: `sha512-${Buffer.alloc(64, 0x43).toString("base64")}`,
    },
    files: [{ path: "package/package.json" }],
    platforms: [],
  };
}

function report(platform, passed = true) {
  return {
    schema_version: 1,
    platform,
    node: "22.14.0",
    modes: [
      { mode: "local", passed },
      { mode: "global", passed: true },
    ],
  };
}

describe("finalizeEvidence", () => {
  it("requires all three passing platforms in stable order", () => {
    const base = baseEvidence();
    const result = finalizeEvidence(base, [
      report("win32"),
      report("linux"),
      report("darwin"),
    ]);

    expect(result).toEqual({
      ...base,
      platforms: [report("linux"), report("darwin"), report("win32")],
    });
    expect(base.platforms).toEqual([]);
  });

  it.each([
    [
      "missing",
      [report("linux"), report("darwin")],
      "PLATFORM_REPORT_SET_INVALID",
    ],
    [
      "duplicate",
      [report("linux"), report("linux"), report("win32")],
      "PLATFORM_REPORT_SET_INVALID",
    ],
    [
      "unknown",
      [report("linux"), report("darwin"), report("freebsd")],
      "PLATFORM_REPORT_SET_INVALID",
    ],
    [
      "failed mode",
      [report("linux", false), report("darwin"), report("win32")],
      "PLATFORM_SMOKE_FAILED",
    ],
  ])("rejects %s reports", (_name, reports, code) => {
    expect(() => finalizeEvidence(baseEvidence(), reports)).toThrow(code);
  });

  it("rejects a base document that already contains platform claims", () => {
    const base = baseEvidence();
    base.platforms = [report("linux")];
    expect(() =>
      finalizeEvidence(base, [
        report("linux"),
        report("darwin"),
        report("win32"),
      ]),
    ).toThrow("BASE_RELEASE_EVIDENCE_INVALID");
  });
});
