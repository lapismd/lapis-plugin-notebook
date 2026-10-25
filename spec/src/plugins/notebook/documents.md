# Notebook documents

A notebook document is ordinary Markdown so it stays readable, linkable, and
diffable without the plugin. Executable cells are `:::cell` container
directives wrapping exactly one fenced code block, following the legacy
Markdown-cell-model decision (ADR-002) rather than `.ipynb` or whole-file
execution. Cell sources round-trip byte-exact: commands rewrite only targeted
cell ranges or frontmatter, and generated outputs never enter the note bytes.

Dependency structure is derived, not authored: top-level definitions and
identifier references in TypeScript/JavaScript cells and `{{name}}` or
`${...}` interpolation references in Markdown/HTML/SQL cells form a per-note
directed graph. The graph drives execution order, stale propagation, and the
dependencies panel; duplicate definitions and cycles are document errors.

Implementation status: the file identity, directive parser, frontmatter
normalization, and round-trip edit commands (LN-NB-010–013) are ported with
their legacy regression suites; the analysis and graph consumers
(LN-NB-014) activate with the runtime stage.

## Requirements

| ID | Requirement |
| --- | --- |
| LN-NB-010 | Notebook identity MUST be the `.notebook.md` filename suffix. The plugin MUST register the suffix with the host file-type association and editor-view contribution so notebooks open in the notebook surface by default while remaining ordinary Markdown files elsewhere. |
| LN-NB-011 | A cell MUST be a `:::cell{attrs}` container directive closed by `:::` with exactly one fenced code body. Attributes MUST support `#id` (default `cell-N`), `lang` (`ts`, `js`, `sql`, `md`, `html`; default `ts` inferred from the fence info string), `run` (`autorun`, `lazy`, `manual`), `hide`, `folded`, and `outputFolded`. Parsing MUST retain byte-offset and line ranges for the cell and its inner source. |
| LN-NB-012 | Notebook frontmatter MUST live under the `notebook:` key with `version: 1` and MAY set `autorun`, `mode`, and `mounts`. Missing or partial frontmatter MUST normalize to the documented defaults without rewriting the file until an explicit command persists a change. |
| LN-NB-013 | Notebook edits MUST round-trip: cell source replacement, cell insertion, and frontmatter updates MUST rewrite only their targeted ranges through host vault/file-manager APIs and MUST NOT write outputs, execution state, or fingerprints into note bytes. |
| LN-NB-014 | Dependency analysis MUST extract top-level definitions and referenced identifiers from TypeScript/JavaScript cells against the reserved builtin name set, and interpolation references from Markdown/HTML/SQL cells. Graph construction MUST detect duplicate definitions and cycles and MUST produce a topological execution order with stale-descendant propagation. |
