# Notebook plugin

`@lapis-notes/lapis-plugin-notebook` owns the first-party external Notebook
plugin runtime. A notebook is an ordinary Markdown file with the
`.notebook.md` suffix whose executable cells are container directives. The
filesystem stays authoritative for cell sources. Generated outputs and input
values use the public AppDatabase metadata store under the notebook UUID, with
the existing typed notebook-state shape. Legacy path-keyed records remain
readable until a successful save writes UUID-keyed state.

The first generated-state save assigns `notebook.id` in frontmatter if absent;
opening a notebook remains read-only and first-time execution remains manual.
Renaming retains saved controls and outputs. The Saved inputs after rename
shell story proves restoration in Safe Mode without another execution, including
concurrent cell mounts and shared hydration. A newer run or clear action takes
precedence over a delayed persisted-state read (LN-NB-044–046).

The plugin is a staged port of the legacy `@lapis-notes/notebook` package and
its six private support packages from `legacy-lapis-notes`. Ported behavior
keeps its legacy regression evidence; presentation remaps onto public
`@lapismd/design-core` exports instead of re-creating primitives. The tracked
dependency cohort resolves published registry versions — peers
`@lapismd/design-core@^0.7.2`, `@lapis-notes/api@^0.2.2`, and
`@lapis-notes/markdown@^0.2.0` and `@lapis-notes/ui@^0.1.5`, with the Storybook host cohort pinned in
development at `@lapis-notes/ui@0.1.5`, `@lapis-notes/workspace@0.3.1`,
`@lapis-notes/file-explorer@0.2.0`, `@lapis-notes/search@0.1.4`, and
`@lapismd/mira@0.1.3`; local sibling source snapshots MAY replace matching
installs through `.pnpmfile.cjs` per LPN-SPEC-005. The runtime
plugin id `lapis-notebook` is preserved from the legacy plugin so persisted
plugin data keys remain compatible. The DuckDB-WASM engine dependency is
pinned exactly at `1.33.1-dev45.0` in root dependencies per LPN-SPEC-004 so
query behavior cannot drift independently from the ported compatibility
tests.

Development tooling includes registry Turbo for the container CI build, quality
and unit task cache; it adds no runtime dependency or published export.

The npm runtime entry is the compiled bundle, and its declaration entry bundles
the private support types. Prepack produces both entries and their CSS/assets;
source-resolution output stays under ignored build staging. Publication rejects
unpublished support imports in JavaScript and declarations and rejects runtime
imports missing from the manifest. Relative asset URLs remain checkout-neutral.

Notebook execution feedback is owned by the active-notebook status item and its
run-details popover, with session-local outcomes and no completion toast.
Live cell refreshes reuse immutable parsed documents and their dependency
graphs through the owned render service. Source, normalized metadata, path
and file-creation changes invalidate the parsed snapshot (LN-NB-042). Public
vault wrapper copies share a bounded path cache; live
progress and partial-output polling stay enabled.

Cell chrome retains legacy gutter alignment and delegates source-language
highlighting to Mira. Inline ID badges rename cell metadata through the vault
without changing source bodies or persisted execution authority.

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
The snippet editors use a notebook-owned CodeMirror `HighlightStyle` with
AA-contrast token colors on the white body surface (an earlier
`miraClassHighlighter` opt-in pulled Mira's editor theme CSS into every
importing graph and exposed its sub-AA hljs palette); the graph's floating
controls regained their edge insets and the graph meta row its 12px muted
typography after conversion gaps. Cell status tones use a static AA palette
(`#166534`/`#b91c1c`/`#b45309`, `.dark` overrides) because legacy `--text-*`
tokens fall below 4.5:1 on the white body surface and unselected rows
composite at 0.95 opacity. The collapsed source preview's click-to-edit
layer is a mouse-only enhancement without button role: its visible text is
arbitrary source code, which can never satisfy WCAG label-in-name, while
keyboard and AT users keep the toolbar Edit action. Story-side, the shell
axe context excludes Mira's numbered code-block chrome (`.mira-code-block`,
upstream hljs palette flagged to the Mira owner), and a shared storybook
stylesheet pins every app-backed demo root to the viewport in canvas mode so
lazy-mounted sidebar-group panes intersect without relying on Storybook
body classes.

