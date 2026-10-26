# 2026-10-26 — Inline editor surface, toolbar polish, table geometry, input showcase

Second user-feedback round on the live Storybook app.

## Cell editor inline surface

The `markupEditor`-wrapped cell editor inherited Mira's document-editor
geometry: `& > .cm-scroller` file-margin padding (2rem block) and a centered
700px readable column, plus a paper-white background. Mira's
`.markdown-editor-surface` scope remaps theme variables on the editor
element itself, so host-level rebinds lose; the notebook now captures the
cell-surface colors in pass-through custom properties on
`.notebook-cell__editor` and rebinds `--mira-editor-background`,
`--file-margins-*`, and `--file-line-width` on `.cm-editor.cm-editor-source`
(0,3,0 beats the Mira scope), and paints the editor background with the
captured surface color (Design Core styles `.cm-editor` with
`var(--background)`, which the Mira scope remaps to paper white). Result:
57px-tall left-aligned editor flush with the cell surface; mono face kept.

## Dataframe toolbar

Filters/Columns/Export/Settings are icon-only 32px triggers with Design Core
shadcn tooltips; the tooltip trigger composes the popover trigger through the
bits-ui `child({ props })` snippet so one button carries both contracts
(Design Core's own MessageActions pattern). Row density is a button-group
split control: label button + separator + caret trigger opening a radio menu
bound to the persisted setting. The toolbar row wraps (`flex-wrap`) and the
search field flexes (`flex: 1 1 12rem; min-width: 10rem`) on narrow
viewports.

## Input table geometry

Mira's reading-surface rule (`.markdown-preview-surface--reading .markdown
table { margin-block: var(--table-preview-spacing, 1rem) }`, present in two
loaded copies) gapped input tables 16px below their rounded container; the
input host rebinds `--table-preview-spacing: 0rem`. The last row's
border-bottom is removed so the container owns the single outline.

## Input Types showcase

`Input Types.notebook.md` fixture + `Input types` story mount all thirteen
UI-backed input factories (text, textarea, number, range, toggle, email,
tel, url, password, date, datetime, color, table) one view per cell — the
legacy showcase convention; a multi-view cell exposed a legacy viewof
registration edge (first-cell claims lost) recorded rather than diverged.
The story also caught a fixture bug: `Inputs.number` takes an extent array
like range, not a merged options object.

Validation (native): svelte-check 0/0; no-tailwind clean; unit 290/290;
test:storybook 28/28 strict-axe; build + bundle exclusion audit green;
browser-verified editor metrics (6px/12px scroller padding, unified
rgb(251,251,252) surface), 2px table gap, tooltip content, and split-button
round-trip.

## Docker acceptance for the polish commit

Authoritative Docker `validation:all` passed for `a613cd27` — run
`lapis-notebook-run-172e9375-bd68-41d5-b3d9-8c8eb32fb256`.
