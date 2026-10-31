# Notebook runtime

Execution keeps the legacy hybrid transport: one shared engine runs cells in a
dedicated Web Worker for eligible notebooks and falls back to in-process
execution for notebooks that need DuckDB, live DOM outputs, or host-only
providers, surfacing the fallback reason. Reactivity is Lapis-owned and
explicit — a marimo/Pluto-style dependency graph reruns or marks stale
descendants; there is no implicit Observable observer runtime. TypeScript
cells transpile through a lazily loaded compiler and evaluate in an injected
scope; SQL cells query DuckDB; Markdown/HTML cells interpolate.

Generated outputs are typed, disposable state. They persist through the host
AppDatabase notebook-state contract — already published end-to-end by the
shared Rust core (`save_notebook`, `NotebookState`/`NotebookCell`/
`NotebookPhase`) and the remote/native database protocols — so web, Tauri
desktop, and the hosted Rust server share one persistence path. The legacy
Electron native-DuckDB sidecar is out of scope; a future transport-independent
native services crate requires its own specification and lane intake first.

Implementation status: Stage 2 registers the host surface — the plugin class
loads through the public lifecycle, persists versioned settings through
`loadData`/`saveData`, registers the `notebook.autorun` metadata property
type, the file-keyed notebook view, the editor-view contribution, the
`.notebook.md` extension association, the cell slash-menu editor suggest,
the settings tab, and the authoring commands.

The complete execution logic is ported verbatim under `src/lib/runtime/`
with its nine legacy regression suites green: dependency analysis, graph,
session and session manager, runtime controller/registry/status, output
store, interpolation, the shared worker engine, worker client with
transport-eligibility policy, runtime protocol and worker entry, the
DuckDB-WASM service with app-table and vault-file registration, and the
plugin runtime-asset resolver. The legacy Electron native-DuckDB sidecar
provider is excluded; the provider seam remains per LN-NB-025. Plugin wiring has landed: the render service registers globally, the cell
post-processor mounts `:::cell` directives through the bridged API registry
(moving the directive `lang` attribute to data before mount so the host
element keeps valid HTML `lang` semantics), and run/clear commands, status-bar
items with context-key when-expressions, safe-mode gating, input rerun and
autorun scheduling are registered. The `Plugins/Notebook/Shell` `Run
notebook` story proves the worker transport, TypeScript evaluation with
`display()` capture, `{{name}}` interpolation (variable definitions win over
cell-id output values only when names do not collide), MarkdownEmbed output
rendering, and notebook-state persistence. Safe-mode, startup-thin,
cancellation, and autorun acceptance have since landed as governed stories
and audits; the packaged worker asset path remains open, landing with the
publication bundle. The input package's table surface rebinds Mira's
`--table-preview-spacing` so document-table typography does not gap input
tables inside their rounded containers, and overrides the markdown package's
document-table cell borders (scoped mirrors of its `.markdown-rendered` and
`.markdown-preview-surface` selectors) so input tables keep a single rounded
outline with row separators instead of double perimeters. DOM-backed notebooks execute through the in-process
runtime: the `Run inputs` story proves the viewof input mount on Design Core
primitives with `aria-label` wired from the input's `label` option, and the
debounced targeted rerun of downstream cells on input change.

The notebook editor-view contribution registers with
`priority: "exclusive"` and the specific `*.notebook.md` pattern (the
transcript plugin contract): markdown claims `*.md` exclusively, and the
registry ranks exclusive tiers by pattern specificity, so generic file-open
paths deterministically route notebook files to `NotebookView` — with the
previous `default` priority they lost to markdown and header actions only
appeared for leaves opened through explicit layout state. The panel surfaces are registered with `ViewAccess.command` openers
(`open-notebook-session-view`, `open-notebook-dependencies-view`,
`open-notebook-packages-view`), refresh on controller, layout, and leaf
events, honor the panel auto-open settings, and degrade with a warning
instead of unhandled rejection when catalog or registry probing fails on
hosts without resolvable assets or network. The default panel presentation
is one right-sidebar group named `Notebook` holding Variables, Dependencies,
and Packages, gated by the `panels.openPanelGroupOnNotebookOpen` setting
(default on). Because the host controller projects sidebar groups from the
layout present at boot and plugin `onload` runs before
`workspace.loadLayout()`, the plugin seeds the group into the persisted
layout file during `onload` through the public vault read/modify surface;
first-run hosts without a layout file fall back to a runtime
`toJson`/vault/`loadLayout` patch on first notebook open, which the host
persists for subsequent boots. The plugin asset URL fallback
anchors root-relative plugin paths at the document origin for browser hosts
without an asset server. The plugin registers its run-all icon with both the
api icon registry and the Design Core workspace icon registry (the header
renders through the latter), and plugin-side controls carry `title`
tooltips beside their aria-labels. The input runtime names its table row
selection controls for the strict a11y gate. Panel context resolution falls back from the active
leaf to any open notebook leaf, because panel views are main-area tabs in the
current workspace and can hold the active leaf themselves (the legacy
sidebar assumption no longer holds); views additionally seed a refresh at
registration and once the layout is ready, since deferred view creation can
land after the workspace file-open events have fired.

