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
threaded `App` and `sourcePath`. Dead legacy component variants that nothing
imports are excluded and recorded in `PROVENANCE.md`.

## Requirements

| ID | Requirement |
| --- | --- |
| LN-NB-001 | The standalone repository MUST ship `@lapis-notes/lapis-plugin-notebook` as a versioned first-party external package whose runtime manifest id is `lapis-notebook`, distribution is `first-party-external`, provenance is `official`, and `enabledByDefault` is `false`. |
| LN-NB-002 | `NotebookPlugin` MUST extend the public API `Plugin` surface and preserve runtime id `lapis-notebook` forever. `onload` MUST register the `.notebook.md` file-type association and editor view, and MAY register notebook commands, the settings tab, status-bar context keys, side-panel views, editor suggests, and Markdown cell rendering as governed by the Documents and Runtime chapters. |
| LN-NB-003 | First-party runtime, sub-package, and Storybook source MUST receive `App` explicitly or from the API component context and MUST NOT read or assign `globalThis.app`. The ownership audit MUST cover `src/lib`, `src/stories`, and every `packages/*/src` tree and MUST run in both the check and spec:check lanes. |
| LN-NB-004 | The published runtime MUST consume host facilities only through published first-party exports: `@lapis-notes/api`, `@lapismd/design-core`, and the peer-resolved `@lapis-notes/markdown` view surface. It MUST NOT depend on `@stevejuma/ui` or `@lapis-server/*`. Package Storybook MAY depend on workspace hosts for `Plugins/Notebook/Shell`. |
| LN-NB-005 | Each staged port slice MUST land with its canonical specification update, ported or new regression tests, Storybook coverage under `Plugins/Notebook/*`, and a verification-row status change supported by executed lane evidence. Statuses MUST NOT advance ahead of executed acceptance. |
| LN-NB-006 | Private `packages/*` sub-packages MUST resolve from TypeScript source through the shared Vite resolver and tsconfig paths so the published root manifest stays portable. The published plugin bundle MUST inline all private sub-package sources before any publication gate; a source-resolution `dist` is development-only and MUST NOT be published. |
