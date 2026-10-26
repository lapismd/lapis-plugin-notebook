# Notebook plugin

`@lapis-notes/lapis-plugin-notebook` owns the first-party external Notebook
plugin runtime. A notebook is an ordinary Markdown file with the
`.notebook.md` suffix whose executable cells are container directives. The
filesystem stays authoritative for cell sources; generated outputs are
disposable state persisted through the host AppDatabase notebook-state
contract, which the shared Rust core already publishes
(`NotebookState`/`NotebookCell`/`NotebookPhase` in `lapis-app-protocol`).

The plugin is a staged port of the legacy `@lapis-notes/notebook` package and
its six private support packages from `legacy-lapis-notes`. Ported behavior
keeps its legacy regression evidence; presentation remaps onto public
`@lapismd/design-core` exports instead of re-creating primitives. The runtime
plugin id `lapis-notebook` is preserved from the legacy plugin so persisted
plugin data keys remain compatible. The DuckDB-WASM engine dependency is
pinned exactly at `1.33.1-dev45.0` in root dependencies per LPN-SPEC-004 so
query behavior cannot drift independently from the ported compatibility
tests.

This chapter is the package contract and the only normative MUST table for
package identity, host registration, and ownership. The following chapters
describe the ported model:

- [Documents](./documents.md): file identity, cell directives, frontmatter,
  and dependency analysis
- [Runtime](./runtime.md): execution transports, reactivity, cancellation,
  persistence, safe mode, DuckDB staging, and support-package boundaries

The render layer ports in two motions: host-neutral cell/dataframe logic
(actions, interaction, selection, source mapping, renderer registry, value
stringify, render service, dataframe types/utils/export/formatting with
`date-fns`, `@tanstack/table-core`, `@tanstack/svelte-virtual`, and
`vega-embed` pinned through the root manifest) lands first with its legacy
suites; Svelte presentation follows per family, remapped onto public Design
Core primitives with Tailwind utilities converted to notebook-owned native
CSS at copy time. The dataframe family and the output renderers are ported;
markdown outputs render through the public `MarkdownEmbed` with explicitly
threaded `App` and `sourcePath`. The cell source editor wraps the public
`markupEditor` factory from `@lapis-notes/api/editor/core` as a compact
inline surface (the same app-editor composition the CSV and source plugins
use, with Mira file-margin and background tokens rebound at the editor
element so it stays left-aligned, low-padded, and color-matched to the cell
surface) so Mira base theme,
live configuration compartments, and `cm-editor-source` styling are inherited;
the notebook layer adds the cell language, the absolute-document gutter, and
the TypeScript virtual-document projection. View header actions resolve the
legacy run-all glyph through Design Core's `registerWorkspaceIcon`, and the
dataframe filter badge reflects real filter state instead of summary
presence. The dataframe toolbar actions are icon-only with Design Core
shadcn tooltips (the tooltip trigger composes the popover trigger through
the bits-ui `child` snippet), the toolbar row wraps on narrow viewports,
and row density uses a Design Core button-group split control over a radio
menu. Dead legacy component variants that nothing
imports are excluded and recorded in `PROVENANCE.md`. The panel layer is ported end to end:
inspector, dependencies (minimap plus SVG DAG), and packages surfaces with
their ItemViews, snapshot builders, graph layout engine, and npm registry
client, all with their legacy suites. Panel conversions remap legacy UI
primitives onto Design Core (the `Item` family becomes semantic
`notebook-packages__item-*` structure), replace the non-exported API `Icon`
component with a thin wrapper over the public `getSvg` registry, and convert
every Tailwind utility — static and conditional — into notebook-owned native
CSS, including generated classes for mechanical conversions. Dataframe row
regions carry query-derived accessible names so multiple dataframes satisfy
the landmark-uniqueness rule. Expandable sections in the variables, packages,
and dependencies panels read as full-bleed units: grey family headers
(`--background-primary-alt`) over white bodies (`--background-primary`)
running to the section border separator, with the dependencies selection
snippets carrying a semantic `notebook-dependencies__snippet-body` class.
The snippet editors opt into Mira's `.mira-code-editor` token-color scope
through the public `miraClassHighlighter` (the standard lezer highlighter
emits unstyled `tok-*` classes), which adds `@lapismd/mira` to the peer and
dev surfaces; the graph's floating controls regained their edge insets and
the graph meta row its 12px muted typography after conversion gaps.