## Requirements

Execution planning under LN-NB-021 consumes the lexical dependency boundary in
LN-NB-014. Attachment filenames and comments cannot create cycles that exclude
unrelated guide examples from the scheduled order; real template-expression
references remain dependencies.

Input tables under LN-NB-037 fill the available input width, including within
Markdown reading surfaces. The input package owns this table presentation and
keeps wider tables horizontally scrollable without changing document tables.
Range-input value updates under LN-NB-021 MUST update the existing mounted
Slider through reactive public props rather than destroy and recreate it. The
private reactive-props helper MUST remain inside the lazy UI load boundary.
Value changes preserve the control's identity and focus, and later notebook
interactions MUST NOT reach handlers belonging to destroyed slider state.

| ID        | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LN-NB-020 | Cell execution MUST run through one shared engine reachable over two transports: a dedicated module Web Worker for eligible notebooks and an in-process fallback otherwise. Eligibility MUST be a pure policy decision, and worker host requests MUST cover app-table snapshots, vault file reads, and plugin asset URL resolution.                                                                                                                                                                                                                                                                                           |
| LN-NB-021 | Execution order MUST follow the derived dependency graph. Editing or re-running a cell MUST mark dependent descendants stale; autorun MUST rerun stale cells debounced and gated by per-note frontmatter and the global setting; input changes MUST rerun only the targeted downstream cells.                                                                                                                                                                                                                                                                                                                                 |
| LN-NB-022 | Notebook runs MUST share cancellable execution ownership, support checkpoint rollback, and terminate the affected worker/query engine or abort in-process waits. Cancellation MUST invalidate cells, reject late results and persistence, release the pending run, and leave other notebooks unaffected.                                                                                                                                                                                                                                                                                                                      |
| LN-NB-023 | Outputs MUST persist as typed generated state through the public `appDatabase` metadata store, keyed by notebook UUID with per-cell source fingerprints and document mtime. Restoration MUST reuse persisted cell state on matching fingerprints, clamp transient states to stale, and never persist live DOM outputs.                                                                                                                                                                                                                                                                                                        |
| LN-NB-024 | Execution MUST honor the host safe-mode contract: the `safeMode.notebookExecutionDisabled` context key and `app.safeMode.disableNotebookExecution` MUST block cell execution, and the status bar MUST surface the disabled state.                                                                                                                                                                                                                                                                                                                                                                                             |
| LN-NB-025 | SQL cells MUST query DuckDB-WASM resolved through the plugin asset server with pinned engine assets. App-derived data MUST register as read-only snapshot tables (`lapis.notes`, `lapis.links`, `lapis.search_documents`) and vault files through validated host reads. A provider seam MUST keep native DuckDB services replaceable without product changes.                                                                                                                                                                                                                                                                 |
| LN-NB-026 | Plugin enable and workspace open MUST stay startup-thin: DuckDB, the TypeScript compiler, d3/Plot, htl, input runtime, and dependency resolvers MUST load lazily on first use only.                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| LN-NB-027 | Private support packages MUST keep their host-neutrality boundaries: `notebook-core` MUST NOT import Svelte, the API, or DuckDB; `notebook-duckdb` MUST NOT import DuckDB-Wasm or vault adapters; `notebook-worker` MUST stay transport-only; `notebook-input` MUST load UI dependencies only inside its lazy DOM runtime.                                                                                                                                                                                                                                                                                                    |
| LN-NB-028 | TypeScript/JavaScript cells MUST transpile through the lazily loaded compiler, MUST rewrite static ESM imports to the runtime module loader, and MUST evaluate in an injected scope exposing cell values, dependency globals, validated builtins, and the `lapis` namespace. Remote user dependencies MUST resolve only through validated descriptors.                                                                                                                                                                                                                                                                        |
| LN-NB-030 | The active notebook MUST expose one compact, rounded status group with separate Run/Stop and outcome icon controls, a subtle background and divider, and whole-run elapsed duration. Stop MUST use the destructive color, running MUST animate subject to reduced-motion preferences, and success MUST use a green-filled circle-check. Its notification-style popover MUST group outcome, runtime/output state, dependency-expanded progress, duration, setup phases and navigable failures, with icon actions using public Design Core buttons. Execution MUST NOT emit progress, success, failure, or cancellation toasts. |
| LN-NB-031 | Actual cell or runtime failures MUST publish file-scoped error diagnostics through the plugin-owned public Problems collection, with cell source ranges when available. Reruns MUST replace diagnostics for their affected cells; cancellation MUST NOT create errors or clear unrelated cell failures.                                                                                                                                                                                                                                                                                                                       |
| LN-NB-033 | Plain text outputs MUST use the Markdown preview text face and preserve literal content and line breaks. Structured fallback outputs MAY retain monospace formatting.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| LN-NB-008 | The packages registry MUST query the npm registry for manifests and search results, MUST validate every descriptor through the stdlib dependency validation before persisting it to plugin settings, and MUST resolve remote ESM imports only through the validated descriptor contract. The publication manifest MUST declare the network permission before the bundled distribution gate.                                                                                                                                                                                                                                   |
| LN-NB-042 | Ready cells MUST execute in document order while respecting dependencies so dependent value cells precede later unrelated work. Explicit display outputs MUST publish while their cell remains running, through both execution transports. Live cell polls MUST reuse unchanged parsed document snapshots and their dependency graphs; content, metadata and path changes MUST invalidate the parsed snapshot. Dependent cells MUST read the latest input values; an older evaluation MUST NOT overwrite input changes or publish late outputs after completion, cancellation or supersession.                                |
| LN-NB-045 | Saved inputs and outputs MUST follow a notebook UUID across renames, prefer UUID state over legacy path records, and retain compatibility with existing path-keyed state. Clearing results MUST prevent legacy-state resurrection; copied IDs MUST NOT expose another existing notebook’s saved values. No host database schema migration is required.                                                                                                                                                                                                                                                                        |
| LN-NB-046 | Concurrent cell mounts MUST await the same once-per-session persisted-state hydration before returning rendered outputs, without executing reconstructable input cells. Delayed hydration MUST NOT overwrite a newer session change, including completed execution or cleared outputs.                                                                                                                                                                                                                                                                                                                                        |