Cell chrome and plugin wiring complete the render stage: the CodeMirror cell
source editor, the cell chrome with rails/collapse/run action/status footer,
the full `NotebookView` over the published `MarkdownView`, and the assembled
plugin (render-service registration, cell directive post-processor, run and
clear commands, status-bar context keys, safe-mode gating, input-rerun and
stale-autorun scheduling, notebook-state persistence) with panels, packages,
and the TypeScript language provider deferred to their stages. The
`Plugins/Notebook/Shell` family carries eleven App-backed stories over eight
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
settings-gated autorun. The `Panel group` story proves the default
presentation: the demo seeds the `Notebook` sidebar group into the initial
layout (the host contract the runtime seeding targets) and the story asserts
Variables, Dependencies, and Packages all mount inside one group. The
`Workspace` story additionally regression-tests
generic file-open routing: `determineViewTypeForPath` resolves notebook
files to the notebook view type, and opening one through a plain leaf yields
`NotebookView` with its run-all header action. A static-import audit
keeps the heavy runtime modules behind lazy boundaries.

## Requirements

The System Guide follows the JavaScript, Markdown and HTML organization of
[Observable's system guide](https://observablehq.github.io/notebook-kit/system-guide),
with feature subheadings, a sample-data catalog and executable Plot/D3 examples.
The reference is a navigation and authoring model, not a claim of full runtime
parity: supported inputs and missing Observable facilities remain explicit.
The catalog declares Plot, D3 and htl as development dependencies at the same
versions already used by the private stdlib. Vite prepares their import IDs,
including Plot's transitive CommonJS modules; runtime library loading remains
lazy. Registry manifests and lockfiles remain portable.

Dataframe filters use one full-width row per column, with aligned labels and
controls and a stacked control area in narrow containers. Operators and boolean
values use the public Design Core Select family; all controls have names tied
to their columns. Choosing an operator before entering a value remains possible,
and null checks do not require a value. Clear actions reset the affected filter
or the full set. Governed desktop/mobile stories exercise real filtering,
keyboard selection, Escape/focus return and reset.

| ID        | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LN-NB-001 | The standalone repository MUST ship `@lapis-notes/lapis-plugin-notebook` as a versioned first-party external package whose runtime manifest id is `lapis-notebook`, distribution is `first-party-external`, provenance is `official`, and `enabledByDefault` is `false`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| LN-NB-002 | `NotebookPlugin` MUST extend the public API `Plugin` surface and preserve runtime id `lapis-notebook` forever. `onload` MUST register the `.notebook.md` file-type association and editor view, and MAY register notebook commands, the settings tab, status-bar context keys, side-panel views, editor suggests, and Markdown cell rendering as governed by the Documents and Runtime chapters.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| LN-NB-003 | First-party runtime, sub-package, and Storybook source MUST receive `App` explicitly or from the API component context and MUST NOT read or assign `globalThis.app`. The ownership audit MUST cover `src/lib`, `src/stories`, and every `packages/*/src` tree and MUST run in both the check and spec:check lanes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| LN-NB-004 | The published runtime MUST consume host facilities only through published first-party exports: `@lapis-notes/api`, `@lapismd/design-core`, and the peer-resolved `@lapis-notes/markdown` view surface. It MUST NOT depend on `@stevejuma/ui` or `@lapis-server/*`. Package Storybook MAY depend on workspace hosts for `Plugins/Notebook/Shell`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| LN-NB-005 | Each staged port slice MUST land with its canonical specification update, ported or new regression tests, Storybook coverage under `Plugins/Notebook/*`, and a verification-row status change supported by executed lane evidence. Statuses MUST NOT advance ahead of executed acceptance.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| LN-NB-006 | Private `packages/*` sub-packages MUST resolve from TypeScript source through the shared Vite resolver and tsconfig paths so the published root manifest stays portable. The published plugin bundle MUST inline all private sub-package sources before any publication gate; a source-resolution `dist` is development-only and MUST NOT be published.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| LN-NB-029 | The runtime manifest MUST declare the Lapis workspace ESM entry (`main.mjs`), the host-shared dependency list mirroring the bundle externals, and the permissions the plugin exercises — including `network.connect` for registry and remote-module resolution.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| LN-NB-007 | The inspector, dependencies, and packages surfaces MUST register as movable side-panel views with `ViewAccess.command` classification and concise open commands, mounting their Svelte panels through the owned local-component mount helper. Each panel MUST have the six-placement story coverage required by the family Storybook contract before its verification row advances.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| LN-NB-009 | The dependencies panel MUST render the derived per-note cell DAG through the in-repo layout engine, honoring the persisted orientation and wheel-zoom settings, and MUST keep cycle and duplicate-definition errors visible as document errors. Visible orientation labels MUST match the applied and persisted orientation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| LN-NB-036 | The System Guide MUST organize runnable examples with JavaScript, Markdown and HTML headings, render charts and a network graph from bundled sample datasets, and show the available data with a row preview. Input Types MUST demonstrate every supported input factory, state unsupported factories explicitly, and retain an audit against the actual input runtime. Chart and graph examples MUST remain finite and preserve bundled source data.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| LN-NB-037 | Dataframe filters MUST show one column filter per row, use public Design Core Select controls, remain usable in narrow containers, and support named keyboard-accessible text, numeric, boolean and date controls with reset actions. Input tables MUST span their container when data is narrower, with row separators covering the available width and horizontal scrolling for wider data.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| LN-NB-038 | The twenty Observable-compatible notebook input factories MUST be available with matching values, defaults and events, using public Design Core controls. Inputs.markdown MUST additionally expose a live Markdown string through public Design Core MarkdownComposer without a submit step. Choices MUST preserve typed values, search MUST honor token/column/custom filtering, and forms MUST aggregate children once per logical change. Value updates MUST preserve control identity and focus.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| LN-NB-039 | File inputs MUST accept vault files and temporary browser uploads, support mixed ordered multiple selections, expose shared attachment reading methods and honor accept/required/disabled options. Vault references MAY persist; uploaded bytes, live files, callbacks and DOM nodes MUST NOT persist. Reopening MUST restore available vault files, identify temporary selections needing reselection and mark affected results stale.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| LN-NB-040 | Notebook code outputs MUST retain literal source, language and optional title, and render through public Design Core CodeBlock with syntax highlighting and copy controls. Input examples MUST demonstrate code output. File choosers MUST use Design Core Command and FileTypeIcon, selected files MUST use file icons and distinct filled source badges, and search MUST show a leading search icon.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| LN-NB-041 | Healthy notebook output wrappers MUST render without borders or horizontal padding and MAY use a subtle theme-aware background. Output cells MUST provide comfortable vertical padding and Markdown embeds MUST share the output background; tinted output backgrounds MUST extend slightly to the left without shifting content. Input wrappers MUST remain transparent and avoid duplicating control-owned labels. Buttons MUST work without a separate label. Labelled controls MUST use label-left/control-right rows with wrapping controls in narrow containers. Input Types MUST follow each input cell with a separate reactive output cell showing its value, including empty selections, while preserving control focus, identity and intrinsic component styling. Inputs MUST NOT add an embedded value readout. display MUST accept raw scalar, null, undefined, array and object values without caller serialization while preserving explicit output and DOM batches. |
| LN-NB-043 | Direct non-string JavaScript display values MUST render as syntax-highlighted JavaScript code through the existing code renderer. Strings MUST remain readable text and explicit rich outputs and DOM nodes MUST retain their renderers. Inspection MUST escape circular references without treating repeated non-circular references as loops, preserve non-JSON primitives, avoid evaluating getters or toJSON, and safely bound excessive nesting.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |

Selected Design Core checkboxes retain their checked tick contrast. Input table
selection uses a distinct fill so row separators remain visible. Source code
blocks have square lower corners where they join the notebook footer. Collapsed
cell IDs overlay the bottom-right code corner without adding layout height,
retaining desktop hover/focus and touch visibility and inline renaming.

Cell editing preserves the source preview's geometry in reading and live-preview
notebooks, including padding and a matching line-number gutter surface. Plain
text execution results use the document's prose face while retaining literal
content and line breaks; structured fallback output retains code formatting.

## Notebook embeds

Notebook registers the public Markdown embed hook for `.notebook.md` targets,
matching the host path used by Transcripts. A report can include
`![[Analysis.notebook.md]]` or a relative notebook link. The embed renders the
notebook's Markdown prose and cell outputs with links resolved from that
notebook, without source-editing or execution controls. Opening the source
notebook remains available through an accessible action. Reconstructable inputs
remain interactive, with a distinct control per embed and shared values. Inputs
that need callbacks from their defining cell retain the manual-run fallback.

| ID        | Requirement                                                                                                                                                                                                                                                                                                              |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| LN-NB-047 | Notebook embeds MUST use the public Markdown embed registry, claim only notebook files, and render notebook prose and cell outputs rather than raw directives. Relative links MUST resolve from the embedded notebook. Embeds MUST expose an accessible open-notebook action without source-editing or execution chrome. |

## Complete input catalog

LN-NB-038 adds button, checkbox, radio, select, file, search and form to the
existing thirteen factories. Notebook-facing Observable signatures, defaults,
typed values and input events govern behavior. Public Design Core Button,
ButtonGroup, Checkbox, RadioGroup, Select, Input, Field, Dialog and Command
components supply presentation. Choice IDs are internal; callers receive
original values, including Map values and object choices. Search returns rows
and exposes query; forms aggregate live array/object child values without a
submit step. Input Types demonstrates all twenty Observable-compatible factories plus the Lapis Markdown extension with executable
Observable-style examples and a runtime-backed coverage audit.
