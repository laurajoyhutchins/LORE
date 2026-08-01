import { describe, expect, it } from "vitest";
import {
  SMOKE_COMMAND_TIMEOUT_MS,
  npmExecArguments,
  npmInstallArguments,
} from "../../scripts/lib/smoke-command-policy.mjs";

describe("installed smoke command policy", () => {
  it("bounds every child command", () => {
    expect(SMOKE_COMMAND_TIMEOUT_MS).toBe(120_000);
  });

  it("installs without audit, funding, lockfile, or lifecycle side effects", () => {
    expect(npmInstallArguments("package.tgz")).toEqual([
      "install",
      "--no-audit",
      "--no-fund",
      "--ignore-scripts",
      "--package-lock=false",
      "package.tgz",
    ]);
    expect(
      npmInstallArguments("package.tgz", {
        global: true,
        prefix: "/tmp/lore-prefix",
      }),
    ).toEqual([
      "install",
      "--no-audit",
      "--no-fund",
      "--ignore-scripts",
      "--package-lock=false",
      "--global",
      "--prefix",
      "/tmp/lore-prefix",
      "package.tgz",
    ]);
  });

  it("forces npm exec to use the installed local binary offline", () => {
    expect(npmExecArguments(["version", "--json"])).toEqual([
      "exec",
      "--offline",
      "--yes=false",
      "--",
      "lore",
      "version",
      "--json",
    ]);
  });

  it("rejects an invalid global prefix", () => {
    expect(() =>
      npmInstallArguments("package.tgz", { global: true, prefix: "" }),
    ).toThrow("SMOKE_GLOBAL_PREFIX_INVALID");
  });
});
