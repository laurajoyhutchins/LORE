import { describe, expect, it } from "vitest";
import {
  classifyPublishedVersion,
  parsePublishedIntegrityOutput,
  publicationEnvironment,
} from "../../scripts/lib/npm-registry.mjs";

const INTEGRITY_A = `sha512-${Buffer.alloc(64, 0x41).toString("base64")}`;
const INTEGRITY_B = `sha512-${Buffer.alloc(64, 0x42).toString("base64")}`;

describe("npm immutable version classification", () => {
  it("classifies absent, matching, and conflicting versions", () => {
    expect(classifyPublishedVersion(INTEGRITY_A, null)).toBe("absent");
    expect(classifyPublishedVersion(INTEGRITY_A, INTEGRITY_A)).toBe(
      "matching",
    );
    expect(classifyPublishedVersion(INTEGRITY_A, INTEGRITY_B)).toBe(
      "conflict",
    );
  });

  it.each([
    ["expected", "sha512-not base64", null],
    ["expected", `sha512-${Buffer.alloc(63).toString("base64")}`, null],
    ["observed", INTEGRITY_A, "sha1-QUFBQQ=="],
    ["observed", INTEGRITY_A, "sha512-***"],
  ])("rejects malformed %s integrity", (_name, expected, observed) => {
    expect(() => classifyPublishedVersion(expected, observed)).toThrow(
      "NPM_INTEGRITY_INVALID",
    );
  });
});

describe("npm view parsing", () => {
  it("parses the JSON string returned by npm view", () => {
    expect(
      parsePublishedIntegrityOutput(`${JSON.stringify(INTEGRITY_A)}\n`),
    ).toBe(INTEGRITY_A);
  });

  it.each(["", "null", "{}", "[]", '"sha1-QUFBQQ=="'])(
    "rejects invalid npm view output %s",
    (output) => {
      expect(() => parsePublishedIntegrityOutput(output)).toThrow(
        "NPM_VIEW_OUTPUT_INVALID",
      );
    },
  );
});

describe("trusted publication environment", () => {
  it("removes token fallbacks", () => {
    expect(
      publicationEnvironment({
        PATH: "/bin",
        NODE_AUTH_TOKEN: "secret",
        NPM_TOKEN: "secret",
        KEEP_ME: "yes",
      }),
    ).toEqual({ PATH: "/bin", KEEP_ME: "yes" });
  });
});
