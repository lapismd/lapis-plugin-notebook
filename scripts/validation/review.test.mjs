import { describe, expect, it } from "vitest";
import { projectArchiveWorkspace } from "./archive-projection.mjs";
import { workerArguments, validationConfig, auditRouting } from "./model.mjs";
import { readFileSync } from "node:fs";
describe("isolated review routing", () => {
  it("overrides existing worker pins only in the installation projection", () => {
    const source =
      'overrides:\n  "@lapismd/design-core": "0.7.2"\n  svelte: "5.56.10"\n';
    const next = projectArchiveWorkspace(source, [
      { name: "@lapismd/design-core", path: "package-0.tgz" },
    ]);
    expect(next).toContain('"file:/input/package-0.tgz"');
    expect(next).toContain('svelte: "5.56.10"');
    expect(source).toContain('"0.7.2"');
  });
  it("publishes only the review lane, only on loopback", () => {
    const config = { cpus: 4, memoryGiB: 12, shmGiB: 2, reviewPort: 10529 };
    const worker = {
      run: "review",
      owner: "owner",
      cache: "rust",
      dependencies: "pnpm",
      image: "fingerprint",
    };
    expect(workerArguments(config, worker)).not.toContain("--publish");
    expect(workerArguments(config, { ...worker, review: true })).toContain(
      "127.0.0.1:10529:6006",
    );
    expect(() => validationConfig({ reviewPort: 1 }, {})).toThrow("reviewPort");
  });
  it("registers every focused/review command without adding native exceptions", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8"));
    const lanes = JSON.parse(
      readFileSync("scripts/validation/lanes.json", "utf8"),
    );
    expect(auditRouting(pkg.scripts, lanes)).toEqual([]);
    expect(lanes["storybook:review"]).toBeTruthy();
  });
});
