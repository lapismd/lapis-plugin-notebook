# Table filter and input-table layout

The review showed dataframe filters in a multi-column card grid with native
selects, and an Inputs.table whose row separators stopped at the intrinsic
data width. The Notebook package owns both surfaces. The latter is caused by
the Markdown table fit-content rule taking precedence over the input table's
base width; the input's scoped presentation must fill its own container.

Exact native diagnostic baseline:

`LAPIS_NOTEBOOK_VALIDATION_RUNTIME=native pnpm test:storybook -- src/stories/PluginWorkspace.stories.svelte -t 'SystemGuide|TableFilters'`

Result: three failing stories, seventeen skipped. SystemGuide fails its input
table width assertion; both desktop/mobile TableFilters fail the full-row
geometry assertion. Log: `/tmp/notebook-table-filters-before.log`.

The new filter stories use typed table output through the actual notebook
runtime and public WorkspaceShell. They cover text/operator selection, numeric,
boolean and date filters, clear actions, Escape and focus return.
During implementation, the first rerun passed SystemGuide but had two filter
failures and two Svelte errors due to a local `state` binding conflicting with
the `$state` rune. Aliasing the prop fixes that. The next rerun had two filter
failures because the test tried interacting before Select's closing transition
released pointer events. It now waits for actual pointer interactivity. The
following rerun had two test-selector failures: the dataframe uses a rowgroup,
not tbody. Assertions now target the production rowgroup and retain the same
expected data. No pointer checks, accessibility rules or assertions were waived.

The typed filter scenario also exposed existing date comparisons treating dates
as numbers, and a lone upper bound not being stored as the comparison value.
The exact `pnpm test -- src/lib/render/dataframe/__tests__/filter.test.ts`
diagnostic baseline had four date failures and one numeric pass; after date
normalization all five pass. The UI tests cover lower and upper numeric bounds,
date minimum, boolean selection, text operators chosen before a value and
value-free null checks.

Final focused rerun: three stories pass, zero interaction/axe failures. Explicit
390×844 TableFiltersMobile run: one pass. Svelte check: zero errors or warnings.
Logs: `/tmp/notebook-table-filters-after-4.log`,
`/tmp/notebook-table-filters-phone.log`, `/tmp/notebook-table-date-before.log`,
`/tmp/notebook-table-date-after.log`, `/tmp/notebook-table-svelte.log`.

A final column-key review changed the draft operator cache to a reactive
SvelteMap, supporting arbitrary column names without inherited object keys.
An intermediate null-prototype object was not reactive and produced two exact
operator-selection failures; the SvelteMap recheck passes all three stories.
The typed fixture uses `constructor` as the text column's underlying key with
the visible label `name`, so the same interactions exercise this boundary.
Logs: `/tmp/notebook-table-filters-final.log` (two failures),
`/tmp/notebook-table-filters-final-2.log` (three passes).

Manual review uses a freshly restarted checkout-owned Storybook on port 7042.
The custom dropdown opens with all operators, Escape returns focus to its
trigger, and the guide visibly renders full-width sample-table separators.
Captures: `notebook-table-filters.png` and
`notebook-input-table-full-width.png` in the task's local visualization directory.
No private production styles were overridden by a story.

The first full Docker run
`lapis-notebook-run-1a07ddd5-72a8-4b7e-aa54-0c084035bd78` passed quality,
323 unit tests, package build/publint and static Storybook. Its complete browser
lane had 36 passes and two failures from guarded `derived_inert` warnings:
pointer interactions in the new stories reached stale slider handlers left by
the earlier RunInputs story. Specification checking was not reached.

The exact sequence `pnpm test:storybook -- src/stories/PluginWorkspace.stories.svelte -t 'RunInputs|TableFilters'`
reproduced two failures and one pass. Adding the control-identity assertion
made all three fail: range updates unnecessarily unmounted and recreated the
Slider. The Notebook-owned adapter now updates reactive public props on the
existing control, with the helper imported only through the lazy UI loader.
The same identity/sequence target now passes all three stories with zero Svelte
or axe failures. No Design Core change, dependency patch, handler interception,
warning suppression or weakened assertion was used.

Logs: `/tmp/notebook-table-slider-lifecycle-before.log`,
`/tmp/notebook-table-slider-identity-before.log`,
`/tmp/notebook-table-slider-lifecycle-after.log` and
`/tmp/notebook-table-full-validation.log`.

Final Docker qualification passes in
`lapis-notebook-run-eaa6793f-b9ab-4cda-bebf-ac976b1734ef`, source
`18a6b06810c5df5f026e28eef3c17296ce478ec3`:

- Quality: typecheck, zero Svelte errors/warnings, App ownership, validation
  routing, story parity and specification validation pass.
- Unit: 323 tests across 73 files pass, including the startup/lazy-boundary
  audits and five range comparisons.
- Package build, bundle exclusion audit and publint pass.
- Static Storybook builds successfully.
- All 38 interaction/accessibility stories pass (12 + 6 + 20), with no guarded
  Svelte diagnostics. The two lifecycle failures move to zero.
- Final spec:check passes validation, mdBook, spec-first and ownership.

Log: `/tmp/notebook-table-full-validation-final.log`. The run retains the
verified temporary Design Core/API/Mira archives in its request/result
manifests, with tracked manifests and lockfiles left registry portable.
Specification tooling remains the latest Deno-free release, 0.2.0; QMD
index/search work.

Two background in-app-browser automatic replays lost focus to the notebook tab
(one typing assertion and one Escape-focus assertion). Direct real-keyboard
operator selection, typing and Escape checks work. An experimental shortcut
boundary did not resolve background playback and was removed; the product and
test source was then compared to the passing Docker revision with no diff.
The background replays are not used as passing automated evidence. The cold
Chromium qualification above and direct manual controls are recorded separately.

Keep visual-pending. No baselines, pushes, publication or PR.
