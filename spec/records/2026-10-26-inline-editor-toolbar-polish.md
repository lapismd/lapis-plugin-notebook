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

## Expandable section bodies on the body surface

User feedback: in the variables/packages/dependencies panels the collapsible
section headers keep their current tint, but expanded bodies should read on
the white body/document surface. Implemented in `src/lib/styles.css` with
structural selectors (`.notebook-inspector details > summary + *`,
`.notebook-packages details > summary + *`) plus a semantic
`notebook-dependencies__snippet-body` class on the two dependencies
selection-snippet wrappers, all painting
`var(--background-primary, var(--card))`. Verified live in all three panel
stories: bodies rgb(255,255,255), summaries/sections unchanged.

## Docker acceptance for the section-body paint

Authoritative Docker `validation:all` passed for `7e9f7bdb` — run
`lapis-notebook-run-f78517cb-ebfd-43bc-a413-7ae2d14d94bd` (28 stories, 290
unit tests, bundle lane with exclusion audit, all spec gates on the
registry-pure worker with the cohort archives).

## Section anatomy follow-up (user review round three)

The first white-body pass painted only the body wrapper, leaving inset gaps
and a white header. Revised anatomy: `details` paints the white body surface
full-bleed to the section border separator, `summary` paints the panel family
grey (`--background-primary-alt`), verified live at rgb(250,250,250) over
rgb(255,255,255) in the variables panel and across all packages sections.

Dependencies panel follow-ups from browser review: the floating graph
controls lost their `right-4 bottom-4` offsets in the utility conversion
(dead strings removed, insets restored at 1rem via `[data-graph-controls]`);
the graph meta row's converted rule mis-assigned `font-size:
var(--text-muted)` (now 12px with the muted color); and the read-only code
snippets showed no syntax colors because the standard lezer
`classHighlighter` emits `tok-*` classes while Mira's token colors target
`cm-*` — the snippets now use the public `miraClassHighlighter` from
`@lapismd/mira/codemirror` plus the `mira-code-editor` scope class
(keywords rgb(124,58,237), numbers rgb(180,83,9) verified live). `@lapismd/mira`
joins the root peers and the manifest shared-dependency mirror.
