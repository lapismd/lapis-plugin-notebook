# 2026-10-26 — App-editor wrapping, icon registry, tooltips, borders, showcases

User-reported defects from the live Storybook app, all fixed in
notebook-owned code:

## Cell editor wrapped in the app editor

`notebook-cell-source-editor.svelte` rebuilt on the public
`markupEditor({ language, app }, ...extensions)` factory from
`@lapis-notes/api/editor/core` — the same composition the CSV plugin's
`csvSourceExtensions` uses. The host factory supplies the Mira base
extensions (theme, gutters, history, keymaps, autocomplete, folding), the
live `editorConfig` compartments, and the `cm-editor-source
markdown-editor-surface` host classes; the notebook layer keeps only the
cell language pack, the absolute-document line-number gutter (the
configuration gutter is suppressed per view through
`editorConfig.update(..., "editor.display.showLineNumbers", false, app)`),
the TypeScript virtual-document projection, and the inline-editor identity
classes. `@lapis-notes/api/editor` is imported for its `editor.css`
side-effect (the stylesheet lives on the api editor module, not on
`editor/core`), and both subpaths join the manifest shared-dependency list.
The previous hand-rolled extension list also carried `:global()` selectors in
plain CSS that browsers silently dropped.

## Dataframe borders

The legacy `app.css` copy had truncated the first six selector lines of the
`--notebook-*` variable block (`.notebook-view, .notebook-cell,
.notebook-output, .notebook-dataframe, .notebook-inspector,
.notebook-dependencies,`), scoping every theme variable to `.notebook-packages`
only. Outside that scope `border: 1px solid var(--notebook-surface-border)`
was invalid at computed-value time and collapsed to `border-style: none`.
Selector list restored.

## Icons and tooltips

Design Core 0.6 deprecated `buttonVariants()` (it returns an empty string);
button paint now flows from global `[data-ui-component="button"]
[data-variant][data-size]` selectors. Popover/DropdownMenu triggers in the
Toolbar, JsonCell, ListCell, and the cell output menu carry those data
attributes instead of the dead class strings. The legacy run-all glyph is
registered with Design Core's workspace icon registry via
`registerWorkspaceIcon` (the api `addIcon` registry does not feed
`WorkspaceIcon`); `trash-2` (absent from the current iconify-lucide
collection) became `trash`. Plugin-side controls (cell run/stop, rail and
collapse toggles, source-edit target, output menu, column profile) gained
`title` tooltips beside their aria-labels.

## Filter badge semantics

The verbatim-ported `filterActive={Boolean(summaryByKey[column.name])}`
labelled every summarized column as FILTERED; real filter state now threads
DataFrameViewer → TableContainer → TableHead.

## Input table a11y

Row-selection radios/checkboxes in the table input carry
`aria-label="Select/Toggle table row N"` for the axe `label` rule.

## Legacy showcases

The legacy e2e-vault `System Guide.notebook.md` and `Notebook Gallery.notebook.md`
plus their four vault assets port as story fixtures with two new shell
stories (`System guide`, `Gallery`): async cells, vault FileAttachments
(json + typed csv), relative ESM imports, `view(Inputs.text/table/range)`,
md/html interpolation with escape semantics, `md`/`tex` htl helpers,
`lapis.table`, `registerVaultFile` + `read_csv_auto` SQL with interpolated
filters, and `lapis.notes` app-table queries. DOM-backed outputs mount
asynchronously after the run resolves, so post-run assertions poll.

Validation (native): svelte-check 0/0; check:no-tailwind clean; unit 290/290;
test:storybook 27/27 with strict axe; build + bundle exclusion audit green;
spec:validate 43 requirements.
