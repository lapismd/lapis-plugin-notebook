import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

// LN-NB-026: heavy runtime modules load lazily on first use. This audit
// proves the static-import boundary: the modules below may only appear
// behind dynamic import() anywhere in the plugin graph, except inside the
// allowlisted lazy-boundary files that are themselves only reachable
// through dynamic imports.
const HEAVY_SPECIFIERS = [
  "@duckdb/duckdb-wasm",
  "typescript",
  "htl",
  "d3",
  "@observablehq/plot",
] as const;

const LAZY_BOUNDARY_ALLOWLIST = new Set([
  // Instantiated only through dynamic import from the worker/engine.
  "src/lib/runtime/duckdb/notebook-duckdb-service.ts",
]);

const repoRoot = resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const sourceRoots = [
  resolve(repoRoot, "src/lib"),
  ...readdirSync(resolve(repoRoot, "packages"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => resolve(repoRoot, "packages", entry.name, "src")),
];

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    if (!entry.isFile() || !/\.(?:svelte|ts)$/u.test(entry.name)) return [];
    if (/\.(?:test|spec)\.ts$/.test(entry.name)) return [];
    return [path];
  });
}

const STATIC_IMPORT_RE =
  /^\s*import\s+(?:[\s\S]*?\sfrom\s+)?["']([^"']+)["']/gm;

describe("startup-thin module boundary", () => {
  it("keeps heavy runtime modules behind dynamic imports", () => {
    const violations: string[] = [];
    for (const root of sourceRoots) {
      for (const file of sourceFiles(root)) {
        const rel = relative(repoRoot, file);
        if (LAZY_BOUNDARY_ALLOWLIST.has(rel)) continue;
        const source = readFileSync(file, "utf8");
        for (const match of source.matchAll(STATIC_IMPORT_RE)) {
          const specifier = match[1];
          if (specifier.startsWith("import(")) continue;
          const heavy = HEAVY_SPECIFIERS.find(
            (candidate) =>
              specifier === candidate ||
              specifier.startsWith(`${candidate}/`),
          );
          // Type-only imports never emit runtime loads.
          const isTypeOnly = /^\s*import\s+type\b/.test(match[0]);
          if (heavy && !isTypeOnly) {
            violations.push(`${rel}: static import of ${specifier}`);
          }
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
