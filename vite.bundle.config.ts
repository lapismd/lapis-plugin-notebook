import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vite";

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

export default defineConfig({
  plugins: [notebookPackagesPlugin(), svelte()],
  build: {
    target: "esnext",
    outDir: "dist",
    emptyOutDir: false,
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
    plugins: () => [notebookPackagesPlugin()],
    rollupOptions: {
      // The DOM-less worker never executes the lazy UI runtime; keep Svelte
      // and Design Core out of the worker bundle graph.
      external: [/^@lapismd\/design-core(?:$|\/)/, /^svelte(?:$|\/)/],
    },
  },
});
