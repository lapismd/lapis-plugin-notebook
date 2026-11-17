import { existsSync, readFileSync } from "node:fs";
import { parse } from "yaml";
import { describe, expect, it } from "vitest";

describe("Notebook dependency completion", () => {
  it("checks reviewed version inputs before merging dependency candidates", () => {
    const workflow = parse(
      readFileSync(
        new URL("../.github/workflows/ci.yml", import.meta.url),
        "utf8",
      ),
    );
    const quality = workflow.jobs.quality.steps;
    const guard = quality.find(
      (step) => step.name === "Guard reviewed version inputs before merge",
    );
    expect(guard?.uses).toMatch(
      /^lapismd\/lapis-ci\/actions\/guard-version-runtime@[a-f0-9]{40}$/,
    );
    expect(guard.with).toEqual({
      "qualification-file": ".github/versioning-runtime.json",
    });
    expect(guard.if).toBeUndefined();
    expect(quality.indexOf(guard)).toBeGreaterThan(
      quality.findIndex((step) => step.uses === "./.github/actions/ci-setup"),
    );
    const q = JSON.parse(
      readFileSync(
        new URL("../.github/versioning-runtime.json", import.meta.url),
        "utf8",
      ),
    );
    expect(q.workspacePolicy.developmentOverride).toEqual({
      dependency: "@lapismd/design-core",
      series: "0.13",
      minimumPatch: 4,
    });
    expect(q.workspacePolicy.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(q.files["pnpm-workspace.yaml"]).toBeUndefined();
    expect(Object.keys(q.files).sort()).toEqual([
      "scripts/release-candidate.mjs",
      "scripts/release.mjs",
    ]);
  });
  it("uses only the pinned trusted verifier after successful owned workflows", () => {
    const workflow = parse(
      readFileSync(
        new URL(
          "../.github/workflows/dependency-completed.yml",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    expect(workflow.on.workflow_run).toEqual({
      workflows: [
        "CI",
        "Publish Storybook to GitHub Pages",
        "Version packages",
      ],
      types: ["completed"],
    });
    expect(workflow.permissions).toEqual({
      contents: "read",
      actions: "read",
      "pull-requests": "read",
    });
    const job = workflow.jobs.notify;
    expect(job.if).toBe("github.event.workflow_run.conclusion == 'success'");
    expect(job.uses).toMatch(
      /^lapismd\/dependency-automation\/\.github\/workflows\/completion\.yml@[a-f0-9]{40}$/,
    );
    expect(job.with["automation-ref"]).toBe(job.uses.split("@")[1]);
    expect(job.steps).toBeUndefined();
    expect(job["runs-on"]).toBeUndefined();
    expect(job.secrets).toEqual({
      "app-private-key": "${{ secrets.LAPIS_DEPENDENCY_APP_PRIVATE_KEY }}",
    });
    expect(workflow.on.pull_request_target).toBeUndefined();
    expect(workflow.on.push).toBeUndefined();
  });
});

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
    expect(action.with["version-script"]).toBe("pnpm release:version");
    expect(action.with["push-with-git-cli"]).toBe(false);
    expect(workflow.permissions).toEqual({ contents: "read" });
    expect(action.with["github-token"]).toBe("${{ steps.app.outputs.token }}");
    const app = workflow.jobs.version.steps.find((step) => step.id === "app");
    expect(app.with.owner).toBe("${{ github.repository_owner }}");
    expect(app.with.repositories).toBe("${{ github.event.repository.name }}");
    expect(app.with["permission-contents"]).toBe("write");
    expect(app.with["permission-pull-requests"]).toBe("write");
    expect(action.with["publish-script"]).toBeUndefined();
    expect(action.with["create-github-releases"]).toBe(false);
    expect(action.with["pr-title"]).toBe("chore: version Notebook package");
    expect(action.with["commit-message"]).toBe(
      "chore: version Notebook package",
    );
    expect(action.with.version).toBeUndefined();
    expect(action.with.commitMode).toBeUndefined();
    expect(action.with.createGithubReleases).toBeUndefined();
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
  it("qualifies version inputs and actual release intent before minting version writer authority", () => {
    const workflow = parse(
      readFileSync(
        new URL("../.github/workflows/version-packages.yml", import.meta.url),
        "utf8",
      ),
    );
    const steps = workflow.jobs.version.steps;
    const guardIndex = steps.findIndex((step) => step.id === "version-runtime");
    const appIndex = steps.findIndex((step) => step.id === "app");
    const actionIndex = steps.findIndex((step) =>
      step.uses?.startsWith("changesets/action@"),
    );
    expect(guardIndex).toBeGreaterThan(-1);
    expect(guardIndex).toBeLessThan(appIndex);
    expect(appIndex).toBeLessThan(actionIndex);
    expect(steps[guardIndex].uses).toBe(
      "lapismd/lapis-ci/actions/guard-version-runtime@dd71275c5b2618afceae0b97ee0a071649781971",
    );
    expect(steps[guardIndex].with).toEqual({
      "qualification-file": ".github/versioning-runtime.json",
      "detect-release-intent": "true",
    });
    for (const index of [appIndex, actionIndex])
      expect(steps[index].if).toBe(
        "steps.version-runtime.outputs.hasChangesets == 'true'",
      );
    const qualification = JSON.parse(
      readFileSync(
        new URL("../.github/versioning-runtime.json", import.meta.url),
        "utf8",
      ),
    );
    expect(qualification.nodeMajor).toBe(24);
    expect(qualification.cliVersion).toBe("3.0.3");
    expect(qualification.packageManager).toBe("pnpm@10.32.1");
    expect(qualification.formatterPolicy).toBe("unconfigured");
    expect(qualification.scripts).toEqual({
      "release:version": "node scripts/release.mjs version",
    });
  });
});
