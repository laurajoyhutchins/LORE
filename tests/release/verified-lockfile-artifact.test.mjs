import { gunzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { createVerifiedLockfileArtifact } from "../../scripts/refresh-verified-lockfile-artifact.mjs";

describe("verified lockfile artifact", () => {
  it("splits, compresses, and identifies the lockfile deterministically", () => {
    const input = Buffer.from("lockfile\n".repeat(2_100), "utf8");
    const first = createVerifiedLockfileArtifact(input);
    const second = createVerifiedLockfileArtifact(input);

    expect(first.manifest).toEqual(second.manifest);
    expect(first.parts.map(({ compressed }) => compressed)).toEqual(
      second.parts.map(({ compressed }) => compressed),
    );
    expect(first.manifest.parts.map(({ raw_bytes }) => raw_bytes)).toEqual([
      8_000,
      8_000,
      input.length - 16_000,
    ]);
    expect(
      gunzipSync(Buffer.concat(first.parts.map(({ compressed }) => compressed))),
    ).toEqual(input);
  });

  it("rejects an empty input", () => {
    expect(() => createVerifiedLockfileArtifact(Buffer.alloc(0))).toThrow(
      "LOCKFILE_ARTIFACT_INPUT_INVALID",
    );
  });
});
