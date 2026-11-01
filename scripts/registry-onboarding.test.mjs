import { readFile } from "node:fs/promises";
import { expect, test } from "vitest";
test("standalone source declares registry media at the repository root", async () => {
  const source = JSON.parse(await readFile("registry.json", "utf8"));
  expect(source.schemaVersion).toBe(2);
  expect(source.media.banner.capture.storyId).toContain("registry-screenshots");
  expect(source.gallery.length).toBeGreaterThan(0);
  const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
  expect(await readFile("CHANGELOG.md", "utf8")).toContain(`## ${manifest.version}`);
});
test("approved published releases dispatch registry submissions", async () => {
  const workflow = await readFile(
    ".github/workflows/registry-release.yml",
    "utf8",
  );
  expect(workflow).toContain("workflow_dispatch:");
  expect(workflow).toContain("registry-production");
  expect(workflow).toContain("registry:publish");
});