Run details are plugin-owned, per-notebook session state; they do not migrate
persisted generated outputs. Switching documents hides the item without cancelling
background work. Promise cancellation is cooperative in process: awaited work is
released, scoped promise helpers are invalidated, and late engine effects are
rejected; synchronous JavaScript and arbitrary external effects cannot be undone.

## Input capabilities and restoration

LN-NB-038–039 keep UI dependencies behind the lazy DOM runtime. The plugin
supplies notebook-scoped vault-list/read and input-error callbacks; the input
package MUST NOT acquire App. UI inputs retain in-process execution and Safe
Mode gating, and callbacks/abort signals MUST NOT enter serialized worker
options. Unexpected input failures use the existing Notebook Problems collection;
validation feedback is inline and execution toasts remain absent.

Input restoration uses factory-specific snapshots for choices, query state,
recursive forms and file references, while retaining old saved input values.
Native FileList is never assigned. Uploaded File objects remain session-local
across reruns and notebook switching; persistence retains only a reselection
marker. File reads reuse stdlib attachment parsing and occur lazily. Stale or
disposed pickers cannot commit late selections. Disposing forms releases child
controls and listeners. This requires no host storage migration or published
host API change.

Structured input owners remain registered through execution cleanup. Their model
state is outside Svelte's deep proxy; a reactive revision updates the mounted
view. Native implementation input/change events stop at the mount boundary so
one interaction emits one owner input event. Vault restoration settles before
view values reach cells, refreshes metadata, and releases pending waits when the
notebook owner is aborted or disposed.

`Inputs.markdown({ label, value, placeholder, disabled, width })` is a Lapis
extension returning a live Markdown string. It composes public MarkdownComposer
without a send button, hint or submit step; equality-guarded changes preserve
editor focus and identity. Plain strings and recursive form snapshots restore
through the same owned input lifecycle. Disabled, aborted, inactive and disposed
owners ignore late editor callbacks.

`lapis.code(source, language = "plaintext", { title }?)` appends a serializable
code output. The renderer composes public Design Core CodeBlock with literal
source and language; uploaded CSV/JSON and live form examples use JSON code
outputs. Input presentation composes InputGroup for the leading search icon,
FileTypeIcon in both the Command chooser and selected-file rows, and filled
Badge variants distinguishing Upload and Vault. Private Svelte controls compile
into lazy worker chunks; workers do not execute the DOM input runtime, and
host-shared Svelte/Design Core remain external.

The catalog installs its worker plugin pipeline once after Vite configuration
merging to avoid recompiling rune modules. Development watching excludes owned
validation reports and build artifacts so collecting a static build cannot
reload the active review notebook.

## Embedded notebook lifecycle

| ID        | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                        |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LN-NB-048 | Mounting a notebook embed MUST restore available saved results without executing cells, including callback-dependent inputs. Source changes, renames and deletion MUST refresh its content. Teardown MUST release listeners and ignore late reads. Repeated embeds MUST remain independently mounted; recursive notebook references MUST terminate with inline feedback. Read failures MUST use Problems without execution toasts. |
| LN-NB-049 | Repeated notebook embeds MUST own separate reconstructable input controls while sharing notebook values and persistence state. Updates MUST preserve focus and control identity, retain typed choice identity through factory snapshots, and synchronize other mounted copies. Teardown MUST cancel pending reconstruction, dispose its listeners and ignore late callbacks without clearing the notebook-owned input.             |
