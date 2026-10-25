# 2026-10-25 — Stage 2 document model, registrations, and shell acceptance

## What landed

- Document model ported verbatim from legacy `packages/notebook/src/lib`:
  `notebook-path.ts`, `notebook-file.ts`, `model/` (cell/document/frontmatter
  re-exports over `@lapis-notes/notebook-core`), `parse/`,
  `templates/cells.ts`, with the legacy `parse-notebook-document`,
  `notebook-frontmatter`, and `notebook-settings` suites.
- Authoring commands ported: `append-cell-template`,
  `ensure-notebook-frontmatter`, `create-demo-notebooks`,
  `notebook-cell-suggest` (slash menu) with their four legacy test suites.
  `run-active-notebook` is deliberately excluded until the Stage 4 runtime.
- Stage 2 `NotebookPlugin.onload`: settings initialization through
  `loadData`/`saveData`, `notebook.autorun` metadata property type,
  file-access `notebook` view, editor-view contribution with
  `*.notebook.md` filename patterns, `notebook.md` extension association,
  markdown editor suggest, settings tab, and six commands (convert note,
  demo folder, four insert-cell variants).
- Thin `NotebookView extends MarkdownView` (published
  `@lapis-notes/markdown`, added as a peer dependency): opens `.notebook.md`
  with the standard source/live-preview/reading modes; cell chrome and header
  actions land with the render stage.
- Shell story now restores a `notebook` leaf over `Getting Started.notebook.md`
  and its play asserts the `NotebookView` instance, view type, all six
  command ids under the `lapis-notebook:` prefix, and settings
  initialization; Show Code source updated to match.
- Private sub-packages resolve from TypeScript source through
  `scripts/vite-notebook-packages.ts` (shared by both Vitest projects and
  the Storybook pipeline via each package's `exports` map) plus matching
  tsconfig paths, keeping the published root manifest portable (LN-NB-006).

## Adaptations from legacy

- Legacy keeps `notebook-plugin.ts` at `src/`; this repo keeps the svelte-package
  layout with everything under `src/lib/` — the settings-tab import rewired
  accordingly.
- `notebook-settings.ts` declares `NotebookDependencyGraphOrientation`
  locally (byte-identical to the legacy dependencies-graph export) until the
  Stage 3 dependencies panel ports; the import line is then restored.
- Settings tab drops the two "Open packages" rows (and their
  `validateNotebookDependencyRegistry` helpers) until the Stage 3 Packages
  view provides `openNotebookPackages`; every other row is verbatim.
- `updateSettings` omits the legacy autorun-timer reconciliation (runtime
  stage re-adds it) and is annotated as such.

## Validation

- `svelte-check` (incl. `packages/*/src`): 0 errors, 0 warnings.
- Unit lane: 43 files / 156 tests passed (was 36 / 130; +7 ported legacy
  suites, +26 tests).
- `test:storybook`: 1 file / 1 test passed with the Stage 2 registration
  assertions and axe clean.
- Spec: LN-NB-002/005/010/011/012/013 flipped to Implemented with evidence;
  LN-NB-004 amended for the peer-resolved Markdown surface; LN-NB-006 added
  for the portable-manifest/bundle-inlining contract; governance records the
  resolver script.
- Docker `validation:all` re-run recorded in the run reports; see the
  stage-0 record for the archive-acceptance setup.
