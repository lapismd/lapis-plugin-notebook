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

## Docker acceptance for the section anatomy commit

Authoritative Docker `validation:all` passed for `8d4d734b` — run
`lapis-notebook-run-067e05cc-1c34-418f-8b1f-d3755c065ddb` (28 stories, 290
unit tests, bundle lane with exclusion audit and the externalized
`@lapismd/mira/codemirror`, all spec gates on the registry-pure worker with
the cohort archives).

## Default panel group presentation (user review round four)

User request: the default view should present Variables, Packages, and
Dependencies together in one right-sidebar group. New setting
`panels.openPanelGroupOnNotebookOpen` (default on) with a settings-tab
toggle row.

Runtime group creation was investigated first and rejected: `ensureSideLeaf`
group placement, `getOrCreateSidebarGroup` + `moveLeafToSidebarGroup`, and
`registerSidebarView` placement all updated the workspace model (group with
three leaves, dock opened at 22rem) but the host controller projects sidebar
group panes only from layout state, so the panel views never attached
(`containerEl` built, testids absent). The supported path is layout: plugin
`onload` runs before `workspace.loadLayout()`, so the plugin seeds the group
JSON (id `notebook-panel-group`, three fixed leaf ids) into the persisted
`.lapis/workspace.json` through the public vault read/modify surface;
first-run hosts without a layout file fall back to a one-shot runtime
`toJson`/vault-modify/`loadLayout` patch on first notebook open, which the
host persists for subsequent boots. The demo harness gained a
`panelGroupLayout` seed option and a `Panel group` story asserts the group
(by `data-sidebar-group-id`) with all three panels mounted inside.

Making the story root fill the viewport (a shared storybook.css rule pinning
`.plugin-workspace-demo` in canvas mode, required for the group's
lazy-mounted panes to intersect) exposed pre-existing a11y debt that
zero-sized renders had hidden from axe:

- Mira's numbered code-block hljs palette fails color-contrast upstream
  (`#b85c15`, 4.27:1; already flagged to the Mira owner). The shell axe
  context now excludes that upstream chrome (`.mira-code-block`); everything
  else stays scanned.
- Legacy status tones sit below AA on the white body surface, and
  `.notebook-cell__row--unselected` composites at 0.95 opacity (success
  measured 4.44:1). Replaced with a static AA palette — success `#166534`,
  error `#b91c1c`, warning `#b45309`, idle `#52525b` — plus `.dark`
  overrides; `light-dark()` was avoided because the vitest CSS pipeline
  downleveled it.
- The collapsed-source click-to-edit wrapper was `role=button` with a short
  aria-label around arbitrary code text — unfixable for label-in-name
  (WCAG 2.5.3). De-roled to a mouse-only enhancement (svelte-ignore
  annotated); keyboard/AT keep the toolbar Edit action.

The dependency-snippet highlighting moved from `miraClassHighlighter` to a
notebook-owned CodeMirror `HighlightStyle` with AA token colors: the Mira
import pulled its editor theme CSS into every importing graph (the source of
the shell-story hljs exposure). `@lapismd/mira` left the peers and the
manifest shared-dependency mirror; it stays a devDependency only so the
Storybook `optimizeDeps.include` sibling-prebundle entries resolve.

The Variables (inspector) section anatomy was confirmed live by computed
metrics: section padding 0, grey `#fafafa` summary with 12/16 padding, white
body with 12/16 padding, matching the reference.

Lanes: svelte-check 0/0, `pnpm check` green, 290 unit tests green,
Storybook 29/29 (12 + 6 + 11, native runtime), `pnpm build` + bundle
exclusion audit green, `pnpm spec:validate` green.

## Docker acceptance for the panel group commit

Authoritative Docker `validation:all` passed for `718ef0c4` — run
`lapis-notebook-run-1be9d79d-3b04-4133-8256-01d30b6b3074` (29 stories
including the new `Panel group` acceptance, 290 unit tests, static
Storybook build, bundle lane with exclusion audit, spec validate/mdbook/
spec-first, routing audit 21 lanes 0 findings, story parity 4 families,
App-ownership audit green).
