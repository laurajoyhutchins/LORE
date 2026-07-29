import { expect, it } from "vitest";
import type { HydrationPacket } from "../../../src/domain/types.js";
import {
  HYDRATION_SNAPSHOT_REVISION,
  normalizeHydrationPacketForSnapshot,
} from "../../../src/hydration/hydrate.js";

it("normalizes only the volatile revision in checked-in hydration snapshots", () => {
  const packet = {
    schema_version: 1,
    repository_revision: "0123456789abcdef0123456789abcdef01234567",
    selected: [],
    evidence: [],
    validation_commands: [],
    omitted_record_count: 0,
    task: {},
  } as unknown as HydrationPacket;

  const normalized = normalizeHydrationPacketForSnapshot(packet);

  expect(normalized.repository_revision).toBe(HYDRATION_SNAPSHOT_REVISION);
  expect(packet.repository_revision).toBe("0123456789abcdef0123456789abcdef01234567");
  expect(normalized.selected).toBe(packet.selected);
});
