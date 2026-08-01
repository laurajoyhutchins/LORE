import { describe, expect, it } from "vitest";
import { parseNpmPackFilename } from "../../scripts/lib/npm-pack-output.mjs";

describe("npm pack output", () => {
  it("extracts the JSON result after lifecycle output", () => {
    const result = JSON.stringify(
      [{ filename: "laurajoyhutchins-lore-0.0.0-bootstrap.0.tgz" }],
      null,
      2,
    );

    expect(
      parseNpmPackFilename(
        `\n> @laurajoyhutchins/lore@0.0.0-bootstrap.0 prepack\n> corepack pnpm build\n\n${result}\n`,
      ),
    ).toBe("laurajoyhutchins-lore-0.0.0-bootstrap.0.tgz");
  });

  it("parses direct JSON output", () => {
    expect(parseNpmPackFilename('[{"filename":"package.tgz"}]\n')).toBe(
      "package.tgz",
    );
  });

  it.each([
    "",
    "> package prepack\n> build\n",
    "{}",
    "[]",
    '[{"filename":""}]',
    '[{"name":"package"}]',
  ])("rejects invalid output %#", (output) => {
    expect(() => parseNpmPackFilename(output)).toThrow(
      "RELEASE_PACKAGE_NPM_OUTPUT_INVALID",
    );
  });
});
