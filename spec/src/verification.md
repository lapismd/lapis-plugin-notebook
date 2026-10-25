# Verification

| ID | Status | Evidence |
| --- | --- | --- |
| LPN-SPEC-001 | Implemented | `pnpm spec:build` builds the standalone mdBook. |
| LPN-SPEC-002 | Implemented | `pnpm spec:first` maps protected changes to canonical chapters. |
| LPN-SPEC-003 | Implemented | `pnpm spec:validate` enforces unique definitions and one verification row per ID. |
| LPN-SPEC-004 | Implemented | Manifest validation rejects non-portable protocols; the DuckDB pin lands with the runtime slice that adds the dependency. |
| LPN-SPEC-005 | Implemented | `pnpm-workspace.yaml` keeps unpublished first-party host packages development-only, pins CodeMirror and Lezer, and admits only `packages/*` support members. |
| LPN-SPEC-006 | Implemented | Package scripts and supervisor smoke checks cover stop, reuse, and restart on the checkout-owned 7040 lane. |
| LPN-SPEC-007 | Implemented | `AGENTS.md` restricts `globalThis.app`; `pnpm check:app-ownership` audits `src/lib`, `src/stories`, and `packages/*/src`. |
| LPN-SPEC-008 | Implemented | `scripts/spec-validation/storybook-taxonomy-audit.mjs` rejects titles outside `Plugins/Notebook/*`. |
| LPN-SPEC-009 | Implemented | `stories/spec` mirrors every SUMMARY chapter; `storybookMirrors` verifies target, title, content, and order. |
| LPN-SPEC-010 | Implemented | `spec/src/plugins` hierarchy and `Plugins/Notebook/Shell` story title match. |
| LPN-SPEC-011 | Implemented | `AGENTS.md` version-control section requires preserved work and Jujutsu commits with PR-quality messages. |
| LPN-SPEC-012 | Implemented | `stories/catalog/story-parity.json` declares the shell family as application coverage; `pnpm check:storybook-parity` follows its render path to the public `WorkspaceShell`. |
| LPN-SPEC-013 | Implemented | Every root script routes through `scripts/validation.mjs`; `pnpm check:validation-routing` rejects unclassified scripts. |
| LPN-SPEC-014 | Implemented | `scripts/validation/runs.mjs` snapshots the tracked Jujutsu revision; frozen registry installs ignore local pnpm hooks. |
| LPN-SPEC-015 | Implemented | `scripts/validation/Dockerfile` pins base/toolchain identities and installs Chromium for the locked Playwright version; batched storybook shards run sequentially with one worker and clamp to the discovered story-file count. |
| LPN-SPEC-016 | Implemented | `src/stories/FixtureControls.svelte` ships the padded dotted boundary; no Stage 0 story uses synthetic controls yet. |
| LPN-SPEC-017 | Implemented | Worker runs carry CPU/memory/shm limits and a per-checkout lease; reports retain identities; cleanup collects reports before deleting owned runs. |
| LPN-SPEC-018 | Implemented | `.storybook/vitest.setup.ts` installs the fatal Svelte diagnostic guard through teardown without allowlists. |
| LPN-SPEC-019 | Implemented | `pnpm validation:all` runs the classified lanes sequentially in one worker and refuses selectors. |
| LN-NB-001 | Implemented | `manifest.json` and `package.json` match the `packageManifest` validator (`pnpm spec:validate`). |
| LN-NB-002 | Implemented | Stage 2 `onload` registers the file-keyed `notebook` view, editor-view contribution, `.notebook.md` extension, cell editor suggest, settings tab, and six authoring commands; the Shell story play asserts each through layout restore. |
| LN-NB-003 | Implemented | `src/lib/application-ownership.test.ts` audits plugin, story, and support-package sources; wired into `check` and `spec:check`. |
| LN-NB-004 | Planned | The published-bundle exclusion audit lands with the bundling lane (LN-NB-006); Stage 2 imports stay on published api/markdown/design-core surfaces. |
| LN-NB-005 | Implemented | Stage 0–2 records under `spec/records/2026-10-25-*` carry lane evidence and status flips followed executed acceptance. |
| LN-NB-006 | Planned | Source resolution ships via `scripts/vite-notebook-packages.mjs` + tsconfig paths; the inlining bundle lane lands before the publication gate. |
| LN-NB-010 | Implemented | `notebook-path.ts`/`notebook-file.ts` ported with legacy tests; `registerExtensions(["notebook.md"])` + editor-view `filenamePatterns` proven by the Shell story opening the fixture in `NotebookView`. |
| LN-NB-011 | Implemented | `parse/parse-notebook-document.ts` ported verbatim; `parse-notebook-document.test.ts` green in the unit lane. |
| LN-NB-012 | Implemented | `model/notebook-frontmatter.ts` ported verbatim; `notebook-frontmatter.test.ts` green in the unit lane. |
| LN-NB-013 | Implemented | `append-cell-template`, `ensure-notebook-frontmatter`, `create-demo-notebooks`, and `notebook-cell-suggest` ported with their four legacy test suites green. |
| LN-NB-014 | Implemented | `runtime/analysis/*` and `runtime/notebook-graph.ts` ported verbatim over `notebook-core/graph`; legacy graph, worker-engine, and viewof suites green in the unit lane (52 files / 227 tests). |
| LN-NB-020 | Planned | Worker/in-process transport port lands in Stage 4. |
| LN-NB-021 | Planned | Graph reactivity and autorun land in Stage 4. |
| LN-NB-022 | Planned | Cancellation and progress land in Stage 4. |
| LN-NB-023 | Planned | Notebook-state persistence lands in Stage 4 against the existing host contract. |
| LN-NB-024 | Planned | Safe-mode gating lands in Stage 4. |
| LN-NB-025 | Planned | DuckDB-WASM slice lands in Stage 6; the provider seam ports with it. |
| LN-NB-026 | Planned | Startup-thin audit lands with the Stage 4 runtime wiring. |
| LN-NB-027 | Planned | Support-package boundary audits land in Stage 1. |
| LN-NB-028 | Planned | TypeScript cell execution lands in Stage 4. |
