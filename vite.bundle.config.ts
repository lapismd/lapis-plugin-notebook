import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import manifest from "./manifest.json";

import { notebookPackagesPlugin } from "./scripts/vite-notebook-packages";

// Host-shared singletons and published first-party surfaces stay external and
// are mirrored in manifest.json `lapis.runtime.entries.workspace
// .sharedDependencies`. Everything else — the private support packages, the
// lazily loaded TypeScript compiler, DuckDB-WASM, vega-embed, d3, Plot, htl,
// date-fns, TanStack, lucide, and the CodeMirror language packs the host does
// not ship — is inlined per LN-NB-006.
const external = [
  /^svelte(?:$|\/)/,
  /^@lapis-notes\/api(?:$|\/)/,
  /^@lapis-notes\/markdown(?:$|\/)/,
  /^@lapis-notes\/ui(?:$|\/)/,
  /^@lapismd\/design-core(?:$|\/)/,
  /^@lapismd\/mira(?:$|\/)/,
  /^@codemirror\/(?:autocomplete|commands|language|lang-markdown|search|state|view)$/,
  /^@lezer\/highlight$/,
];

function auditSharedImports(): Plugin {
  const shared = new Set<string>(
    manifest.lapis.runtime.entries.workspace.sharedDependencies,
  );
  return {
    name: "notebook-declared-shared-imports",
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "chunk") continue;
        for (const id of [...chunk.imports, ...chunk.dynamicImports]) {
          if (
            id.startsWith(".") ||
            id.startsWith("/") ||
            Object.hasOwn(bundle, id)
          )
            continue;
          if (!shared.has(id))
            this.error(
              `Undeclared shared runtime import ${id} in ${chunk.fileName}`,
            );
        }
      }
    },
  };
}

export default defineConfig({
  base: "./",
  define: { "process.env.NODE_ENV": JSON.stringify("production") },
  plugins: [notebookPackagesPlugin(), svelte(), auditSharedImports()],
  build: {
    target: "esnext",
    outDir: "dist",
    emptyOutDir: true,
    lib: {
      entry: "src/bundle-entry.ts",
      formats: ["es"],
      fileName: () => "main.mjs",
      cssFileName: "app",
    },
    rollupOptions: {
      external,
    },
  },
  worker: {
    format: "es",
    plugins: () => [
      notebookPackagesPlugin(),
      svelte({ emitCss: false }),
      auditSharedImports(),
    ],
    rollupOptions: {
      // Local controls compile into lazy chunks; the DOM-less worker never
      // executes them. Host-shared Svelte and Design Core stay external.
      external: [/^@lapismd\/design-core(?:$|\/)/, /^svelte(?:$|\/)/],
    },
  },
});
