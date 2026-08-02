import { readFile } from "node:fs/promises";

export const SCHEMA_VERSIONS = Object.freeze({
  manifest: 1,
  record: 1,
  proposal: 1,
  task: 1,
  hydration: 1,
  transaction: 1,
} as const);

export interface LoreVersionInfo {
  name: string;
  version: string;
  node: string;
  schema_versions: typeof SCHEMA_VERSIONS;
}

interface PackageIdentity {
  name: string;
  version: string;
}

export async function createVersionInfo(): Promise<LoreVersionInfo> {
  const packageUrl = new URL("../../package.json", import.meta.url);
  const parsed = JSON.parse(
    await readFile(packageUrl, "utf8"),
  ) as Partial<PackageIdentity>;
  if (
    parsed.name !== "@laurajoyhutchins/lore" ||
    typeof parsed.version !== "string"
  ) {
    throw new Error("Installed LORE package metadata is invalid");
  }
  return {
    name: parsed.name,
    version: parsed.version,
    node: process.versions.node,
    schema_versions: SCHEMA_VERSIONS,
  };
}
