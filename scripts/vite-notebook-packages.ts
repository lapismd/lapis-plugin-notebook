import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Plugin } from "vite";

type ExportsField = unknown;

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

function exportTargets(exportsField: ExportsField): string[] {
  if (typeof exportsField === "string") return [exportsField];
  if (exportsField && typeof exportsField === "object") {
    return Object.values(exportsField as Record<string, unknown>).flatMap(
      (value) => exportTargets(value),
    );
  }
  return [];
}

function collectResolutions(): Map<string, string> {
  const packagesDir = path.join(repoRoot, "packages");
  const resolutions = new Map<string, string>();
  for (const entry of readdirSync(packagesDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const packageDir = path.join(packagesDir, entry.name);
    const manifestPath = path.join(packageDir, "package.json");
    let manifest: {
      name?: string;
      private?: boolean;
      exports?: Record<string, ExportsField>;
    };
    try {
      manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    } catch {
      continue;
    }
    if (!manifest.private || !manifest.name || !manifest.exports) continue;
    for (const [subpath, exportsField] of Object.entries(manifest.exports)) {
      const specifier =
        subpath === "."
          ? manifest.name
          : `${manifest.name}/${subpath.replace(/^\.\//, "")}`;
      for (const target of exportTargets(exportsField)) {
        if (!target.startsWith("./")) continue;
        const absolute = path.join(packageDir, target);
        if (!resolutions.has(specifier)) resolutions.set(specifier, absolute);
      }
    }
  }
  return resolutions;
}

/**
 * Resolves the private `@lapis-notes/notebook-*` workspace sub-packages from
 * TypeScript source through each package's `exports` map. The published root
 * manifest stays portable (no `workspace:` dependencies); the plugin bundle
 * stage inlines these sources before any publication gate (LN-NB-006).
 */
export function notebookPackagesPlugin(): Plugin {
  const resolutions = collectResolutions();
  return {
    name: "lapis-notebook-private-packages",
    enforce: "pre",
    resolveId(source, importer, options) {
      const target = resolutions.get(source);
      if (!target) return null;
      return this.resolve(target, importer, { ...options, skipSelf: true });
    },
  };
}
