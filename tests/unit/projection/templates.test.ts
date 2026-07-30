import { expect, it } from "vitest";
import type { ValidatedRepository } from "../../../src/domain/types.js";
import { renderRepositoryCard } from "../../../src/projection/templates.js";

it("keeps the checked-in repository card independent of HEAD", () => {
  const repository = {
    revision: "0123456789abcdef0123456789abcdef01234567",
    records: [],
    effectiveStatus: new Map(),
    manifest: { repository: { id: "example", name: "Example", root: "." } },
  } as unknown as ValidatedRepository;

  const card = renderRepositoryCard(repository);

  expect(card).toContain("- ID: `example`");
  expect(card).toContain("- Records: 0");
  expect(card).not.toContain(repository.revision);
});
