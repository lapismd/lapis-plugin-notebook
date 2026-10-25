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

## Remaining in Stage 3

- `notebook-cell-source-editor.svelte` (CodeMirror cell editor),
  `notebook-cell.svelte` chrome, `notebook-markdown-cell.svelte`, and the
  reading-mode post-processor registration through the bridged API registry,
  with component stories and six-placement panel stories as views land.