Cell chrome and plugin wiring complete the render stage: the CodeMirror cell
source editor, the cell chrome with rails/collapse/run action/status footer,
the full `NotebookView` over the published `MarkdownView`, and the assembled
plugin (render-service registration, cell directive post-processor, run and
clear commands, status-bar context keys, safe-mode gating, input-rerun and
stale-autorun scheduling, notebook-state persistence) with panels, packages,
and the TypeScript language provider deferred to their stages. The
`Plugins/Notebook/Shell` family carries ten App-backed stories over eight
seeded notebook fixtures — including the legacy System Guide, Notebook
Gallery, and Input Types showcases (every UI-backed input factory) (async cells, vault FileAttachments, relative ESM imports,
viewof text/table/range inputs, md/html interpolation, stdlib helpers,
lapis.table, registerVaultFile SQL) — and the three panel families each carry
the six named placement stories, with the Dependencies canonical placement
also proving persisted graph-orientation round-tripping: the boot registration acceptance, `Run notebook`,
which executes through the worker transport and asserts rendered outputs,
interpolation, and persisted notebook state, `Safe mode`, which proves the
host execution-disable gate, `Run inputs`, which proves the in-process DOM
runtime, Design Core input mounting, and input-change rerun, `Query
data`, which proves SQL cells on DuckDB-WASM resolved through the plugin
asset paths plus the `lapis.notes` snapshot table, `Cancel execution`, which
proves mid-run cancellation with checkpoint rollback, and `Autorun stale
cells`, which proves edit-triggered stale marking and the debounced
settings-gated autorun. The `Workspace` story additionally regression-tests
generic file-open routing: `determineViewTypeForPath` resolves notebook
files to the notebook view type, and opening one through a plain leaf yields
`NotebookView` with its run-all header action. A static-import audit
keeps the heavy runtime modules behind lazy boundaries.

## Requirements

| ID | Requirement |
| --- | --- |
| LN-NB-001 | The standalone repository MUST ship `@lapis-notes/lapis-plugin-notebook` as a versioned first-party external package whose runtime manifest id is `lapis-notebook`, distribution is `first-party-external`, provenance is `official`, and `enabledByDefault` is `false`. |
| LN-NB-002 | `NotebookPlugin` MUST extend the public API `Plugin` surface and preserve runtime id `lapis-notebook` forever. `onload` MUST register the `.notebook.md` file-type association and editor view, and MAY register notebook commands, the settings tab, status-bar context keys, side-panel views, editor suggests, and Markdown cell rendering as governed by the Documents and Runtime chapters. |
| LN-NB-003 | First-party runtime, sub-package, and Storybook source MUST receive `App` explicitly or from the API component context and MUST NOT read or assign `globalThis.app`. The ownership audit MUST cover `src/lib`, `src/stories`, and every `packages/*/src` tree and MUST run in both the check and spec:check lanes. |
| LN-NB-004 | The published runtime MUST consume host facilities only through published first-party exports: `@lapis-notes/api`, `@lapismd/design-core`, and the peer-resolved `@lapis-notes/markdown` view surface. It MUST NOT depend on `@stevejuma/ui` or `@lapis-server/*`. Package Storybook MAY depend on workspace hosts for `Plugins/Notebook/Shell`. |
| LN-NB-005 | Each staged port slice MUST land with its canonical specification update, ported or new regression tests, Storybook coverage under `Plugins/Notebook/*`, and a verification-row status change supported by executed lane evidence. Statuses MUST NOT advance ahead of executed acceptance. |
| LN-NB-006 | Private `packages/*` sub-packages MUST resolve from TypeScript source through the shared Vite resolver and tsconfig paths so the published root manifest stays portable. The published plugin bundle MUST inline all private sub-package sources before any publication gate; a source-resolution `dist` is development-only and MUST NOT be published. |
| LN-NB-029 | The runtime manifest MUST declare the Lapis workspace ESM entry (`main.mjs`), the host-shared dependency list mirroring the bundle externals, and the permissions the plugin exercises — including `network.connect` for registry and remote-module resolution. |
| LN-NB-007 | The inspector, dependencies, and packages surfaces MUST register as movable side-panel views with `ViewAccess.command` classification and concise open commands, mounting their Svelte panels through the owned local-component mount helper. Each panel MUST have the six-placement story coverage required by the family Storybook contract before its verification row advances. |
| LN-NB-009 | The dependencies panel MUST render the derived per-note cell DAG through the in-repo layout engine, honoring the persisted orientation and wheel-zoom settings, and MUST keep cycle and duplicate-definition errors visible as document errors. |
