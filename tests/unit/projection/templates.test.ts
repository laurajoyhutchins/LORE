import { expect, it } from "vitest";
import type { ValidatedRepository } from "../../../src/domain/types.js";
import {
  renderReadme,
  renderRepositoryCard,
} from "../../../src/projection/templates.js";

function repository(): ValidatedRepository {
  return {
    revision: "0123456789abcdef0123456789abcdef01234567",
    records: [],
    effectiveStatus: new Map(),
    manifest: {
      repository: { id: "example", name: "Example", root: "." },
    },
  } as unknown as ValidatedRepository;
}

it("documents the installed CLI-only package", () => {
  const readme = renderReadme(repository());

  expect(readme).toContain(
    "npm install --save-dev @laurajoyhutchins/lore",
  );
  expect(readme).toContain("npm exec lore -- --help");
  expect(readme).toContain("npm exec lore -- version --json");
  expect(readme).toContain("CLI-only");
  expect(readme).toContain("## Source development");
  expect(readme).toContain("Corepack");
  expect(readme).toContain("pnpm 10.14.0");
  expect(readme).not.toContain('keeps `"private": true`');
  expect(readme.indexOf("## Install")).toBeLessThan(
    readme.indexOf("## Source development"),
  );
});

it("keeps the checked-in repository card independent of HEAD", () => {
  const example = repository();

  const card = renderRepositoryCard(example);

  expect(card).toContain("- ID: `example`");
  expect(card).toContain("- Records: 0");
  expect(card).not.toContain(example.revision);
});
