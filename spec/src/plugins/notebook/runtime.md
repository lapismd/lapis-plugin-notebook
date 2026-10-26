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
rendering, and notebook-state persistence. Cancellation, safe-mode, and
startup-thin acceptance remain open verification items, as does the packaged
worker asset path which lands with the publication bundle.

## Requirements

| ID | Requirement |
| --- | --- |
| LN-NB-020 | Cell execution MUST run through one shared engine reachable over two transports: a dedicated module Web Worker for eligible notebooks and an in-process fallback otherwise. Eligibility MUST be a pure policy decision, and worker host requests MUST cover app-table snapshots, vault file reads, and plugin asset URL resolution. |
| LN-NB-021 | Execution order MUST follow the derived dependency graph. Editing or re-running a cell MUST mark dependent descendants stale; autorun MUST rerun stale cells debounced and gated by per-note frontmatter and the global setting; input changes MUST rerun only the targeted downstream cells. |
| LN-NB-022 | Notebook runs MUST report cancellable progress through the host notifications API, MUST support checkpoint and rollback of cell state, and MUST terminate the affected runtime, worker, and query engine on cancellation. |
| LN-NB-023 | Outputs MUST persist as typed generated state through `appDatabase` notebook-state methods with per-cell source fingerprints and document mtime. Restoration MUST reuse persisted cell state on matching fingerprints, clamp transient states to stale, and never persist live DOM outputs. |
| LN-NB-024 | Execution MUST honor the host safe-mode contract: the `safeMode.notebookExecutionDisabled` context key and `app.safeMode.disableNotebookExecution` MUST block cell execution, and the status bar MUST surface the disabled state. |
| LN-NB-025 | SQL cells MUST query DuckDB-WASM resolved through the plugin asset server with pinned engine assets. App-derived data MUST register as read-only snapshot tables (`lapis.notes`, `lapis.links`, `lapis.search_documents`) and vault files through validated host reads. A provider seam MUST keep native DuckDB services replaceable without product changes. |
| LN-NB-026 | Plugin enable and workspace open MUST stay startup-thin: DuckDB, the TypeScript compiler, d3/Plot, htl, input runtime, and dependency resolvers MUST load lazily on first use only. |
| LN-NB-027 | Private support packages MUST keep their host-neutrality boundaries: `notebook-core` MUST NOT import Svelte, the API, or DuckDB; `notebook-duckdb` MUST NOT import DuckDB-Wasm or vault adapters; `notebook-worker` MUST stay transport-only; `notebook-input` MUST load UI dependencies only inside its lazy DOM runtime. |
| LN-NB-028 | TypeScript/JavaScript cells MUST transpile through the lazily loaded compiler, MUST rewrite static ESM imports to the runtime module loader, and MUST evaluate in an injected scope exposing cell values, dependency globals, validated builtins, and the `lapis` namespace. Remote user dependencies MUST resolve only through validated descriptors. |
