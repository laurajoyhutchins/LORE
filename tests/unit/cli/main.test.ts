import { describe, expect, it, vi } from "vitest";
import { runCli, type CliIo } from "../../../src/cli/main.js";

describe("runCli", () => {
  it("prints stable help for --help", async () => {
    const stdout = vi.fn();
    const stderr = vi.fn();
    const io: CliIo = { stdout, stderr };

    const exitCode = await runCli(["--help"], io);

    expect(exitCode).toBe(0);
    expect(stderr).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      expect.stringContaining("LORE Organizes Repository Evidence"),
    );
    expect(stdout).toHaveBeenCalledWith(expect.stringContaining("version"));
    expect(stdout).toHaveBeenCalledWith(
      expect.stringContaining("verify-self"),
    );
  });

  it("reports the installed package outside a LORE repository", async () => {
    const stdout = vi.fn();
    const stderr = vi.fn();

    expect(await runCli(["version"], { stdout, stderr })).toBe(0);
    expect(stderr).not.toHaveBeenCalled();
    expect(stdout).toHaveBeenCalledWith(
      "@laurajoyhutchins/lore 0.0.0-bootstrap.0",
    );
  });

  it("reports stable version JSON", async () => {
    const stdout = vi.fn();

    expect(
      await runCli(["version", "--json"], { stdout, stderr: vi.fn() }),
    ).toBe(0);
    expect(JSON.parse(String(stdout.mock.calls[0]?.[0]))).toEqual({
      name: "@laurajoyhutchins/lore",
      version: "0.0.0-bootstrap.0",
      node: process.versions.node,
      schema_versions: {
        manifest: 1,
        record: 1,
        proposal: 1,
        task: 1,
        hydration: 1,
        transaction: 1,
      },
    });
  });

  it("returns usage failure for an unknown command", async () => {
    const stdout = vi.fn();
    const stderr = vi.fn();

    const exitCode = await runCli(["not-a-command"], { stdout, stderr });

    expect(exitCode).toBe(2);
    expect(stderr).toHaveBeenCalledWith(
      expect.stringContaining("Unknown command: not-a-command"),
    );
  });
});
