# Input and output presentation

Continue from local commit ca3f38b1 in the isolated notebook-execution workspace.
Keep work local for Storybook review; retain visual-pending and existing baselines.

Each Input Types control cell is immediately followed by a separate reactive
output cell showing its value, following the Observable reference. Controls have
no embedded value readout. Large search results use an explicitly labelled count
and row preview; file values show metadata without reading bytes. Button examples
omit optional labels. The renderer avoids duplicate labels while retaining
visible labels for simple inputs. Labels sit on the left, controls on the right,
with wrapping choices and file actions in narrow containers. Notebook-owned
wrappers remove borders and horizontal padding; ordinary outputs have a subtle
theme-aware tint extended 8px to the left without shifting their content. Output
cells now have 12px of vertical padding, following the latest review request.
Markdown outputs bind the public Mira preview-background token to the same tint.
Selected cells paint a 2px frame above the rendered source; their ID badges use
the code background and the same grey stroke, including collapsed cells. The
selection/focus stroke retains the previous public border-focus token, following
the final palette correction.
Intrinsic component borders, table separators and error colors remain intact.

## Before/after evidence

- Native `pnpm test -- src/stories/notebook-fixtures.test.ts` initially records
  one failure and two passes: the first input was followed by another control,
  rather than its value cell. The regression also checks dependency cycles.
- Native `pnpm test:storybook -- src/stories/PluginWorkspace.stories.svelte -t
InputTypes` records two failures (desktop/mobile) before implementation:
  output wrappers have a 1px border where the contract requires zero.
- Expanding the fixture from 30 to 52 cells caused both combined interaction,
  rerun and switching stories to exceed their unchanged 60-second budget.
  Full-catalog examples retain the separate output cells; rerun/switching
  acceptance moves to a focused twelve-cell notebook using the same input and
  output sources. All retained-value, mixed-file, Problems and toast assertions
  remain covered, alongside full desktop/mobile control and containment checks.
- Exact InputRowLayout acceptance records one geometry failure before row layout:
  the label spans above its control. The small fixture awaits mounted controls.
- An interim embedded-preview approach was removed after the requested output-cell
  structure was clarified. It is not part of the final implementation.
- A picker-closing accessibility failure was recorded in the interim mobile run;
  acceptance now waits for the chooser to unmount before further actions.
- Raw `display(value)` regressions initially record three failures (empty array,
  null and undefined) and three passes (arrays, objects and explicit output
  batches). Empty arrays no longer disappear as vacuously typed output batches;
  explicit null/undefined values render literally without changing Markdown
  interpolation semantics. Examples pass their values directly to display.
- Two focused regressions initially fail for breadth-first ready ordering and
  stale input values captured before an awaited cell; the forward-reference case
  passes. A real button changed while its defining cell is pending records one
  additional failure before latest-input definitions are preserved.
- Two further regressions fail before partial publication and callback sealing:
  display waits for a promise and late callbacks mutate completed output arrays.
  All six exact order/freshness/streaming/lifecycle cases now pass.
- ReactiveOutputPublication initially records one failure: the dependent output
  appears only after the unrelated slow cell. The story also checks a display
  emitted before that cell awaits its promise, without marking it completed.
- Rerendering dependent input outputs now reclaims a replacement registered node
  when its output record changes, retaining the existing DOM when the node is
  unchanged. This fixes the emptied table mount exposed by mobile containment.
- The first full Docker qualification passes quality, all 378 unit tests, build,
  publint and static Storybook, then records two browser failures (40 passing):
  a filter selection attempted before its opening animation finished, and the
  desktop counter interaction after leaving the Markdown toolbar expanded.
  The exact TableFilters/InputTypes target reproduces one failure and three
  passes. Acceptance now waits for visible dropdown content and verifies closure,
  focus return and restored pointer events. It toggles the inline Markdown toolbar
  closed before the next control, and asserts one counter input event.
- Interim new readiness assertions record four failures: visibility was asserted
  before the select animation finished, and Escape was incorrectly treated as the
  close action for the inline Markdown toolbar. These test mistakes were corrected
  without changing production components or weakening existing assertions.
- The subsequent exact four-story target records one failure and three passes:
  the form output assertion starts while the preceding search rerun is queued.
  Acceptance now waits for the actual completed form value before checking its DOM
  output, using the existing run polling helper. Its DOM assertion and the overall
  story time limit remain unchanged. A timestamp-based interim wait recorded two
  failures because completed cells discard their transient start timestamps.
