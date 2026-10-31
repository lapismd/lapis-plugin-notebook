# Stable notebook identity and saved state

Notebooks assign `notebook.id` through the public file-manager API before their
first generated-state save. Opening and parsing remain read-only, and first-time
execution remains manual. The plugin uses public App database metadata with a
versioned UUID namespace; the existing path-based notebook methods remain the
legacy read path. No published host API or database schema migration is needed.

Saved state retains its source path for provenance and duplicate-ID detection.
Moving or renaming a notebook preserves its UUID and restores inputs and outputs
without evaluation. A copied UUID cannot load the state of its existing owner;
saving or clearing the copy assigns it a fresh identity. Clear records retain
only ownership and an empty-state marker so an older path backup cannot reappear.
Legacy records remain readable and the next successful save writes UUID state.
Temporary uploads still persist only reselection metadata, never file bytes.

## Narrow regressions

- `LAPIS_NOTEBOOK_VALIDATION_RUNTIME=native pnpm test -- src/lib/runtime/__tests__/notebook-identity-persistence.test.ts`: four behavioral failures before implementation, then four passes.
- The first test fixture used a nonexistent session setter; those four setup
  errors were corrected before recording the behavioral regression count above.
- The exact source/cache UUID regression records one failure before source UUIDs
  take precedence over stale metadata, then passes with the parser suite.
- Copied-ID clear isolation records one additional failure before copy ownership
  is checked on clear; all nine identity tests now pass.
- The first affected persistence/command/render/frontmatter run records four
  failures and twenty-one passes because old test fixtures still expected path
  writes and lacked UUID state. The updated fixtures retain their normalization,
  cancellation and temporary-file assertions; all twenty-five tests now pass.
- Focused identity/parser acceptance passes eighteen tests. A native Svelte
  diagnosis records zero errors and zero warnings before the final story changes.
- The first rename story run passes its persisted-input assertion but records
  one neighboring-output failure (two other selected stories pass). Waiting for
  the persisted dependent output before renaming preserves the failure and
  isolates a concurrent hydration defect: only the first cell waits for storage,
  while its neighbor returns idle before hydration finishes.
- The exact render-service concurrency regression records one failure before
  storing the shared hydration promise, then one pass afterward; all cells now
  await the same once-per-session restoration. The next story reaches the final
  identity check, where a stale pre-rename TFile handle is replaced with a fresh
  vault lookup. Existing control, output, Safe Mode and no-toast assertions remain.
- All forty-five focused identity, persistence, render-service, command, parser
  and frontmatter tests pass across six files before the freshness regressions.
- `LAPIS_NOTEBOOK_VALIDATION_RUNTIME=native pnpm test -- src/lib/render/__tests__/notebook-render-service.test.ts -t 'late persisted-state hydration'` records two failures before guarding hydration with the session revision, then two passes. The cases preserve a completed newer run and a newer clear action despite a late storage result.

## Review and qualification

The Saved inputs after rename full-shell story changes a real input, renames its
notebook, and restores its control and output in Safe Mode without another run.
It uses the same per-story in-memory database as the rest of the catalog, so a
browser reload still resets Storybook state. Visual approval remains pending;
baselines are unchanged. The first complete Docker qualification passes quality,
405 units, build, publint, static Storybook and all 43 interaction/axe stories,
then records one specification gate failure: the render/story source changes
require their mapped overview chapter alongside the updated runtime chapter.
The overview now documents UUID persistence and rename restoration. The exact
`pnpm spec:check` target passes after this correction: one failure to zero.
Report: `.local/validation/runs/lapis-notebook-run-cf50d57a-1820-4211-8e8d-b431fb7ef201`.
Initial aggregate failure report follows.
Report: `.local/validation/runs/lapis-notebook-run-d7ba6c4c-ad3f-48d6-9f31-c8bba9e01fdb`.

Final qualification:

- The focused six-file identity/persistence/render/command/parser/frontmatter
  run passes all 47 tests, including the two late-hydration cases.
- `pnpm test:storybook -- src/stories/PluginWorkspace.stories.svelte -t 'SavedInputsAfterRename|RunNotebook|SafeMode'`
  passes all three exact full-shell targets. Report:
  `.local/validation/runs/lapis-notebook-run-56c6772e-c4e7-448a-ba31-90f2b8d0610f`.
- `pnpm validation:all` passes quality (including zero Svelte errors/warnings),
  all 407 unit tests in 78 files, production build, publint, static Storybook,
  all 43 interaction/accessibility stories, specification and App ownership.
  Report: `.local/validation/runs/lapis-notebook-run-e2d2d429-b72c-45a6-82c2-dbeedc9e8bd9`.
- A fresh checkout-owned Storybook process on port 7042 passes cold browser
  review of Saved inputs after rename: the new file shows its UUID in properties,
  Count remains 10, the dependent output reads “Count is 10.”, and Run is disabled
  in Safe Mode. No warning or error diagnostics occur after the cold navigation.
- QMD indexing and discovery pass; spec-validator doctor passes ten checks with
  the intentional portable-script-wrapper warning.

The Docker report retains identity and checksums for the documented temporary
Design Core, API and Mira archives. Design Core includes the source-owned
Explorer focus fix at `12e0b3ca`, qualified in its owning repository; no consumer
CSS or focus workaround is added. Tracked manifests and lockfiles retain registry
versions. The final change after qualification is documentation/evidence only
and receives a final specification check before the local commit.

Review: [Saved inputs after rename](http://localhost:7042/iframe.html?id=plugins-notebook-shell--saved-inputs-after-rename&viewMode=story).
The story remains `visual-pending`; visual baselines remain unchanged. Work is
committed locally for review, without a push or pull request.
