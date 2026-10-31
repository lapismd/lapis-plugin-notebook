# Notebook execution status and cancellation

Source baseline: updated main e5e7ee21, including merged parallel CI and Turbo
caching. Implementation is in isolated Jujutsu workspace notebook-execution.
No push, publication or new PR is authorized before Storybook review.

One active-notebook status group owns Run/Stop and details. It retains the
latest per-notebook session result, counts the dependency-expanded plan,
updates elapsed time without invented progress, and consolidates runtime and
output labels in a notification-style popover. Controls use a subtle rounded
background/divider and compact vertical spacing; Stop is a small filled red
square with the cell control's highlight. Running animates unless reduced
motion is requested; success is a green-filled circle-check. Popover actions
use public Design Core buttons, icons, hover and focus states.

A run coordinator shares cancellation and terminal feedback across command,
inline and automatic runs. Runtime-local abort signals never enter worker
serialization. Cancellation releases unresolved in-process waits, invalidates
cell-owned Promise helpers and guards late output/definition mutations.
Actual execution failures enter the owned public Problems collection;
cancellation restores prior diagnostics and creates no error. Execution
progress and completion notifications/toasts are removed. Preflight and
unrelated command notices remain.

## Regression and qualification evidence

- Original worker-client/render baseline: 16 tests passed.
- First added unit regressions: 2 failures (unresolved in-process promise and
  completion notice); the exact affected tests pass after the fix.
- Baseline full-shell progress reproduction: 1 failure, missing status item.
- Focused final worker/render/commands/coordinator/Problems/stdlib command:
  38 tests passed across 6 files. This includes late resolution and rejection,
  immediate rerun, dependency closure, failed cells and notebook isolation.
- The three initial popover stories exposed missing dialog semantics. After
  adding the semantic role, functional progress/failure/cancel acceptance
  passed; the Safe Mode story uses the public context key and output metadata
  waits for its asynchronous refresh. No assertions were removed.
- Explicit native focused Storybook: RunProgress, RunFailureDetails,
  CancelPromiseInProcess, CancelExecution and SafeMode: 5 passed, 0 failed.
  Final compact filled Stop refinement: exact RunProgress and both cancellation
  stories: 3 passed, 0 failed.
- Docker `pnpm validation:all`, run
  `lapis-notebook-run-28eb3e69-10d2-4809-bb64-de792adac376`: check (0 Svelte
  errors/warnings), 303 unit tests / 70 files, package and bundled build,
  bundle-exclusion audit, publint, static Storybook, all 32 interaction/axe
  stories across three fresh batches, canonical specification/mdBook/spec-first
  and application ownership audit passed. The final Stop paint refinement was
  separately re-exercised in the exact three relevant browser stories.
- A fresh checkout-owned Storybook process and fresh browser load exercised the
  built dependency and cold control/popover registration.
- Spec Validator 0.2.0 was current. Node 24 QMD semantic discovery and doctor
  pass; doctor reports only the intentional Docker-routed script alias warning.
- Every changed story remains visual-pending. No screenshot baseline updated.

## Temporary upstream acceptance

Design Core's status item remounted custom content whenever a new metadata
object was projected, closing the popover during progress updates. The owner
fix derives the stable mount callback in workspace notebook-status. Its exact
metadata identity story failed once before and passed after; directly affected
families passed 11 tests. Source qualification is recorded in that repository.

For isolated source qualification only, Notebook installed the owner's prepared
built 0.7.0 archive:
`design-core-notebook-status/.local/packages/lapismd-design-core-0.7.0-built.tgz`,
SHA-256 `01c56a18ad754aa58ce63f061e2121831e4b5251ad49d48c07ccd78d814319d8`.
The validation report retains installed-lock and archive provenance. Tracked
manifests and lockfiles retain registry semver resolution. Shipping requires a
released Design Core repair; this acceptance does not authorize publication.
