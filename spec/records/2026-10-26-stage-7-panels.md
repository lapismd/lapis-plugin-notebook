# 2026-10-26 — Stage 7 panel surfaces, registry wiring, and conversions

## What landed

- All three side panels and their ItemViews ported: inspector (variables +
  DuckDB catalog with lazy table previews), dependencies (minimap plus the
  472-line SVG DAG with orientation/zoom settings), and packages (npm search,
  install/uninstall/update, dependency-registry status).
- Plugin wiring restored: the three views register with `ViewAccess.command`
  openers reusing the legacy command ids/names (`open-notebook-session-view`,
  `open-notebook-dependencies-view`, `open-notebook-packages-view`), panel
  refreshes on controller/layout/leaf events, auto-open settings honored in
  `handleNotebookFileOpen`, snapshot builders, package methods, the two
  settings-tab "Open packages" rows with registry validation, and the
  NotebookView pane-menu items with their callbacks.
- Conversion mechanics: static utilities converted by a deterministic
  token-dictionary engine (Tailwind 4 values) into generated
  `notebook-<panel>__g<hash>` classes with appended native CSS; conditional
  class strings rewritten to BEM modifiers (`__tab--active`,
  `__minimap-row--selected`, `__orientation--active`, `__graph--dragging`,
  `__graph-node--{error,warning,success,idle,ring}`,
  `notebook-packages__{layout,entry,suggestion}` modifiers). The `Item`
  family became semantic `notebook-packages__item-*` divs; the non-exported
  API `Icon` component became a wrapper over the public `getSvg` registry;
  the code-snippet highlighter uses the standard lezer `classHighlighter`.

## Behavior adaptations (documented divergences)

- Panel `refreshView` degrades with a warning and null snapshot instead of
  propagating unhandled rejections when DuckDB catalog or registry probing
  fails (workspace lifecycle calls it with `void`; legacy relied on hosts
  always providing plugin asset serving).
- The plugin asset URL fallback anchors root-relative plugin paths at the
  document origin, so browser hosts without a plugin asset server resolve
  engine assets correctly; the legacy fallback produced invalid URLs there.
- Story vaults seed `.lapis/lapis-notebook.json` with panel auto-open off so
  shell stories stay deterministic; panel stories will open panels explicitly.
- Dataframe row regions derive their accessible name from the source query
  (or the per-instance search id) after axe `landmark-unique` flagged two
  identically labelled dataframes in the `Query data` story.

## Verification impact

LN-NB-007/008/009 evidence updated; all three stay Planned until the
six-placement panel story suite (LN-NB-007), the manifest network permission
at the bundle gate (LN-NB-008), and the dedicated dependencies panel story
(LN-NB-009) land.

## Validation

- `svelte-check` 0/0; `check:no-tailwind` clean across all converted panels;
  unit 283/283 across 66 files; `test:storybook` 5/5 with axe clean;
  build + publint clean.
