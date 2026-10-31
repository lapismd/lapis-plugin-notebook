# Complete notebook inputs

Uploads are temporary/session-local; multiple selections can mix vault files and
uploads. This slice follows Observable Notebook-facing behavior with public
Design Core controls and the planned native file input. No upload copy, push,
PR or visual-baseline update is authorized.

Starting source is local Notebook commit 7d08f456, previously qualified with
323 unit tests and 38 interaction/axe stories. The workspace was clean.
Latest Deno-free spec-validator is 0.2.0 and is already installed.

## Implementation

All twenty factories are exposed through the lazy DOM runtime. Choice IDs retain
typed values; search query and recursive form snapshots survive reruns. Private
transient snapshots retain live uploads, while persisted snapshots contain only
vault references and upload reselection markers. Attachment readers share stdlib
binary/CSV/TSV/JSON parsing. Vault restoration settles before values reach cells,
refreshes metadata and ignores disposed or aborted owners. Missing/temporary
selections mark the input and its descendants stale. Input callbacks publish
unexpected errors to Problems; validation stays inline.

Structured input registrations survive execution cleanup. A reactive revision
updates raw models without proxying their mutable state or remounting controls.
Native implementation events stop at the mount boundary, so each interaction
emits one owner change. Forms release their children and pending restoration is
released on cancellation. Safe Mode and execution-toast behavior remain intact.

## Before/after evidence

Native diagnostic commands use the explicit
`LAPIS_NOTEBOOK_VALIDATION_RUNTIME=native` override.

- `pnpm test -- packages/input/src/__tests__/complete-inputs.test.ts`: all eleven
  original regressions failed before factories existed. The expanded sixteen
  cases now pass, including typed Map/object values, options, search semantics,
  live form events, templates, reconstruction and reducer teardown.
- `pnpm test -- packages/stdlib/src/__tests__/files.test.ts`: the reader-backed
  attachment regression initially failed (one failure, two passes); all three
  pass with lazy shared parsing and preserved DSV column metadata.
- `pnpm test -- packages/input/src/__tests__/file-inputs.test.ts`: initial six
  cases found two defects (Blob MIME type and lost reselection markers). The
  expanded eleven pass, including binary/mixed files, cancelled selection,
  missing vault files, late results, restoration and cancellation ownership.
- Worker regressions separately recorded one failure each for discarded live
  structured-input owners and search-query loss on rerun. Both exact targets
  pass after the runtime fixes. Cancellation restoration also recorded one
  failure before the post-wait abort guard, then passed the same target.
- Expanded focused acceptance passes 106 tests in thirteen files. Svelte checks
  report zero errors and zero warnings.
- First Docker `pnpm validation:all` passed quality but found one outdated
  worker-client mock (355 passing tests, one failure). The mock now retains the
  real input-host helper; its exact DOM fallback target passes. No assertion or
  runtime diagnostic was suppressed.
- Desktop/mobile containment initially found two acceptance failures because the
  assertion incorrectly prohibited intentional horizontal table scrolling.
  Acceptance now checks contained table viewports with overflow, and contained
  controls elsewhere, matching LN-NB-037.
- Docker `pnpm test:storybook -- src/stories/PluginWorkspace.stories.svelte -t
InputTypes` passes both desktop and mobile stories with interaction/axe and
  teardown diagnostics intact. Cold process/browser report:
  `.local/validation/runs/lapis-notebook-run-b654a078-e35c-4c5d-a4a4-fa4a747c530a`.
  It exercises real controls, exact upload event counts, Escape/focus return,
  live search, form aggregation, mixed files, CSV/JSON reads, reruns and notebook
  switching. Notifications and Notebook Problems remain empty.

Doctor and QMD discovery pass with the repository's intentional Docker command
wrappers (doctor warns that aliases differ from its native defaults). Final qualification is recorded below. Keep visual-pending and existing baselines.

## Review follow-up

The follow-up uses public Design Core FileTypeIcon in the Command chooser and
selected list, InputGroup for the leading search icon, and distinct filled Badge
variants on an unfilled file row. `lapis.code(source, language, { title }?)`
produces literal code output rendered by public CodeBlock; both form values and
selected CSV/JSON contents demonstrate it. Its builder regression recorded one
failure before implementation, then passed with the existing seven builder
cases. Nineteen input-model cases and eight builder cases now pass together.

