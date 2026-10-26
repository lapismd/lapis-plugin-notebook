# 2026-10-26 — Stage 7 panel surfaces, registry wiring, and conversions

## What landed

- All three side panels and their ItemViews ported: inspector (variables +
  DuckDB catalog with lazy table previews), dependencies (minimap plus the
  472-line SVG DAG with orientation/zoom settings), and packages (npm search,
  install/uninstall/update, dependency-registry status).
- Plugin wiring restored: the three views register with `ViewAccess.command`
  openers reusing the legacy command ids/names (`open-notebook-session-view`,
  `open-notebook-dependencies-view`, `open-notebook-packages-view`), panel
  refreshes on controller/layout/leaf events, auto-open settings honored in
  `handleNotebookFileOpen`, snapshot builders, package methods, the two
  settings-tab "Open packages" rows with registry validation, and the
  NotebookView pane-menu items with their callbacks.
- Conversion mechanics: static utilities converted by a deterministic
  token-dictionary engine (Tailwind 4 values) into generated
  `notebook-<panel>__g<hash>` classes with appended native CSS; conditional
  class strings rewritten to BEM modifiers (`__tab--active`,
  `__minimap-row--selected`, `__orientation--active`, `__graph--dragging`,
  `__graph-node--{error,warning,success,idle,ring}`,
  `notebook-packages__{layout,entry,suggestion}` modifiers). The `Item`
  family became semantic `notebook-packages__item-*` divs; the non-exported
  API `Icon` component became a wrapper over the public `getSvg` registry;
  the code-snippet highlighter uses the standard lezer `classHighlighter`.

## Behavior adaptations (documented divergences)

- Panel `refreshView` degrades with a warning and null snapshot instead of
  propagating unhandled rejections when DuckDB catalog or registry probing
  fails (workspace lifecycle calls it with `void`; legacy relied on hosts
  always providing plugin asset serving).
- The plugin asset URL fallback anchors root-relative plugin paths at the
  document origin, so browser hosts without a plugin asset server resolve
  engine assets correctly; the legacy fallback produced invalid URLs there.
- Story vaults seed `.lapis/lapis-notebook.json` with panel auto-open off so
  shell stories stay deterministic; panel stories will open panels explicitly.
- Dataframe row regions derive their accessible name from the source query
  (or the per-instance search id) after axe `landmark-unique` flagged two
  identically labelled dataframes in the `Query data` story.

## Verification impact

LN-NB-007/008/009 evidence updated; all three stay Planned until the
six-placement panel story suite (LN-NB-007), the manifest network permission
at the bundle gate (LN-NB-008), and the dedicated dependencies panel story
(LN-NB-009) land.

## Validation

- `svelte-check` 0/0; `check:no-tailwind` clean across all converted panels;
  unit 283/283 across 66 files; `test:storybook` 5/5 with axe clean;
  build + publint clean.

## Cancellation and autorun acceptance (same session)

Two more shell stories complete the runtime requirement set:

- `Cancel execution` starts the 30-second fixture cell through
  `renderService.runCell` (the cell stop-action path), cancels mid-run via
  `cancelExecution`, and asserts the checkpoint rollback leaves the cell
  uncompleted with the output row hidden — LN-NB-022 Implemented.
- `Autorun stale cells` runs the fixture, edits the upstream cell source
  through `vault.process`, drives the view re-poll through `getRenderedCell`
  (which reloads the document and marks descendants stale), and asserts the
  debounced settings-gated autorun rerenders "n is 9." — with `Run notebook`
  (topological order) and `Run inputs` (input-change rerun), LN-NB-021 is
  Implemented.

Findings: Svelte `class:` directives bypass the static class audit, so
`class:hidden`/`class:opacity-70` in the cell chrome were converted to
`notebook-cell__row--hidden`/`notebook-cell__body--busy` BEM modifiers with
real CSS (the utilities had no effect without Tailwind). The story vaults now
seed `execution.autoRunStaleOnCellChange: true` because the frontmatter
autorun preference resolves through the metadata cache, which stays cold in
memory-adapter stories; the frontmatter-precedence rule itself is covered by
the ported frontmatter unit suite. The earlier Stage 7 Docker run failed
spec-first only because the snapshot caught this slice mid-edit; Docker
reruns against the committed state.

