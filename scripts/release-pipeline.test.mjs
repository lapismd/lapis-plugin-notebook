import { existsSync, readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

describe("Notebook automatic Changesets releases", () => {
  it("keeps the canonical release version aligned with both public manifests", () => {
    const read = (path) =>
      readFileSync(new URL("../" + path, import.meta.url), "utf8");
    const pkg = JSON.parse(read("package.json"));
    const manifest = JSON.parse(read("manifest.json"));
    const chapter = read("spec/src/plugins/notebook/index.md");
    const declared = chapter.match(
      /Release package and runtime manifest version: `(\d+\.\d+\.\d+)`\./,
    )?.[1];
    expect(declared).toBe(pkg.version);
    expect(manifest.version).toBe(pkg.version);
  });
  it("configures Changesets for the public root package", () => {
    expect(
      existsSync(new URL("../.changeset/config.json", import.meta.url)),
    ).toBe(true);
    const config = JSON.parse(
      readFileSync(
        new URL("../.changeset/config.json", import.meta.url),
        "utf8",
      ),
    );
    expect(config.baseBranch).toBe("main");
    expect(config.privatePackages).toEqual({ version: false, tag: false });
  });
  it("opens a version PR automatically on main pushes", () => {
    expect(
      existsSync(
        new URL("../.github/workflows/version-packages.yml", import.meta.url),
      ),
    ).toBe(true);
    const workflow = parse(
      readFileSync(
        new URL("../.github/workflows/version-packages.yml", import.meta.url),
        "utf8",
      ),
    );
    expect(workflow.on.push.branches).toEqual(["main"]);
    expect(workflow.jobs.version.if).toBe(
      "github.ref == 'refs/heads/main' && vars.LAPIS_DEPENDENCY_VERSION_PR_ENABLED == 'true'",
    );
    const action = workflow.jobs.version.steps.find((step) =>
      step.uses?.startsWith("changesets/action@"),
    );
    expect(action.with.version).toBe("pnpm release:version");
    expect(action.with.commitMode).toBe("github-api");
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(action.env.GITHUB_TOKEN).toBe("${{ steps.app.outputs.token }}");
    const app = workflow.jobs.version.steps.find((step) => step.id === "app");
    expect(app.with.owner).toBe("${{ github.repository_owner }}");
    expect(app.with.repositories).toBe("${{ github.event.repository.name }}");
    expect(app.with["permission-contents"]).toBe("write");
    expect(app.with["permission-pull-requests"]).toBe("write");
    expect(action.with.publish).toBeUndefined();
    expect(action.with.createGithubReleases).toBe(false);
  });
  it("qualifies one immutable artifact before allowing main-source publication", () => {
    const workflow = parse(
      readFileSync(
        new URL("../.github/workflows/ci.yml", import.meta.url),
        "utf8",
      ),
    );
    const artifact = workflow.jobs.package.steps.find((step) =>
      step.uses?.startsWith("actions/upload-artifact@"),
    );
    expect(artifact.with.name).toBe("notebook-npm-${{ github.sha }}");
    expect(artifact.with["include-hidden-files"]).toBe(true);
    expect(
      workflow.jobs.package.steps.some(
        (step) => step.run === "node scripts/release.mjs prepare",
      ),
    ).toBe(true);
    expect(workflow.jobs["release-plan"].needs).toBe("validate");
    expect(workflow.jobs["release-plan"].if).toContain(
      "github.ref == 'refs/heads/main'",
    );
    expect(workflow.jobs["release-plan"].if).toContain(
      "github.event_name != 'pull_request'",
    );
    const notification = workflow.jobs["notify-dependencies"];
    expect(notification.needs).toEqual(["publish"]);
    expect(notification.if).toBe(
      "always() && needs.publish.result == 'success'",
    );
    expect(notification.with["source-sha"]).toBe("${{ github.sha }}");
    const publish = workflow.jobs.publish;
    expect(publish.needs).toEqual(["validate", "release-plan"]);
    expect(publish.if).toBe("needs.release-plan.outputs.publish == 'true'");
    expect(publish.environment).toBe("npm-production");
    expect(publish.permissions).toEqual({
      contents: "write",
      "id-token": "write",
    });
    expect(
      publish.steps.find((step) =>
        step.uses?.startsWith("actions/download-artifact@"),
      ).with.name,
    ).toBe(artifact.with.name);
    expect(
      publish.steps.find((step) => step.run === "pnpm release:publish").env
        .LAPIS_NOTEBOOK_RELEASE_APPROVED,
    ).toBe("1");
    expect(workflow.concurrency["cancel-in-progress"]).toBe(
      "${{ github.event_name == 'pull_request' }}",
    );
  });
});
