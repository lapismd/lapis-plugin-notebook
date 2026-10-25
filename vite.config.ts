import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { storybookTest } from "@storybook/addon-vitest/vitest-plugin";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const packageDir = path.dirname(fileURLToPath(import.meta.url));
const internationalizedDate = path.resolve(
  packageDir,
  "node_modules/@internationalized/date",
);

const linkedSingletonPackages = [
  "svelte",
  "@lapis-notes/api",
  "@internationalized/date",
] as const;

export default defineConfig({
  resolve: {
    alias: {
      "@internationalized/date": internationalizedDate,
    },
    dedupe: [...linkedSingletonPackages],
  },
  optimizeDeps: {
    include: [
      "aria-query",
      "bits-ui",
      "@lapismd/design-core > bits-ui",
      "@internationalized/date",
      "react",
      "react-dom",
      "react-dom/client",
      "@storybook/addon-a11y/preview",
      "@storybook/svelte-vite",
      "@lucide/svelte/icons/arrow-left",
    ],
    esbuildOptions: {
      target: "esnext",
    },
  },
  esbuild: {
    target: "esnext",
  },
  ssr: {
    noExternal: ["aria-query"],
  },
  test: {
    projects: [
      {
        plugins: [svelte({ preprocess: vitePreprocess() })],
        resolve: {
          alias: {
            $lib: path.resolve(packageDir, "src/lib"),
            "@internationalized/date": internationalizedDate,
          },
          dedupe: [...linkedSingletonPackages],
        },
        test: {
          name: "unit",
          environment: "node",
          include: [
            "src/**/*.test.ts",
            "src/**/*.spec.ts",
            "packages/*/src/**/*.test.ts",
            "scripts/**/*.test.mjs",
          ],
        },
      },
      {
        extends: true,
        plugins: [
          svelte({
            include: "**/*.svelte",
            preprocess: vitePreprocess(),
            compilerOptions: { runes: undefined },
          }),
          storybookTest({ configDir: path.join(packageDir, ".storybook") }),
        ],
        test: {
          name: "storybook",
          setupFiles: [".storybook/vitest.setup.ts"],
          testTimeout: 60_000,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({}),
            instances: [
              { browser: "chromium", viewport: { width: 1280, height: 800 } },
            ],
          },
        },
      },
    ],
  },
});
