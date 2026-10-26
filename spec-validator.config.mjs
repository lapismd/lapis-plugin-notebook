import {
  defineConfig,
  singleIdVerification,
  tableRequirements,
} from "@lapismd/spec-validator";

export default defineConfig(tableRequirements(), {
  name: "lapis-plugin-notebook",
  idPattern: /^(?:LN-NB|LPN-SPEC)-\d{3}$/,
  ruleIds: {
    summary: "LPN-SPEC-001",
    governance: "LPN-SPEC-003",
    verification: "LPN-SPEC-003",
    book: "LPN-SPEC-001",
    bookIgnore: "LPN-SPEC-001",
    packageManifest: "LN-NB-001",
    storybookMirrors: "LPN-SPEC-009",
    qmd: "LPN-SPEC-020",
    specFirst: "LPN-SPEC-002",
    internal: "LPN-SPEC-003",
  },
  diagnostics: {
    "SPEC-PKG-PORTABLE": "LPN-SPEC-004",
    "SPEC-PKG-MANIFEST-MISSING": "LN-NB-001",
    "SPEC-PKG-MANIFEST": "LN-NB-001",
    "NOTEBOOK-STORY-TAXONOMY": "LPN-SPEC-008",
  },
  validators: {
    summary: true,
    governance: {
      acceptance: false,
      normative: true,
      proseLimits: false,
      references: true,
      changeMap: false,
    },
    verification: singleIdVerification({
      headers: {
        ids: ["ID"],
        status: ["Status"],
        evidence: ["Evidence"],
        required: [],
      },
      statuses: ["Implemented", "Planned", "Visual pending"],
    }),
    book: true,
    storybookMirrors: {
      style: "src-spec-mdx",
      directory: "stories/spec",
      titlePrefix: "Specification",
      verifyTarget: true,
      verifyTitle: true,
      verifyContent: true,
      previewPath: ".storybook/preview.ts",
      verifyOrder: true,
    },
    qmd: { collection: "lapis-plugin-notebook-spec" },
    packageManifest: {
      name: "@lapis-notes/lapis-plugin-notebook",
      version: "0.1.0",
      privateAllowed: false,
      portableDependencies: true,
      manifestPath: "manifest.json",
      manifest: {
        id: "lapis-notebook",
        distribution: "first-party-external",
        provenance: "official",
        enabledByDefault: false,
      },
    },
    specFirst: {
      mode: "mapped",
      canonicalPattern:
        "^spec/src/(?:plugins/(?:index|notebook/(?:index|documents|runtime))|spec-governance)\\.md$",
      ignore: [
        "(^|/)node_modules/",
        "(^|/)(?:dist|build|storybook-static)/",
        "^spec/book/",
        "^spec/src/(?:SUMMARY|verification)\\.md$",
        "\\.(?:spec|test)\\.[cm]?[jt]sx?$",
      ],
      rules: [
        {
          pattern: "^stories/catalog/",
          chapters: ["spec/src/spec-governance.md"],
        },
        {
          pattern: "^packages/",
          chapters: ["spec/src/plugins/notebook/runtime.md"],
        },
        {
          pattern:
            "^(?:src/lib/(?:model|parse)/|src/lib/notebook-(?:file|path)\\.)",
          chapters: ["spec/src/plugins/notebook/documents.md"],
        },
        {
          pattern:
            "^(?:src/lib/(?:runtime|commands)/|src/lib/notebook-plugin\\.|src/lib/notebook-settings)",
          chapters: ["spec/src/plugins/notebook/runtime.md"],
        },
        {
          pattern:
            "^(?:package\\.json$|manifest\\.json$|\\.storybook/|src/(?!lib/(?:model|parse|runtime|commands)/|lib/notebook-(?:file|path)\\.|lib/notebook-plugin\\.|lib/notebook-settings))",
          chapters: ["spec/src/plugins/notebook/index.md"],
        },
        {
          pattern:
            "^(?:pnpm-|scripts/|\\.github/|AGENTS\\.md$|spec-validator\\.config\\.mjs$)",
          chapters: ["spec/src/spec-governance.md"],
        },
      ],
      protected: [
        "^(?:package\\.json$|manifest\\.json$|src/|packages/|stories/catalog/|\\.storybook/|pnpm-|scripts/|\\.github/|AGENTS\\.md$|spec-validator\\.config\\.mjs$)",
      ],
    },
  },
  plugins: [
    "scripts/spec-validation/storybook-taxonomy-audit.mjs",
    "scripts/spec-validation/storybook-parity.mjs",
    "scripts/spec-validation/validation-routing.mjs",
  ],
});
