import type { LoreVersionInfo } from "../release/metadata.js";

export function formatVersion(info: LoreVersionInfo, json: boolean): string {
  return json ? JSON.stringify(info, null, 2) : `${info.name} ${info.version}`;
}