- Native ReactiveOutputPublication records one new spacing failure before the
  requested vertical padding/background extension (padding is zero). The original
  streaming assertions pass before that geometry assertion fails.
- The exact native spacing/streaming story passes, and the repaired four-story
  TableFilters/InputTypes target passes all four stories. The second full Docker
  qualification passes quality, 378 unit tests, build, publint, static Storybook
  and 41 of 42 browser stories. Its remaining mobile filter failure checks focus
  before asynchronous focus return; focus is now included in the existing close
  polling assertion without changing its timeout or expected target.
- The next review requests add selected-cell paint, matching ID backgrounds and
  frames, increased output padding, and Markdown tint. The exact four-story
  PreviewCellEditingLayout/LiveCellEditingLayout/EditableCellIdentifiers/
  ReactiveOutputPublication target records four failures before implementation:
  missing overlay frame, a detached live-editor reference after the prior failed
  story, mismatched badge background, and the old 6px output padding.
- The six-story target initially records two remaining failures: preview code uses
  Mira's muted-token tint rather than its solid editor-background token, and the
  newly added generic selection-focus assertion exceeds the original Escape-only
  focus contract. Badges now match preview and editor backgrounds separately;
  acceptance retains closure/pointer checks for every selection and the existing
  Escape focus assertion. All six exact stories now pass (four failures to zero
  for the new presentation requirements), with interaction/axe and fatal Svelte
  guards retained. Report:
  `.local/validation/runs/lapis-notebook-run-e8d02a69-1a4d-48b4-ba28-7926629e6967`.
- The grey-palette correction passes all three exact native selection/ID stories.
  The following corner-artifact regression records two failures before removing
  the overlapping outline and aligning the frame radius to the inner border edge.
  The single 2px frame remains above source content; the ID outline matches it.
- The first corner fix exposed a more-specific focus rule overriding the inner
  radius. Native acceptance recorded three failures; Docker reproduced two
  failures and one pass. The frame now reads its radius from the owning code
  surface, avoiding competing radius declarations. Exact Docker preview/live/ID
  acceptance passes all three stories, including the single-frame and inner-radius
  assertions. Report:
  `.local/validation/runs/lapis-notebook-run-cf838eef-d62e-46ee-91f1-26617b0355c9`.
- Full qualification before the final grey/corner corrections passes all 378 unit
  tests and 42 interaction/axe stories, plus every other lane, in
  `.local/validation/runs/lapis-notebook-run-c766a980-5084-429b-a532-c58fc415a395`.
  The final highlighted-value qualification below includes the corrected palette
  and corners.

## Highlighted JavaScript values and loop safety

Direct non-string display values now use the existing code output and public
Design Core CodeBlock in JavaScript mode. Strings remain text; explicit rich
outputs, output batches and DOM nodes retain their renderers. JavaScript notation
preserves undefined, NaN, Infinity, negative zero, BigInt, symbols, dates, regular
expressions, maps, sets and typed arrays. Active ancestor tracking escapes loops
as "[Circular]" while shared references render normally. Inspection avoids getters
and toJSON, abbreviates function bodies and bounds nesting at fifty levels.

- The exact raw-display regression records twelve failures and two passes before
  the change, then all fourteen cases pass, including circular arrays/objects,
  repeated references, BigInt and non-JSON primitives.
- The first broader focused run records two failures and eighty passes because
  existing input-freshness tests still expected numeric text outputs. Updating
  their output-kind expectations retains the fresh-value assertions; all eighty-
  nine tests in seven files pass. Nine formatter safety/type cases also pass.
- Desktop/mobile Input Types, InputLifecycle and ReactiveOutputPublication all
  pass with highlighted values, real syntax tokens and the circular example.
  Table-filter acceptance initially records two focus failures: the public Select
  may keep DOM focus on its combobox trigger instead of the listbox. Readiness now
  accepts either valid owner before sending keys and polls the selected value;
  both exact filter stories pass. Escape focus, pointer, filtering and axe
  assertions remain intact.
- Cold in-app preview exposed a one-second Markdown assertion racing its queued
  rerun; the edited value was present afterward. Acceptance now waits for the
  actual completed Markdown output before its unchanged DOM assertion.
