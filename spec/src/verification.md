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
| LPN-SPEC-020 | Implemented | `.qmd/index.yml` tracks the `lapis-plugin-notebook-spec` collection over `spec/src`; `pnpm spec:index` builds the local index and `pnpm spec:search` returns QMD hits with the `rg` fallback printed only when QMD is unavailable; `spec-validator doctor` passes the qmd-config, qmd-binary, and qmd-native checks; the routing audit keeps both scripts as native exceptions. |
| LN-NB-001 | Implemented | `manifest.json` and `package.json` match the `packageManifest` validator (`pnpm spec:validate`). |
| LN-NB-002 | Implemented | Stage 2 `onload` registers the file-keyed `notebook` view, editor-view contribution, `.notebook.md` extension, cell editor suggest, settings tab, and six authoring commands; the Shell story play asserts each through layout restore. |
| LN-NB-003 | Implemented | `src/lib/application-ownership.test.ts` audits plugin, story, and support-package sources; wired into `check` and `spec:check`. |
| LN-NB-004 | Implemented | `scripts/check-bundle-exclusions.mjs` audits every built bundle file for forbidden private surfaces and proves api/svelte externalization; all runtime imports stay on published first-party surfaces. |
| LN-NB-005 | Implemented | Stage 0–2 records under `spec/records/2026-10-25-*` carry lane evidence and status flips followed executed acceptance. |
| LN-NB-006 | Implemented | The `build:bundle` lane emits `dist/main.mjs` + `dist/app.css` with sub-packages inlined (audit-verified), lazy TypeScript and DuckDB chunks split, engine assets copied, and the svelte-package `dist` kept for the npm export surface. |
| LN-NB-007 | Implemented | `Plugins/Notebook/Panels/{Variables,Dependencies,Packages}` each carry the six named placement stories (18 total) over the real persisted workspace shell with single-instance, destination-host, surface, and paint assertions plus copy-paste Show Code; panels populate through registration-time and layout-ready seeded refreshes. |
| LN-NB-008 | Implemented | Registry wired through the packages panel, install/uninstall/update methods, and the restored settings rows with both legacy suites green; the runtime manifest declares `network.connect` and the bundle audit enforces it. |
| LN-NB-009 | Implemented | The six Dependencies placement stories render the derived DAG through the in-repo layout engine; the canonical Right Sidebar story switches to the graph tab and proves the orientation setting persists through plugin settings (wheel-zoom sensitivity shares the path and settings-tab exposure); cycle and duplicate-definition detection ride the ported graph/data suites and render through the panel error branches. |
| LN-NB-010 | Implemented | `notebook-path.ts`/`notebook-file.ts` ported with legacy tests; `registerExtensions(["notebook.md"])` plus an exclusive-priority editor-view contribution proven by the Shell story: layout restore, generic `determineViewTypeForPath` resolution, and plain-leaf `openFile` all yield `NotebookView` with header actions. |
| LN-NB-011 | Implemented | `parse/parse-notebook-document.ts` ported verbatim; `parse-notebook-document.test.ts` green in the unit lane. |
| LN-NB-012 | Implemented | `model/notebook-frontmatter.ts` ported verbatim; `notebook-frontmatter.test.ts` green in the unit lane. |
| LN-NB-013 | Implemented | `append-cell-template`, `ensure-notebook-frontmatter`, `create-demo-notebooks`, and `notebook-cell-suggest` ported with their four legacy test suites green. |
| LN-NB-014 | Implemented | `runtime/analysis/*` and `runtime/notebook-graph.ts` ported verbatim over `notebook-core/graph`; legacy graph, worker-engine, and viewof suites green in the unit lane (52 files / 227 tests). |
| LN-NB-020 | Implemented | `Run notebook` story executes through the dedicated worker transport end-to-end (engine logs + rendered outputs); eligibility policy and broker suites green in the unit lane. |
| LN-NB-021 | Implemented | `Run notebook` proves topological order; `Run inputs` proves input-change targeted rerun; `Autorun stale cells` proves edit-triggered stale marking of descendants and the debounced settings-gated autorun. |
| LN-NB-022 | Implemented | `Cancel execution` story starts a 30s cell through the render service, cancels mid-run, and asserts the checkpoint rollback leaves the cell uncompleted with the output row hidden; the worker runtime terminates (cancelExecution awaits the pending run). |
| LN-NB-023 | Implemented | `Run notebook` story asserts `appDatabase.getNotebookState` holds per-cell typed state after execution; output-store fingerprint suite green. |
| LN-NB-024 | Implemented | `Safe mode` story toggles `app.safeMode.disableNotebookExecution`, runs the command, and asserts no interpolated output and no persisted notebook state; the gate reads the host contract live. |
| LN-NB-025 | Implemented | `Query data` story runs SQL cells on DuckDB-WASM (pinned 1.33.1-dev45.0) resolved through the plugin asset paths and queries `lapis.notes` from vault snapshots; register-app-tables and vault-file suites green; the native provider seam remains open (Electron sidecar excluded). |
| LN-NB-026 | Implemented | `startup-thin.test.ts` audits the static-import boundary for DuckDB/TypeScript/htl/d3/Plot (dynamic-only outside the allowlisted lazy service); the `Run notebook` story shows the compiler loading only at first execution. |
| LN-NB-027 | Implemented | `subpackage-boundaries.test.ts` audits the static/dynamic import boundaries of all six packages (core/duckdb/worker/stdlib/duckdb-assets host-neutrality; input loads Svelte and Design Core only inside its lazy UI runtime). |
| LN-NB-029 | Implemented | `manifest.json` declares the workspace ESM entry, the shared-dependency list mirroring the bundle externals, and twelve permissions; the bundle audit fails on a missing entry or `network.connect`. |
| LN-NB-028 | Implemented | `Run notebook` story runs a TypeScript cell through the lazily loaded compiler with `display()` capture; worker-engine suites cover module rewriting and dependency-descriptor validation. |
