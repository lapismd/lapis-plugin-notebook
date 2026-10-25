import type { StorybookConfig } from "@storybook/svelte-vite";
import { svelte, vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { existsSync, realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeConfig, searchForWorkspaceRoot } from "vite";

const storybookDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(storybookDir, "..");
const packageLib = path.resolve(storybookDir, "../src/lib");

const linkedSiblingPackages = [
  "@lapis-notes/api",
  "@lapis-notes/file-explorer",
  "@lapis-notes/markdown",
  "@lapis-notes/search",
  "@lapis-notes/ui",
  "@lapis-notes/workspace",
  "@lapismd/design-core",
  "@lapismd/mira",
] as const;

const linkedSiblingRoots = linkedSiblingPackages.flatMap((packageName) => {
  const candidate = path.join(repoRoot, "node_modules", packageName);
  return existsSync(candidate) ? [realpathSync(candidate)] : [];
});
const linkedSiblingWorkspaceRoots = [
  ...new Set(linkedSiblingRoots.map(searchForWorkspaceRoot)),
];
const linkedAssetPackages = [
  "@fontsource-variable/dm-sans",
  "@fontsource-variable/source-code-pro",
  "@fontsource/source-code-pro",
] as const;
const linkedAssetRoots = linkedSiblingRoots.flatMap((root) =>
  linkedAssetPackages.flatMap((packageName) => {
    const candidate = path.join(root, "node_modules", packageName);
    return existsSync(candidate) ? [realpathSync(candidate)] : [];
  }),
);
const linkedSingletonPackages = [
  "svelte",
  "@lapis-notes/api",
  "@codemirror/autocomplete",
  "@codemirror/commands",
  "@codemirror/lang-markdown",
  "@codemirror/lang-yaml",
  "@codemirror/lint",
  "@codemirror/search",
  "@codemirror/state",
  "@codemirror/view",
  "@codemirror/language",
  "@lezer/common",
  "@lezer/highlight",
  "@lezer/markdown",
  "@lezer/lr",
  "@internationalized/date",
] as const;

const config: StorybookConfig = {
  stories: ["../stories/**/*.mdx", "../src/**/*.stories.@(js|ts|svelte)"],
  addons: [
    "@storybook/addon-docs",
    "@storybook/addon-a11y",
    "@storybook/addon-svelte-csf",
    "@storybook/addon-themes",
    "@storybook/addon-vitest",
  ],
  framework: {
    name: "@storybook/svelte-vite",
    options: {},
  },
  viteFinal: async (viteConfig) =>
    mergeConfig(viteConfig, {
      plugins: [
        ...(!process.env.VITEST
          ? [
              svelte({
                include: "**/*.svelte",
                preprocess: vitePreprocess(),
                compilerOptions: { runes: undefined },
              }),
            ]
          : []),
        tailwindcss(),
      ],
      resolve: {
        conditions: ["svelte", "module", "browser", "development"],
        dedupe: [...linkedSingletonPackages],
        alias: [
          {
            find: /^\$lib(?:\/(.*))?$/,
            replacement: `${packageLib}/$1`,
          },
          {
            find: "@lapis-notes/lapis-plugin-notebook",
            replacement: path.join(packageLib, "index.ts"),
          },
          {
            find: "@internationalized/date",
            replacement: path.join(
              repoRoot,
              "node_modules/@internationalized/date",
            ),
          },
        ],
      },
      esbuild: { target: "esnext" },
      optimizeDeps: {
        noDiscovery: true,
        exclude: ["@storybook/svelte", ...linkedSiblingPackages],
        esbuildOptions: { target: "esnext" },
        include: [
          "aria-query",
          "bits-ui",
          "@lapismd/design-core > bits-ui",
          "@internationalized/date",
          "storybook > @testing-library/dom",
          "react",
          "react-dom",
          "react-dom/client",
          "@lapis-notes/api > @iconify/utils",
          "@lapis-notes/api > @iconify/utils > debug",
          "@lapis-notes/api > eventemitter3",
          "@lapis-notes/api > svelte-sonner",
          "@lapismd/mira > unified",
          "@lapismd/mira > rehype-highlight > lowlight",
          "@lapismd/mira > remark-frontmatter",
          "@lapismd/mira > remark-emoji",
          "@lapis-notes/markdown > @lapismd/mira-plugin-mermaid > mermaid",
          "@lucide/svelte/icons/calendar-days",
          "@lucide/svelte/icons/check",
          "@lucide/svelte/icons/arrow-left",
          "@lucide/svelte/icons/circle-alert",
          "@lucide/svelte/icons/check-check",
          "@lucide/svelte/icons/chevron-down",
          "@lucide/svelte/icons/chevron-left",
          "@lucide/svelte/icons/chevron-right",
          "@lucide/svelte/icons/clock-3",
          "@lucide/svelte/icons/moon",
          "@lucide/svelte/icons/list-restart",
          "@lucide/svelte/icons/sun",
          "@lucide/svelte/icons/sunrise",
          "@lucide/svelte/icons/timer-off",
        ],
      },
      server: {
        fs: {
          allow: [
            repoRoot,
            ...linkedSiblingRoots,
            ...linkedSiblingWorkspaceRoots,
            ...linkedAssetRoots,
          ],
        },
      },
    }),
};

export default config;
