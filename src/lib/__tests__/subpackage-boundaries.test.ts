import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// LN-NB-027: the private support packages keep their legacy host-neutrality
// boundaries. Each rule maps a package to specifiers that MUST NOT appear in
// its static or dynamic imports.
const BOUNDARIES: Record<string, RegExp[]> = {
  core: [
    /^svelte/,
    /^@lapis-notes\/api/,
    /^@duckdb\//,
    /^htl$/,
    /^@lapismd\//,
  ],
  duckdb: [
    /^@duckdb\/duckdb-wasm$/,
    /^@lapis-notes\/api/,
    /^svelte/,
  ],
  worker: [
    /^@lapis-notes\/api/,
    /^svelte/,
    /^@duckdb\//,
  ],
  input: [
    // UI dependencies load only inside the lazy DOM runtime.
    /^@lapis-notes\/api/,
  ],
  stdlib: [
    /^@lapis-notes\/api/,
    /^svelte/,
    /^@duckdb\//,
  ],
  "duckdb-assets": [
    /^@lapis-notes\/api/,
    /^svelte/,
  ],
};

const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!entry.isFile() || !/\.(?:svelte|ts)$/u.test(entry.name)) return [];
    if (/\.(?:test|spec)\.ts$/.test(entry.name)) return [];
    return [path];
  });
}

const IMPORT_RE = /(?:^|\s)(?:import|export)\s[^;]*?from\s*["']([^"']+)["']|import\(\s*["']([^"']+)["']\s*\)/gm;

describe("support-package boundaries", () => {
  for (const [pkg, forbidden] of Object.entries(BOUNDARIES)) {
    it(`keeps ${pkg} host-neutral`, () => {
      const root = resolve(repoRoot, "packages", pkg, "src");
      const violations: string[] = [];
      for (const file of sourceFiles(root)) {
        const source = readFileSync(file, "utf8");
        // ui-runtime is the input package's designated lazy UI boundary;
        // its design-core/svelte imports are dynamic by contract.
        if (pkg === "input" && file.endsWith("ui-runtime.ts")) continue;
        for (const match of source.matchAll(IMPORT_RE)) {
          const specifier = match[1] ?? match[2];
          if (!specifier) continue;
          if (forbidden.some((pattern) => pattern.test(specifier))) {
            violations.push(`${relative(repoRoot, file)}: ${specifier}`);
          }
        }
      }
      expect(violations).toEqual([]);
    });
  }

  it("loads input UI dependencies only inside the lazy DOM runtime", () => {
    const domRuntime = readFileSync(
      resolve(repoRoot, "packages/input/src/dom-runtime.ts"),
      "utf8",
    );
    const uiRuntime = readFileSync(
      resolve(repoRoot, "packages/input/src/ui-runtime.ts"),
      "utf8",
    );
    // dom-runtime reaches the UI runtime through loadUiBackedNotebookInputs,
    // and only ui-runtime touches Svelte/Design Core, via dynamic import().
    expect(domRuntime).toContain("./ui-runtime");
    for (const source of [domRuntime]) {
      expect(source).not.toMatch(/from ["']svelte["']/);
      expect(source).not.toMatch(/@lapismd\/design-core/);
    }
    const staticDesignCore = uiRuntime.match(
      /^\s*import\s[^;]*?from\s*["']@lapismd\/design-core[^"']*["']/gm,
    );
    expect(staticDesignCore ?? []).toEqual([]);
  });
});
