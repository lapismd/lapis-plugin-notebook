import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { validateCiResults } from "./aggregate-ci.mjs";

const workflow = parse(
  readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8"),
);
describe("Notebook CI gates", () => {
  it("shares the immutable local Docker base", () => {
    const pin = JSON.parse(
      readFileSync(new URL("../.ci/images.json", import.meta.url), "utf8"),
    ).base;
    const recipe = readFileSync(
      new URL("./validation/Dockerfile", import.meta.url),
      "utf8",
    );
    expect(pin.digest).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(recipe).toContain(`FROM ${pin.image}@${pin.digest}\n`);
  });
  it("aggregates every lane, even when prerequisites fail or cancel", () => {
    expect(workflow.jobs.validate.if).toBe("always()");
    expect([...workflow.jobs.validate.needs].sort()).toEqual(
      Object.keys(workflow.jobs)
        .filter((name) => name !== "validate")
        .sort(),
    );
    expect(workflow.jobs.validate.steps.at(-1).env.CI_JOB_RESULTS).toBe(
      "${{ toJSON(needs) }}",
    );
    expect(() =>
      validateCiResults({
        quality: { result: "success" },
        unit: { result: "success" },
      }),
    ).not.toThrow();
    for (const result of ["failure", "cancelled", "skipped", undefined]) {
      expect(() =>
        validateCiResults({ quality: { result: "success" }, unit: { result } }),
      ).toThrow("unit");
    }
    expect(() => validateCiResults({})).toThrow();
  });
  it("keeps all validation lanes and runs the complete browser partition in parallel", () => {
    for (const name of [
      "quality",
      "unit",
      "package",
      "storybook-static",
      "storybook-interaction",
    ]) {
      expect(workflow.jobs[name].needs).toEqual(["image-pin", "build-cache"]);
      expect(workflow.jobs[name].container.options).toContain("--cap-drop=ALL");
    }
    const browser = workflow.jobs["storybook-interaction"];
    expect(browser.strategy["fail-fast"]).toBe(false);
    expect(browser.strategy.matrix.shard).toEqual([1, 2, 3]);
    expect(browser.steps.at(-1).run).toBe(
      "pnpm test:storybook -- --shard=${{ matrix.shard }}/3",
    );
    expect(JSON.stringify(workflow)).not.toContain("actions/setup-node");
  });
});