- The next cold Input Types review records one counter assertion failure: the
  input emits exactly once, but the dependent code output still contains zero
  during its queued rerun and becomes one afterward. Acceptance now waits for
  the completed counter result through the render service before the unchanged
  DOM assertion, using the existing polling budget.
- Full Docker `pnpm validation:all` passes quality (zero Svelte errors/warnings),
  all 395 unit tests in 77 files, build, publint, static Storybook, all 42
  interaction/axe stories, canonical specification and App ownership lanes.
  Report: `.local/validation/runs/lapis-notebook-run-76f6fa76-1179-42ef-8ebc-620370164bbb`.
- The repaired counter assertion passes a fresh checkout-owned Storybook cold
  Input Types review, including the highlighted circular example, live values,
  mixed file selections and no new warning/error diagnostics. Visual approval
  remains pending; no baselines were changed.
- Requalification with that counter wait records 41 browser passes and one
  intermittent mobile range-filter failure after clearing the prior filter;
  all 395 units and other required lanes pass. The exact mobile target then
  passes unchanged. Filter acceptance now proves reset has completed (empty
  fields, no active badge, disabled reset action and all source rows) before
  entering another value, and explicitly verifies the maximum field value.
  Original filtering, keyboard, Escape/focus and axe assertions are retained.
- The first stricter reset run passes desktop but records one mobile Escape
  focus failure: focus returns to the earlier file-explorer row after mixing
  pointer opening with keyboard dismissal. Keyboard acceptance now explicitly
  focuses and activates the trigger with Enter, matching Design Core's own
  Select story, and requires trigger focus after every close. Both exact
  desktop/mobile filter stories pass with the reset checks and stronger focus
  assertions. Report:
  `.local/validation/runs/lapis-notebook-run-d676878f-81a9-4dc9-9a6e-9c92e693aed7`.
- Complete-catalog requalification still exposes one mobile focus failure
  (41 passing): Explorer steals focus while Select is open. Source investigation
  identifies an unconditional focus at the end of Design Core's two-second
  reveal flash, rather than a Select defect. Its owning Explorer story records
  one regression failure before fixing focus timing; all eighteen Explorer
  stories pass afterward. The temporary Design Core archive retains the prior
  status-content fix and adds the source repair (SHA-256
  `b921bb67a711cc2dd5eb5279afa35ed50385f2d6394651df0cbb3debc12c47c8`).
  Both exact Notebook filter stories pass against that archive in
  `.local/validation/runs/lapis-notebook-run-8fc5a5dc-8129-4b25-98bd-1d515a7fce00`.
- Final complete qualification against the repaired archive passes all 395 unit
  tests and all 42 interaction/accessibility stories, quality, build, publint,
  static Storybook, specification and App ownership checks. Report:
  `.local/validation/runs/lapis-notebook-run-447fd442-8efc-4cf5-9855-4541594fabde`.

## Legacy input initialization comparison

The legacy `packages/notebook/input/src/view-runtime.ts` creates and registers
input outputs when the defining `view(...)` cell executes. Its
`packages/notebook/src/lib/render/notebook-render-service.ts` reconstructs saved
structured inputs in `getOrCreateInputOutput`; it does not extract and render
new input definitions directly from source. The current plugin retains both
paths, with extended factory-specific metadata and private file capabilities.
The render-service regression `does not rerun reconstructable structured input
outputs during restore` verifies that opening saved controls requires no cell
execution. First-time inputs have no saved metadata and require evaluation of
their defining cells and any dependencies. Automatic first-open initialization
would be an additional execution policy, rather than recovery of a removed
legacy render-only path.

The user chose to keep first-time execution manual and restore saved controls.
The exact native diagnosis command
`LAPIS_NOTEBOOK_VALIDATION_RUNTIME=native pnpm test -- src/lib/render/__tests__/notebook-render-service.test.ts -t 'does not rerun reconstructable structured input outputs during restore'`
passes its single selected test (eight unrelated tests skipped). No initialization
policy or legacy source changes were needed.

Storybook supplies a fresh `MemoryAppDatabase` per story App. Its saved input
values survive notebook switching within that App, while reload starts a new
database. The production plugin delegates persistence to its owned App database;
it does not write generated values into notebook Markdown.
