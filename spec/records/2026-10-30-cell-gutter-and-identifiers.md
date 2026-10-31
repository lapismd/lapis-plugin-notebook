# Cell gutter, highlighting and editable IDs

Legacy reference: `legacy-lapis-notes/packages/notebook/src/app.css` used a
negative 78px live cell margin, enabled by the legacy Markdown view's
`notebook-full-width` class. The new Notebook copied that CSS but never enabled
the class. Notebook now measures the owning line-number gutter and offsets the
action rail while preserving the right edge; the observer is disposed with the
cell. Focus paint uses an inset outline rather than a clipped outside ring.

Mira owns the missing mounted-language overlay bridge for fences nested inside
directives. Notebook consumes its built archive for isolated acceptance; it
adds no private parser or consumer highlighter.

The ID corner badge appears on desktop hover/focus and remains visible for
coarse/no-hover pointers and mobile viewports. Enter/blur saves, Escape cancels,
and inline errors retain invalid input. Renaming reparses the current vault
source and rejects duplicate/unsafe IDs before changing only the header.

Exact baselines (explicit native diagnosis):

- `pnpm test -- src/lib/render/__tests__/notebook-cell-source.test.ts`:
  1 failure / 12 pass before implementation, 13 pass afterward.
- `pnpm test:storybook -- src/stories/PluginWorkspace.stories.svelte -t 'PreviewCellEditingLayout|LiveCellEditingLayout|SourceCellHighlighting|EditableCellIdentifiers'`:
  4 failures before implementation. One earlier lower-case name selector
  skipped all stories and is not counted as evidence.
- The initial live assertion found no gutter geometry; final acceptance waits
  for real geometry and verifies alignment numerically.
- Initial badge focus-return assertion retained the old button DOM node after
  switching to input. It now queries the current accessible button and retains
  the focus requirement.

Final exact selector: 4 pass, 0 failures after the built Mira archive install.
The additional `LiveCellEditingLayout` rail hit test failed once before the
stacking-order repair and passed afterward. It now exercises pointer hits on
Run, Stop and both code/output accent rails around real cell execution.
The editable-ID story also revealed stale render identity after a successful
save; the notebook-owned render binding now reloads against the new ID, and
the story executes that renamed cell successfully.
The execution assertion targets the actual `.notebook-output__text` node,
avoiding the identical text in source. Extending this exact story to collapsed
cells initially failed once because the badge was absent; it now opens and
cancels the ID input without expanding the cell.

Mira archive: `mira-mde-notebook-fences/.local/packages/lapismd-mira-0.1.2.tgz`,
SHA256 `890a064170adf07012db9d0911902dafb7776e639fd87f7ff6f7b845ab92e889`.
The previously documented API and Design Core built archives remain installed.
Tracked package manifests and lockfiles are unchanged and registry-portable.
Doctor passes with Node 24 (10 checks, one existing routing-alias warning), and
the semantic QMD search succeeds. The default Node 26 command exposed a QMD ABI
mismatch, so discovery explicitly uses the already-installed matching Node 24.

Complete Docker `pnpm validation:all` passes quality (zero Svelte errors or
warnings), 312 unit tests in 70 files, build/bundle audit, publint, static
Storybook, all 36 interaction/accessibility stories, spec-first/mdBook and the
App ownership audit. Log: `/tmp/notebook-cell-final-full-validation.log`.
The final source-path reset for a reused renamed-cell binding also passes its
exact `EditableCellIdentifiers` story. The final complete aggregate, including
collapsed-cell ID coverage and the stricter execution-output assertion, passes
as `lapis-notebook-run-80eeb3a0-7c58-4e71-b91f-d8d4d8a87d0e`.
Log: `/tmp/notebook-cell-final-complete-validation.log` (312 unit cases, 36
interaction/axe stories, all quality/build/publint/static/spec lanes).
Unrelated CSS formatting was restored to the parent bytes after proving its
normalized tokens identical. The exact four-story selector passes again against
the final review files (`/tmp/notebook-cell-final-review-exact.log`).

The full Storybook log retains the same three CSF-Svelte StoriesExtractor
`Meta is not a function` messages seen in both previous full Notebook receipts
(`/tmp/notebook-execution-validation-all.log` and
`/tmp/notebook-cell-layout-full-validation.log`). These third-party extraction
messages are unchanged; every actual interaction/axe case passes, and the
fatal Svelte runtime diagnostic guard remains intact.

Upstream local commits: Notes `0e5a4d9d`, Mira `10a0bce0`, Design Core
`d3bdfcc3`. Their required source qualification is retained separately in each
owning repository. Notebook's checkout-owned Storybook was restarted on 7042
after installing the rebuilt archives. A fresh browser confirmed distinct
keyword/number/string colors in Source mode and real pointer hits on the live
cell rail. No source aliases or node_modules edits were used.
Visuals remain `visual-pending`; no baselines, push or PR are authorized.
