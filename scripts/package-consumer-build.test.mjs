import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { getHeapStatistics } from "node:v8";
import { expect, it } from "vitest";
import { productionBuildArguments } from "./package-consumer-build.mjs";

it("budgets only the production child despite an inherited 2 GiB heap cap", () => {
  const directory = mkdtempSync(join(tmpdir(), "notebook-build-budget-"));
  const inherited = process.env.NODE_OPTIONS;
  const parentLimit = getHeapStatistics().heap_size_limit;
  try {
    writeFileSync(
      join(directory, "package.json"),
      JSON.stringify({
        type: "module",
        imports: {
          "#condition": {
            "ci-probe": "./condition.mjs",
            default: "./default.mjs",
          },
        },
      }),
    );
    writeFileSync(
      join(directory, "condition.mjs"),
      'export default "preserved";',
    );
    writeFileSync(join(directory, "default.mjs"), 'export default "lost";');
    const probe = join(directory, "probe.mjs");
    writeFileSync(
      probe,
      `import { getHeapStatistics } from "node:v8";
import condition from "#condition";
console.log(JSON.stringify({ heap: getHeapStatistics().heap_size_limit, mode: process.argv[2], condition }));`,
    );
    const child = spawnSync(process.execPath, productionBuildArguments(probe), {
      env: {
        ...process.env,
        NODE_OPTIONS: "--max-old-space-size=2048 --conditions=ci-probe",
      },
      encoding: "utf8",
    });
    expect(child.status, child.stderr).toBe(0);
    const result = JSON.parse(child.stdout);
    expect(result.heap).toBeGreaterThanOrEqual(4096 * 1024 * 1024);
    expect(result.heap).toBeLessThan(4352 * 1024 * 1024);
    expect(result.mode).toBe("build");
    expect(result.condition).toBe("preserved");
    expect(process.env.NODE_OPTIONS).toBe(inherited);
    expect(getHeapStatistics().heap_size_limit).toBe(parentLimit);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
