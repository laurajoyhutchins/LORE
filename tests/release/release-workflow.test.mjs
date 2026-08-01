import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

async function readWorkflow(path) {
  const text = await readFile(path, "utf8");
  return { text, workflow: parse(text) };
}

describe("release workflow authority", () => {
  it("runs only for published GitHub Releases", async () => {
    const { text, workflow } = await readWorkflow(
      ".github/workflows/release.yml",
    );

    expect(workflow.on).toEqual({ release: { types: ["published"] } });
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(text).not.toMatch(
      /\b(?:push|pull_request|workflow_dispatch|workflow_call):/u,
    );
    expect(text).not.toContain("target_commitish");
    expect(text).not.toContain("NODE_AUTH_TOKEN");
    expect(text).not.toContain("NPM_TOKEN");
    expect(text).not.toContain("--provenance");
  });

  it("builds once and tests the canonical tarball on three platforms", async () => {
    const { workflow } = await readWorkflow(".github/workflows/release.yml");
    const build = JSON.stringify(workflow.jobs.build);
    const smoke = JSON.stringify(workflow.jobs.smoke);
    const identityStep = workflow.jobs.build.steps.find(
      (step) => step.name === "Verify release identity",
    );

    expect(build).toContain("actions/checkout@v6");
    expect(build).toContain("actions/setup-node@v6");
    expect(build).toContain("actions/upload-artifact@v4");
    expect(build).toContain("EVENT_SHA");
    expect(build).toContain("REPOSITORY_PRIVATE");
    expect(identityStep?.run).toContain(
      'test "$REPOSITORY_PRIVATE" = "false"',
    );
    expect(build).toContain(
      "node scripts/public-release-gate.mjs --skip-installed-package",
    );
    expect(build.match(/release:package/gu)).toHaveLength(1);
    expect(workflow.jobs.smoke.needs).toBe("build");
    expect(workflow.jobs.smoke.strategy.matrix.os).toEqual([
      "ubuntu-latest",
      "macos-latest",
      "windows-latest",
    ]);
    expect(smoke).toContain("actions/download-artifact@v4");
    expect(smoke).toContain("release:smoke");
    expect(smoke).not.toContain("release:package");
    expect(smoke).not.toContain("npm pack");
    expect(smoke).not.toMatch(/pnpm (?:run )?build/u);
  });

  it("separates bootstrap attachment from stable OIDC publication", async () => {
    const { workflow } = await readWorkflow(".github/workflows/release.yml");
    const bootstrap = workflow.jobs["bootstrap-attach"];
    const publish = workflow.jobs.publish;

    expect(bootstrap.permissions).toEqual({ contents: "write" });
    expect(bootstrap.environment).toBeUndefined();
    expect(JSON.stringify(bootstrap)).toContain(
      "node scripts/attach-release-assets.mjs",
    );
    expect(JSON.stringify(bootstrap)).not.toContain("publish-package.mjs");

    expect(publish.environment).toBe("npm");
    expect(publish.permissions).toEqual({
      contents: "write",
      "id-token": "write",
    });
    expect(JSON.stringify(publish)).toContain(
      "node scripts/publish-package.mjs",
    );
    expect(JSON.stringify(publish)).toContain(
      "node scripts/attach-release-assets.mjs",
    );

    for (const [name, job] of Object.entries(workflow.jobs)) {
      if (name === "publish") continue;
      expect(job.permissions?.["id-token"]).toBeUndefined();
    }
  });
});

describe("ordinary CI authority", () => {
  it("retains read-only authority and the unified release gate", async () => {
    const { text, workflow } = await readWorkflow(".github/workflows/ci.yml");
    const checkout = workflow.jobs.verify.steps[0];

    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(checkout.uses).toBe("actions/checkout@v6");
    expect(checkout.with.ref).toBe(
      "${{ github.event.pull_request.head.sha || github.sha }}",
    );
    expect(text).toContain("actions/setup-node@v6");
    expect(text).toContain("node scripts/public-release-gate.mjs");
    expect(text).not.toContain("--skip-installed-package");
    expect(text).not.toContain("actions/upload-artifact");
    expect(text).not.toContain("id-token: write");
    expect(text).not.toContain("npm publish");
  });
});
