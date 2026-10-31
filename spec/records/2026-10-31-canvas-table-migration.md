# Notebook canvas-table migration progress

## Delivery state

- Specified: complete contract written before runtime changes.
- Implemented: result/input/preview UI candidate and subsequent feedback slices;
  host compatibility and final migration cleanup remain in progress.
- Focused-tested: review stories and feedback regressions as recorded below;
  remaining migration gates and the filter-trigger type issue stay open.
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
- Initial specification-stage runtime counts were pending; executed feedback
  evidence follows below, without screenshot comparisons or baseline updates.

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

## UI feedback: clipped column summaries (31 October)

Implemented and focused-tested; UI approval and full qualification remain pending.
The Notebook adapter reserved 112px for a title/type row plus a histogram and
range, clipping the summary below the shared header. Notebook's chart component
also referenced unavailable legacy colour tokens. This fix belongs to Notebook:
use the existing public header-height contract at 144px (64 without summaries),
prevent flex shrinking, contain summary padding with border-box sizing, restore
sans header typography, and use Design Core chart/muted tokens. No shared-package
CSS override, package patch, screenshot comparison or baseline update was added.

The new `table-header.story-play.ts` regression checks summary geometry and
resolved nontransparent histogram/boolean bar paint through the actual viewer.
Cold source snapshot `486f73a4` is available in the owned review worker
`lapis-notebook-run-e08a3745-2d0a-4186-908f-eef5a68caf26` on loopback port 10529.
The Design Core archive checksum is unchanged from the preceding feedback slice.

Commands and failure counts:

- `pnpm view @lapismd/spec-validator version`: latest 0.2.0, already installed.
  `pnpm exec spec-validator doctor`: 10 passed, 1 script-alias warning, 0 failures.
  `pnpm spec:search "column summaries"`: QMD returned LN-NB-050.