Final source review added three failing regressions for undefined/disabled
single-select defaults, optional empty-query custom filtering, and search
callback errors. All three exact cases pass; UI callback failures use Problems
instead of escaping an event. The browser renderer consumes the model's formatted
result label so formatter failures also stay on the runtime error path.

The second full Docker run passed all 356 then-current tests and quality checks,
then exposed a build failure parsing local Svelte controls in the worker's lazy
chunk graph. The worker Vite configurations now compile those private controls
while keeping shared UI external and DOM inputs on the in-process path. Exact
native `pnpm build:bundle` passes with its bundle-exclusion audit, and Svelte
checks report zero errors/warnings. No compiler or diagnostic check was waived.

Fresh Docker InputTypes/InputTypesMobile interaction/axe acceptance passes with
file icons, distinct opaque source-badge backgrounds, a leading search icon,
language-aware JSON highlighting, and all prior ownership/file/focus assertions:
`.local/validation/runs/lapis-notebook-run-ab27c41d-3e43-422d-84b3-a16037b8337e`.
The complete lanes were rerun against the final implementation, as recorded below.

The static catalog initially found one duplicate rune-transform failure from
merged worker plugin factories. Installing the worker pipeline once after the
merge fixes it. Exact Docker `pnpm build-storybook` passes in report
`.local/validation/runs/lapis-notebook-run-df3f3c8f-1407-4e4f-a569-191d564cee7e`.
The dev server ignores owned `.local`, `dist` and `storybook-static` products,
preventing validation collection from restarting the review story.

A vault-capability regression recorded one failure for a listed dot-folder path
read from a notebook in a subfolder. The adapter now marks chooser paths as
vault-root references; the exact case passes without eager reads. Relative
FileAttachment behavior is unchanged. Final qualification includes this case.

## Additional review regressions

The full Docker run `lapis-notebook-run-a23966d8-8e44-462e-bfc9-21a425ae668b`
passed quality, 361 unit tests, build, publint and static Storybook. Browser
acceptance found one TableFilters Escape/focus-return failure (38 passed, one
failed across all batches). Its exact native target passed on reproduction;
keep the assertion and rerun the complete cold lane before qualification.

Native `pnpm test -- packages/input/src/__tests__/complete-inputs.test.ts`
recorded two new Markdown failures (19 passing) before implementation; the exact
21 cases now pass. Native `pnpm test:storybook --
src/stories/PluginWorkspace.stories.svelte -t
'InputTypes|PreviewCellEditingLayout|EditableCellIdentifiers|TableFilters'`
recorded four failures (two passing, fifteen skipped): source lower corners,
collapsed ID positioning and the selected checkbox foreground in desktop/mobile.
The tick existed, but Notebook's unlayered generic DOM-control foreground rule
overrode Design Core. The owner now excludes public Design Core components.
No upstream component or dependency CSS override was needed.

The new Lapis `Inputs.markdown` extension brings the catalog to 21 factories
(20 Observable-compatible factories plus MarkdownComposer). Its 22 focused
model tests and two fixture audits pass. A first composer acceptance assertion
selected the inner bold text instead of the complete Markdown output; the
assertion now targets the rendered output boundary and checks literal restored
editor text separately. Both source-corner stories initially retained the
embed's reset token; binding the token through MarkdownEmbed's public class prop
fixes both exact PreviewCellEditingLayout and LiveCellEditingLayout cases.
Collapsed ID editing and both filter stories also pass their focused targets.

## Final qualification and review checkpoint

Docker `pnpm validation:all` passes in
`.local/validation/runs/lapis-notebook-run-01c6c5ec-3fe6-456f-91f6-6e60e2287758`:
quality (Svelte zero errors/warnings), all 364 unit tests in 76 files, plugin
build and bundle-exclusion audit, publint, static Storybook, all 39 interaction
and accessibility stories in three fresh browser processes (12 + 6 + 21), and
specification/App ownership checks. Functional and accessibility failures are
zero. The earlier TableFilters focus failure does not reproduce in the exact
focused targets or the complete final catalog; its focus assertion remains.

The projection uses verified temporary source archives for Design Core 0.7.0,
API 0.2.0 and Mira 0.1.2 from the existing isolated source workspaces. Archive
hashes/provenance and the actual installed graph remain in the report. Tracked
manifests and lockfile retain registry resolution.

A fresh checkout-owned Storybook is running on port 7042. Cold browser review
confirmed the selected white checkbox tick, source corners and live Markdown
control. Review Input Types and Input Types Mobile; the catalog remains
visual-pending and no baselines were changed. Work is committed locally only;
pause here before any push or PR.
