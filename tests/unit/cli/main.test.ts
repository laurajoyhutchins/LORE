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
    expect(stdout).toHaveBeenCalledWith(
      expect.stringContaining("verify-self"),
    );
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