- `LAPIS_NOTEBOOK_VALIDATION_ARCHIVES="$PWD/.local/canvas-archives.json" pnpm test:storybook -- src/stories/tables/NotebookTables.stories.svelte -t RichCellsAndExpandedRows`:
  baseline 1 failed, 4 skipped. The summary bottom was 280px against a maximum
  header bottom of 269px (including the assertion's 1px rounding tolerance).
  Receipt: `.local/validation/runs/lapis-notebook-run-2afe3f3a-d91d-4034-bc6c-05b09977a033`.
- `LAPIS_NOTEBOOK_VALIDATION_ARCHIVES="$PWD/.local/canvas-archives.json" pnpm storybook:review`:
  restarted only the owned Notebook review after the fix, from a fresh snapshot.
- Post-fix Docker prefix for the following commands:
  `docker --context omarchy exec -e LAPIS_NOTEBOOK_VALIDATION_RUNTIME=native -e LAPIS_NOTEBOOK_VALIDATION_WORKER=1 -w /work/lapis-plugin-notebook lapis-notebook-run-e08a3745-2d0a-4186-908f-eef5a68caf26`.
- Prefix + `pnpm test:storybook -- src/stories/tables/NotebookTables.stories.svelte -t RichCellsAndExpandedRows`:
  exact regression 1 passed, 0 failed, 4 skipped.
- Prefix + `pnpm test:storybook -- src/stories/tables/NotebookTables.stories.svelte src/stories/PluginWorkspace.stories.svelte -t 'ResultsAndStructuredFilters|RichCellsAndExpandedRows|LargeTypedResults|InspectorSample|IndependentTables|TableFilters'`:
  7 passed, 0 failed, 27 unrelated shell stories skipped. Includes both real
  desktop/mobile TableFilters stories and all five table scenarios, with the
  fatal runtime guard and existing accessibility checks retained.
- Prefix + `pnpm test -- src/lib/render/table/table-files.test.ts`: 24 passed,
  0 failed; the new helper is 34 physical lines.
- Prefix + `pnpm spec:check`: 3 specification lanes passed, routing 25 lanes/0
  findings, parity 6 families/0 findings, ownership 1 passed.
- `/Users/stevejuma/code/lapismd/design-core-notebook-tables/node_modules/.bin/prettier --plugin /Users/stevejuma/code/lapismd/design-core-notebook-tables/node_modules/prettier-plugin-svelte/plugin.js --check src/stories/tables/table-header.story-play.ts src/stories/tables/NotebookTables.stories.svelte src/lib/render/dataframe/DataFrameViewer.svelte src/lib/render/dataframe/DataFrameColumnSummary.svelte`:
  all four files passed.

Full qualification remains deferred. The previously recorded filter-trigger type
error and the broader migration's remaining focused gates are still outstanding.

## UI feedback: toolbar count, boolean contrast and ScrollArea (31 October)

Implemented and focused-tested; UI approval and full qualification remain pending.
Remove the duplicate total from Toolbar while retaining optional query timing
and pagination counts. Place boolean counts beside decorative, translucent bars
at full opacity on the header surface. CanvasTable now uses Design Core's public
ScrollArea viewport; Notebook adds no outer scroller or private shared CSS override.

Review source `fd7f4e61`, owned worker
`lapis-notebook-run-f606e779-3a8d-44a4-a256-f30a5630abf2`, loopback port 10529.
Updated Design Core 0.8.0 review archive SHA256:
`a54f27c6f604910e9a003638f409b286733576bc23dd5823754fc0bc6359d354`.
Tracked dependency manifests/locks remain registry-portable. The archive is
temporary review intake, not a release or completed packed-consumer qualification.

- Baseline `LAPIS_NOTEBOOK_VALIDATION_ARCHIVES="$PWD/.local/canvas-archives.json" pnpm test:storybook -- src/stories/tables/NotebookTables.stories.svelte -t RichCellsAndExpandedRows`:
  1 failed, 4 skipped; expected no duplicate toolbar count, received `Filters 45 rows`.
  Receipt `.local/validation/runs/lapis-notebook-run-14d15645-275f-4092-856e-107611b49291`.
- Restarted the owned review with
  `LAPIS_NOTEBOOK_VALIDATION_ARCHIVES="$PWD/.local/canvas-archives.json" pnpm storybook:review`.
- Post-fix command prefix:
  `docker --context omarchy exec -e LAPIS_NOTEBOOK_VALIDATION_RUNTIME=native -e LAPIS_NOTEBOOK_VALIDATION_WORKER=1 -w /work/lapis-plugin-notebook lapis-notebook-run-f606e779-3a8d-44a4-a256-f30a5630abf2`.
- Prefix + `pnpm test:storybook -- src/stories/tables/NotebookTables.stories.svelte -t RichCellsAndExpandedRows`:
  1 passed, 0 failed, 4 skipped; checks no duplicated count, real ScrollArea grid,
  summary containment, coloured bars, and separate full-opacity boolean counts.
- Prefix + `pnpm test:storybook -- src/stories/tables/NotebookTables.stories.svelte src/stories/PluginWorkspace.stories.svelte -t 'ResultsAndStructuredFilters|RichCellsAndExpandedRows|LargeTypedResults|InspectorSample|IndependentTables|TableFilters'`:
  7 passed, 0 failed, 27 unrelated shell stories skipped, retaining runtime/a11y guards.
- Prefix + `pnpm test:storybook -- src/stories/tables/NotebookInputTables.stories.svelte`:
  4 passed, 0 failed (typed multiple, optional/required single, disabled), including
  filtering, focus return, event suppression and reactive selection replacement.
- Prefix + `pnpm test -- src/lib/render/table/table-files.test.ts`: 24 passed, 0 failed.
- Prefix + `pnpm spec:check`: all 3 specification lanes passed; routing 25/0 findings,
  parity 6/0 findings, ownership 1 passed.
- `/Users/stevejuma/code/lapismd/design-core-notebook-tables/node_modules/.bin/prettier --plugin /Users/stevejuma/code/lapismd/design-core-notebook-tables/node_modules/prettier-plugin-svelte/plugin.js --check src/lib/render/dataframe/Toolbar.svelte src/lib/render/dataframe/DataFrameColumnSummary.svelte src/stories/tables/table-header.story-play.ts`:
  all 3 files passed.

Keep the shared and Notebook reviews running. Resume remaining migration checks
from the records; full qualification and publication are still gated by UI approval.

## Combined shared gutter/detail feedback intake (31 October)

The Design Core gutter fix (`7f67b926`) and compact, horizontally sticky,
sans-serif detail fix (`7c01ec09`) were accepted into a fresh isolated review
worker without changing Notebook runtime source, tracked manifests or lockfiles.
The intermediate gutter archive was prepared but not installed while further UI
feedback was being incorporated. Final Design Core 0.8.0 archive SHA256:
`ea3afda3a06d35e527e71ab3382f0040ca45de4cf2f746e798d2480f9816fcff`.

Owned worker: `lapis-notebook-run-45b70569-4d11-4711-985c-015e81f55fdb`;
source snapshot `31e34541`; installed graph and provenance remain in its review
receipt. Review is running on loopback 10529; shared review remains on 10429,
and the original 10329 listener was preserved.

- `pnpm validation -- review-stop`, then
  `LAPIS_NOTEBOOK_VALIDATION_ARCHIVES="$PWD/.local/canvas-archives.json" pnpm storybook:review`:
  owned fresh Docker review started, verifying archive identity/checksum.
- `pnpm view @lapismd/spec-validator version`: latest 0.2.0, already installed.
  `pnpm exec spec-validator doctor`: 10 passed, 1 alias warning, 0 failures.
  `pnpm spec:search "expanded"`: QMD returned the canonical Notebook requirements;
  the native ABI loads under Node 24, so no fallback was needed.
- `docker --context omarchy exec -e LAPIS_NOTEBOOK_VALIDATION_RUNTIME=native -e LAPIS_NOTEBOOK_VALIDATION_WORKER=1 -w /work/lapis-plugin-notebook lapis-notebook-run-45b70569-4d11-4711-985c-015e81f55fdb pnpm test:storybook -- src/stories/tables/NotebookTables.stories.svelte src/stories/tables/NotebookInputTables.stories.svelte src/stories/PluginWorkspace.stories.svelte -t 'ResultsAndStructuredFilters|RichCellsAndExpandedRows|LargeTypedResults|InspectorSample|IndependentTables|TypedMultipleSelection|OptionalSingleSelection|RequiredSingleSelection|DisabledSelection|TableFilters'`:
  11 passed, 0 failed; 27 unrelated shell stories skipped. Includes all table and
  input scenarios plus desktop/mobile WorkspaceShell filters, with interaction,
  accessibility and fatal runtime/teardown checks retained.
- Same Docker exec prefix + `pnpm spec:check`: 3 specification lanes passed,
  routing 25/0 findings, parity 6/0 findings, ownership 1 passed.

This is focused archive acceptance for UI review. UI-approved and fully-qualified
states remain pending; the recorded filter-trigger type gate and original
migration's remaining checks are not waived. No full suites, screenshot comparison,
baseline updates, publication, push, merge or workspace cleanup were performed.
