import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const sourceRoots = [
  resolve(repoRoot, "src/lib"),
  resolve(repoRoot, "src/stories"),
  ...readdirSync(resolve(repoRoot, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(repoRoot, "packages", entry.name, "src"))
    .filter((directory) => existsSync(directory)),
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (
      !entry.isFile() ||
      !/\.(?:svelte|ts)$/u.test(entry.name) ||
      /\.(?:test|spec)\.ts$/u.test(entry.name)
    ) {
      return [];
    }
    return [path];
  });
}

describe("application ownership", () => {
  it("keeps the ambient app alias out of production and Storybook source", () => {
    const violations = sourceRoots
      .filter((root) => existsSync(root))
      .flatMap(sourceFiles)
      .filter((path) =>
        readFileSync(path, "utf8").includes("globalThis.app"),
      );

    expect(violations).toEqual([]);
  });
});
