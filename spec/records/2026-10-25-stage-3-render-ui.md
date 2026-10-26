# 2026-10-25 — Stage 3 render UI port (families 1–2: dataframe + outputs)

## What landed

- Complete dataframe family converted from the legacy components: eight typed
  cells (blob, boolean, date, json, list, null, numeric with sparkbars,
  text), DataCell dispatcher, DataRow with expandable rows and keyboard
  activation, TableHead/ColumnHeader with sort priority and profile trigger,
  DataFrameColumnSummary (compact histograms/boolean bars + detail stats),
  ExpandedRowDetail, ColumnProfilePanel (Design Core Sheet), FilterBar
  (numeric/boolean/date/text filters), Toolbar (search, columns popover,
  export popover, density + sparkbars settings), PaginationBar,
  TableContainer with `@tanstack/svelte-virtual` virtualization over 200 rows
  and the keyNav action, DataFrameViewer composition, DataFrameTable
  inference wrapper, and `state.svelte.ts` viewer state.
- Output renderers converted: error, html, chart (vega-embed with
  `$state.snapshot` guard), dom and input (render-service DOM claims), table
  (dataframe viewer), markdown, plus the output-renderer dispatcher.

## Conversion rules applied

- Legacy `@lapis-notes/ui` primitives remapped to `@lapismd/design-core/shadcn`
  exports (button + `buttonVariants`, badge, popover, input, separator,
  switch, alert, sheet). Bits-UI 2.x triggers take no `child({props})`
  snippet; popover triggers compose `buttonVariants` classes directly,
  matching Design Core's own example pattern.
- Every Tailwind utility converted to notebook-owned native CSS in
  `src/lib/styles.css` (converted values mirror the Tailwind 4 defaults the
  legacy components rendered with, including the fixed `#f5f5f5` boolean
  track preserved for parity); `check:no-tailwind` stays green throughout.
  The legacy `app.css` BEM/color layer was adopted as the stylesheet base.
- `markdown-output` replaces the retired legacy `MarkdownPreview` with the
  public `MarkdownEmbed` from `@lapis-notes/markdown`, receiving `App` and
  `sourcePath` explicitly through `output-renderer` per App-ownership rules.
- Excluded dead legacy variants (nothing imports them): `DataFrameCell`,
  `DataFrameColumnHeader`, `DataFramePagination`, `DataFrameToolbar`.

## Validation

- `svelte-check`: 0 errors, 0 warnings.
- `check:no-tailwind`: clean.
- Unit: 59 files / 257 tests (dataframe logic suites from the prior slice
  keep passing against the converted components' shared modules).
- `test:storybook`: shell batch green (components mount in stories with the
  cell-chrome slice next).

## Cell chrome, plugin wiring, and execution acceptance

The second half of the render port landed in the same stage: the CodeMirror
cell source editor (standard lezer `classHighlighter` replaces the API's
internal copy — flagged, zero core change), the 762-line `notebook-cell`
chrome (rails, collapse, run/stop action, status footer, output section) with
explicit `app` props replacing the legacy ambient global, and
`notebook-markdown-cell`. The full `NotebookView` now subclasses the
published `MarkdownView` with header actions and the auto-run pane-menu item
(panel menu items return with Stage 7 panels).

The plugin was assembled from the legacy 1,799-line plugin minus the deferred
sections (panels/packages/inspector views and commands, TypeScript language
provider, Electron sidecar): render-service registration, the cell directive
post-processor, run/clear commands (`run-active-notebook` ported with its
suite), status-bar items with context-key when-expressions, safe-mode gating,
input-rerun and stale-autorun scheduling, and notebook-state persistence.
Deferred items are annotated in source and recorded in verification statuses.

Findings during acceptance:

- The legacy engine has no bare-final-expression display (partial Observable
  stance): values render through `display(...)`, and `values[cellId]`
  (outputs) shadows same-named variable definitions in `{{name}}`
  interpolation. The initial fixture tripped this; fixtures now use distinct
  cell ids and `display()`, matching legacy System Guide conventions.
- Mira hoists directive attributes onto host elements: `lang="md"` violated
  axe `valid-lang`. The post-processor now moves the directive `lang` to
  `data-notebook-cell-lang` before mounting (plugin-owned DOM hygiene).
- Two full-App stories in one CSF file require the donor `args`-based story
  pattern; a second `render`-function story rendered the docs fallback.
- The new API command executor is `app.commands.executeCommand(id)`.
- `packages/input` lazy UI runtime remapped from legacy `@lapis-notes/ui`
  subpaths to `@lapismd/design-core/shadcn` (input/slider/switch/textarea);
  its peer moved to design-core. Bits-UI contracts (`value: [v]`,
  `onValueChange`) matched unchanged.
- Storybook `optimizeDeps.include` gained `typescript` for the engine's lazy
  compiler import under `noDiscovery`.

Acceptance: `Plugins/Notebook/Shell → Run notebook` boots the workspace in
reading mode, asserts both cells mount through the bridged post-processor
registry, executes `lapis-notebook:run-active-notebook` through the dedicated
worker transport (engine logs confirm worker round-trip), asserts the
TypeScript cell renders `42`, the markdown cell renders
"The answer is 42." through `MarkdownEmbed`, and `appDatabase.getNotebookState`
persists per-cell typed state — axe clean. LN-NB-020/023/028 flipped to
Implemented on this evidence; LN-NB-021/022/024/026 stay Planned pending
their own executed acceptance.

## Remaining

- Component stories for the dataframe/output/cell families and the
  six-placement panel stories as panel views land (Stage 7).
- Cancellation, safe-mode, autorun/input-rerun, and startup-thin acceptance
  stories (Stage 4 completion).
- DuckDB-WASM slice (Stage 6), inputs/stdlib surface stories (Stage 5),
  packages registry (Stage 7), publication bundle (LN-NB-006).
