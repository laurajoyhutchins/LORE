export const COMMANDS = [
  "init",
  "extract",
  "validate",
  "project",
  "context",
  "hydrate",
  "validate-proposal",
  "apply",
  "diff",
  "explain",
  "verify-self",
  "demo",
] as const;

export type LoreCommand = (typeof COMMANDS)[number];

export const HELP_TEXT = `LORE Organizes Repository Evidence

Usage:
  lore <command> [options]

Commands:
${COMMANDS.map((command) => `  ${command}`).join("\n")}

Options:
  -h, --help  Show this help message
`;

export function isLoreCommand(value: string): value is LoreCommand {
  return COMMANDS.some((command) => command === value);
}