## Publication bundle lane (LN-NB-004/006/008/029)

`pnpm build:bundle` compiles `src/bundle-entry.ts` into `dist/main.mjs` and
`dist/app.css`: private sub-packages inline through the shared resolver;
`svelte`, `@lapis-notes/api` (+`/editor/language-service`),
`@lapis-notes/markdown`, `@lapis-notes/ui` (+`/search`), the thirteen Design
Core shadcn subpaths, the host-shared CodeMirror packages, and
`@lezer/highlight` stay external, mirrored one-for-one in the manifest
`lapis.runtime.entries.workspace.sharedDependencies` list. TypeScript (6.1MB)
and the DuckDB service split into lazy chunks; the worker bundle externalizes
Svelte/Design Core. The lane copies the four pinned DuckDB-WASM assets into
`dist/duckdb/`, mirrors `manifest.json` into `dist/`, and runs
`scripts/check-bundle-exclusions.mjs` (forbidden surfaces, inlining proof,
externalization proof, asset presence, runtime entry, `network.connect`).
The manifest declares twelve permissions matching the wired surface. The
svelte-package `dist` export surface is unchanged; npm publication and host
adoption remain separate gates (the host import-map alignment for the shared
list is a Stage 9 consumer-acceptance step).

Entry-chunk weight (16.6MB, datasets + vega/d3/Plot) matches the legacy
bundle scale; dataset trimming and chunk splitting remain recorded
follow-ups, not gates.

## Six-placement panel story suite (LN-NB-007 Implemented)

`Plugins/Notebook/Panels/{Variables,Dependencies,Packages}` — 18 svelte-csf
stories over a notebook-scaled adaptation of the family panel harness:
`panel-placements.ts` builds the six persisted layouts (the panel under test
plus the seeded Getting Started notebook as required document context),
`NotebookPanelDemo.svelte` boots the real App/workspace, and
`panel-story-helpers.ts` asserts single panel instance, destination
`WorkspaceViewHost`, workspace surface, transparent-root paint contract,
sidebar side/group-header semantics, viewport fill (fixed-position demo, no
reliance on Storybook body classes — the addon-vitest canvas has neither
`sb-main-fullscreen` nor `#storybook-root`), and per-story Show Code source.

Accessibility findings fixed in notebook-owned code during acceptance:
active tab/orientation/minimap-selected states now use Design Core's curated
`--primary`/`--primary-foreground` pair (the legacy accent/on-accent pairing
measured 4.25:1, below AA); the read-only dependency code snippet names its
CodeMirror content element; the graph surface became `role="application"`
(a labelled focusable diagram-editor container — svelte-ignore comments
document the deliberate pattern) after `role="button"` tripped
label-content-name-mismatch on inner visible text; edge labels now include
their visible variable-count chips.

Product fixes the stories surfaced: panel views seed a refresh at
registration and on layout-ready (deferred view creation can land after the
workspace file-open events), and panel context resolution falls back to any
open notebook leaf when a main-area panel tab holds the active leaf — the
legacy active-leaf-only resolution assumed sidebar panels. Axe context is
scoped to the demo root because Storybook's docs-source highlight chrome
sits outside it in test mode.

Full native suite after the slice: check chain green (routing 21 lanes /
story composition 4 families, 0 findings; svelte-check 0/0; no-tailwind
clean), unit 290/290, test:storybook 25/25 with axe clean, build + bundle
audit green, spec:validate 43 requirements.

## LN-NB-009 acceptance

The Dependencies Right Sidebar placement story now switches to the graph
surface and asserts the orientation change persists through
`plugin.getSettings().dependencyView.graphOrientation` — the same
`updateSettings`/`saveData` round-trip the wheel-zoom sensitivity setting
uses (exposed in the settings tab alongside the default-tab and orientation
dropdowns). Cycle and duplicate-definition errors render through the panel's
snapshot error branches; their detection is covered by the ported graph and
data suites. LN-NB-009 flips to Implemented; no Planned rows remain.
