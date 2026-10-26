# 2026-10-26 — Stage 5 inputs surface and reactive rerun acceptance

## What landed

- `Interactive Inputs.notebook.md` fixture: a `view(Inputs.range(...))`
  TypeScript cell plus a `{{count}}` markdown cell.
- `Run inputs` story (fourth App-backed shell story): boots the fixture in
  reading mode, runs through the **in-process DOM runtime** (the eligibility
  policy correctly rejects the worker for DOM-backed notebooks), asserts the
  Design Core slider mounts and the markdown cell interpolates "Count is
  2.", then drives the hidden range input with `fireEvent.input` and asserts
  the debounced targeted rerun updates the downstream cell to "Count is 5."
  Axe clean.
- Demo harness gained a `notebookPath` prop selecting the opened fixture.
- `packages/input` UI runtime now passes `options.label` through as
  `aria-label` on every Design Core mount (slider/number/text/textarea/
  switch), fixing the `aria-input-field-name` violation the story exposed —
  accessible names are notebook-owned wiring, not a Design Core gap.

## Findings

- The viewof transform is a line-scanner (ported verbatim): a trailing comma
  inside a multi-line `view(...)` call produces `(expr,)` and a syntax
  error. Legacy fixtures avoided trailing commas; this is a legacy-parity
  quirk, recorded rather than diverged. Cell authors and future fixtures use
  the legacy formatting.
- `values[cellId]` (cell outputs) shadows same-named variable definitions in
  `{{name}}` interpolation — fixtures keep cell ids distinct from variable
  names, matching the legacy System Guide conventions.

## Verification impact

- LN-NB-021 stays **Planned**: execution order (Run notebook) and
  input-change targeted rerun (Run inputs) are demonstrated; edit-triggered
  stale marking and autorun debounce acceptance remain open.
- Stage 5 stdlib surface (md/tex via htl, d3/Plot lazy loads, sample
  datasets) is ported and lazily loaded; dataset trimming and worker-chunk
  weight stay deferred to the publication bundle slice (LN-NB-006) — the
  20MB JSON datasets import statically inside the lazily loaded stdlib
  bootstrap, matching legacy chunking.

## Validation

- Unit: 61 files / 267 tests (startup-thin audit included).
- `svelte-check` 0/0; `test:storybook` 4/4 (Workspace, Run notebook, Safe
  mode, Run inputs) with axe clean.

## Stage 6 — DuckDB-WASM acceptance (same session)

`Data Queries.notebook.md` fixture (plain `SELECT 42 AS answer, 'lapis' AS
source` plus `SELECT count(*) FROM lapis.notes`) and the fifth shell story
`Query data`: SQL cells execute on DuckDB-WASM through the in-process
transport per eligibility policy, engine assets resolve through the plugin
asset paths (story harness pins `basePath` to the Storybook `staticDirs`
mount of `@duckdb/duckdb-wasm/dist`; hosts use the plugin asset server),
tables render through the dataframe viewer, and the app-derived `lapis.notes`
snapshot table answers the count query — LN-NB-025 Implemented (vault-file
registration and the remaining snapshot tables ride the ported
register-app-tables suites). Storybook `optimizeDeps` prebundles
`@duckdb/duckdb-wasm` under `noDiscovery`.

Full native suite after the slice: test:storybook 5/5, unit 267/267 across 61
files, svelte-check 0/0.
