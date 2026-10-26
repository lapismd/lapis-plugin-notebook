# 2026-10-26 — Notebook view routing: exclusive editor-view contribution

## Symptom

The run-all header action appeared only periodically in the live app: leaves
restored from explicit layout state (`type: "notebook"`) mounted
`NotebookView` with its actions, while files opened through generic paths
(explorer clicks, `openFile`) resolved to the markdown plugin's view — which
carries no notebook chrome. Cells still rendered in markdown views because
the bridged post-processor registry is surface-global, masking the misroute.

## Root cause

`registeredEditorViewForPath` ranks contributions by priority tier
(`option` < `default` < `exclusive`) and only then by pattern specificity.
Markdown registers `*.md` with `priority: "exclusive"`; the notebook
registered `*.notebook.md` with `priority: "default"`, so markdown won every
generic resolution regardless of the more specific pattern.

## Fix

The contribution now follows the transcript plugin contract in
`lapis-plugins`: `priority: "exclusive"` with the specific
`*.notebook.md` pattern (exclusive ties break on specificity, so notebook
files route to `NotebookView` while plain markdown stays with the markdown
view). `viewType` is declared explicitly and the contribution id follows the
`<view>-file` convention.

## Regression coverage

The `Workspace` shell story asserts `determineViewTypeForPath` resolves the
fixture to the notebook view type and that opening it through
`workspace.getUnpinnedLeaf().openFile(...)` yields a `NotebookView` instance
with the `Run notebook now` header action in the DOM.

Validation (native): Workspace story green with the regression; full gates
run with the slice commit.

## Docker acceptance for the routing commit

Authoritative Docker `validation:all` passed for `d36df323` — run
`lapis-notebook-run-302668f6-fd10-4d61-8802-d4690f49dc5a`.

## Follow-up: input table double perimeter

Browser review of the System Guide table input showed double borders on the
left/right/top: the markdown package styles document tables inside rendered
markdown surfaces (`.markdown-rendered :is(th, td),
.markdown-preview-surface .markdown :is(th, td)`), which reached the input
table cells inside the reading surface. The input stylesheet now mirrors
those scopes with the input table class added (outranking them), resetting
cells to row separators only; verified live: container 1px all sides, cells
0/0/0/1, last row 0.

## Docker acceptance for the border reset

Authoritative Docker `validation:all` passed for `9d11fa44` — run
`lapis-notebook-run-6f783fa9-f470-451c-947d-10e672019ae4` (28 stories, 290
unit tests, bundle lane with exclusion audit, all spec gates on the
registry-pure worker with the cohort archives).
