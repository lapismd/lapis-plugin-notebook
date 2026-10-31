# Notebook canvas-table migration progress

## Delivery state

- Specified: complete contract written before runtime changes.
- Implemented: pending.
- Focused-tested: pending; no passing runtime evidence claimed.
- UI-approved: pending.
- Fully-qualified: deferred until UI approval.

## Source and ownership

Isolated workspaces: design-core-notebook-tables, lapis-plugin-notebook-canvas-tables,
lapis-notes-notebook-canvas-host and lapis-plugins-notebook-canvas-compat.
Bases: Design Core f16631c7; Notebook 04c858d7; Notes 6ffa9caf; Plugins be302f37.
Existing workspaces and Storybook 10329 are preserved. No push/merge/publication.

## Implementation slices

1. Specification and exact-command evidence, committed before runtime.
2. Generic column snippets, measured details, density/chrome and selection scope;
   custom operator validation; focused shared regression checks.
3. Notebook typed adapter/evaluator, result/dataframe/input/preview integration,
   focused stories, public types and lifecycle checks.
4. Host explicit module exposure and minimal package compatibility preparation.
5. Docker review server with verified archived dependencies; integrated UI review.
6. Only after approval: full shared/host/package qualification, authorized releases,
   registry refresh and final Notebook Docker validation:all and packed host intake.

## Verification matrix

| Boundary           | Before UI approval                                                       | After UI approval                                 |
| ------------------ | ------------------------------------------------------------------------ | ------------------------------------------------- |
| Geometry/selection | Exact units, scrolled/resized overlays, scoped select-all                | Full Design Core checks                           |
| Rich content       | Headers, histograms, custom cells, measured details, a11y                | Full interaction/accessibility and static catalog |
| Typed filters      | Null/blank, regex/errors, range, dates, precise numbers, nested groups   | Full units and package consumers                  |
| Inputs             | Values/defaults/required/disabled, no sort/filter input, repeated embeds | Full Notebook validation:all                      |
| Lifecycle          | Fresh Docker browser, focus, portal, teardown, large bounded dataset     | Cold packed plugin in supported hosts             |
| Public contracts   | Strict focused types, exports, size/native-CSS audits                    | Packed-consumer and release checks                |
| Governance         | spec:first/spec:check, formatter, doctor/search                          | Complete evidence and release disposition         |

## Commands and observations

- `jj git fetch --remote codex-https --branch main`: four owners succeeded.
- `pnpm view @lapismd/spec-validator version --json`: latest Deno-free 0.2.0.
- Initial searches under unintended Node 26 ABI 147: QMD native mismatch;
  supported fallback is rg. Repeat doctor/search under explicit Node 24 PATH.
- Notebook `pnpm install --frozen-lockfile`: one configuration failure because
  the local hook checksum was active. `pnpm install --frozen-lockfile --ignore-pnpmfile`
  succeeds with registry resolution; no tracked lock mutation.
- All runtime test counts are pending. No screenshot comparisons/baseline updates.

## Resume

Read the owning canonical requirements and this record, inspect each workspace
with jj st, run focused exact targets and append their failure counts. Archive
provenance and actual installed lock belong to the Docker receipt. Do not run
broad suites, static catalog or publication until the user approves both UIs.
After approval run Design Core spec:first/spec:check/checks and packed acceptance;
complete affected host/package lanes; obtain release authorization; consume
published registry versions; run Notebook validation:all and real plugin loading.

Baseline `pnpm test -- src/lib/render/dataframe/__tests__/filter.test.ts packages/input/src/__tests__/dom-runtime.test.ts`: 12 passed, 0 failed in Docker. Initial spec:check had 8 authoring findings (6 verification rows, duplicate governance ID); exact rerun passed after correction. Node 24 doctor/search pass; full lanes remain deferred.

## UI feedback: Lucide row disclosure (31 October)

This follow-up is implemented and focused-tested; UI approval and full qualification
remain pending. The broader migration is still in progress. Replace text triangles
with decorative Lucide ChevronRight/ChevronDown, retain native button interaction,
and expose matching Expand/Collapse labels and aria-expanded states. The rich-row
story now checks both icons, visible details, pointer expansion and Enter collapse.
No screenshot comparison or baseline update was performed.

The follow-up is isolated above the preserved migration change `tulslpqn`.
Fresh review snapshot: `da04b313`, worker
`lapis-notebook-run-d9e6d053-fdfb-4e64-b2a2-a601efffebb0`, loopback port 10529.
Design Core review on 10429 and original Storybook on 10329 were not restarted.
The Design Core archive SHA256 remains
`bc8f04bd129a0cf4dbb2d392d7cecfa2175b8a86bfa40239858fc89442c58bb4`.

Exact commands and results (Node 24 PATH for local tools):

- `pnpm view @lapismd/spec-validator version`: 0.2.0, already installed.
- `pnpm exec spec-validator doctor`: 10 passed, 1 alias warning, 0 failures.
- `pnpm spec:search -- "expanded rows"`: argument parsing failed once; corrected
  to `pnpm spec:search "expanded"`, which returned canonical QMD results.
- Baseline worker: `docker --context omarchy exec -e LAPIS_NOTEBOOK_VALIDATION_RUNTIME=native -e LAPIS_NOTEBOOK_VALIDATION_WORKER=1 -w /work/lapis-plugin-notebook lapis-notebook-run-6cf2c315-d1ee-40d5-b348-81e1a8f9d9ce pnpm test:storybook -- src/stories/tables/NotebookTables.stories.svelte`:
  5 passed, 0 failures. Earlier spaced-name selector matched nothing (5 skipped),
  so that invocation is not counted as verification.
- `pnpm validation -- review-stop`, then
  `LAPIS_NOTEBOOK_VALIDATION_ARCHIVES="$PWD/.local/canvas-archives.json" pnpm storybook:review`:
  owned fresh Docker review started successfully.
- Fresh worker: `docker --context omarchy exec -e LAPIS_NOTEBOOK_VALIDATION_RUNTIME=native -e LAPIS_NOTEBOOK_VALIDATION_WORKER=1 -w /work/lapis-plugin-notebook lapis-notebook-run-d9e6d053-fdfb-4e64-b2a2-a601efffebb0 pnpm test:storybook -- src/stories/tables/NotebookTables.stories.svelte`:
  5 passed, 0 failures, including RichCellsAndExpandedRows interaction and a11y.
- Same Docker exec prefix with `pnpm spec:check`: 3 specification lanes passed;
  routing 25 lanes/0 findings, parity 6 families/0 findings, ownership 1 passed.
- Same prefix with `pnpm check:canvas-table-types`: 1 error, 0 warnings, on
  `TableFilters.svelte:27` (`aria-description` unsupported by Popover.Trigger).
  That source is unchanged from pre-feedback `ba83f9e8`; the migration type gate
  remains open. No type gate or assertion was weakened for this icon follow-up.
- `/Users/stevejuma/code/lapismd/design-core-notebook-tables/node_modules/.bin/prettier --plugin /Users/stevejuma/code/lapismd/design-core-notebook-tables/node_modules/prettier-plugin-svelte/plugin.js --check src/lib/render/dataframe/DataFrameViewer.svelte src/stories/tables/NotebookTables.stories.svelte`:
  both files passed. New story remains 84 physical lines (limit 300).

Resume broader focused migration qualification and the outstanding filter-trigger
type correction separately. Do not begin full suites, push, merge or publish from
this review feedback. The running Docker review remains available for user review.
