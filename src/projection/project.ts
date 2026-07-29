import { ok } from "../domain/errors.js";
import type { ValidatedRepository, ValidationResult } from "../domain/types.js";
import {
  renderArchitecture,
  renderCatalog,
  renderDecisions,
  renderGuide,
  renderReadme,
  renderRepositoryCard,
} from "./templates.js";

export function projectRepository(
  repository: ValidatedRepository,
): Promise<ValidationResult<Map<string, string>>> {
  const files = new Map<string, string>();
  for (const projection of repository.manifest.projections) {
    const renderers = {
      readme: renderReadme,
      "repository-card": renderRepositoryCard,
      architecture: renderArchitecture,
      "component-catalog": renderCatalog,
      "current-decisions": renderDecisions,
      "maintainer-guide": renderGuide,
    };
    const content = renderers[projection.id](repository);
    files.set(
      projection.output,
      content.replace(/\r\n/g, "\n").replace(/\n*$/, "\n"),
    );
  }
  return Promise.resolve(ok(files));
}
