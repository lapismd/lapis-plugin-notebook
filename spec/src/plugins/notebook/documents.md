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

For LN-NB-014, string literals, comments and template text MUST NOT invent
definitions or dependencies. Template interpolation expressions MUST retain
their real references, and a member property MUST NOT suppress a separate
variable reference with the same spelling. Analysis uses the existing
JavaScript/TypeScript syntax parser without eagerly loading the compiler.

Implementation status: the file identity, directive parser, frontmatter
normalization, and round-trip edit commands (LN-NB-010–013) are ported with
their legacy regression suites; the analysis and graph consumers
(LN-NB-014) activate with the runtime stage.

The first generated-state save adds a UUID under `notebook.id` through the
public file-manager API. That stable identifier follows inputs and outputs
across file renames; it does not replace the filename suffix used to recognize
notebook documents. Parsing and opening remain read-only.

## Requirements

Live cell action rails align to the measured document line-number gutter using
a notebook-owned negative margin. Source cells delegate nested fence token
highlighting to Mira's public Markdown composition. Focus paint stays inside
the cell boundary so the complete right edge remains visible.
The content layer MUST remain above its sticky gutter sibling within the
notebook editor's stacking context. Both accent rails and Run/Stop controls
MUST stay visible and receive pointer hits before, during and after execution.

| ID        | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LN-NB-010 | Notebook file recognition MUST use the `.notebook.md` filename suffix. The plugin MUST register the suffix with the host file-type association and editor-view contribution so notebooks open in the notebook surface by default while remaining ordinary Markdown files elsewhere.                                                                                                                                                                                                                                                           |
| LN-NB-011 | A cell MUST be a `:::cell{attrs}` container directive closed by `:::` with exactly one fenced code body. Attributes MUST support `#id` (default `cell-N`), `lang` (`ts`, `js`, `sql`, `md`, `html`; default `ts` inferred from the fence info string), `run` (`autorun`, `lazy`, `manual`), `hide`, `folded`, and `outputFolded`. Parsing MUST retain byte-offset and line ranges for the cell and its inner source.                                                                                                                          |
| LN-NB-012 | Notebook frontmatter MUST live under the `notebook:` key with `version: 1` and MAY set `id`, `autorun`, `mode`, and `mounts`. Missing or partial frontmatter MUST normalize to the documented defaults without rewriting the file until an explicit command persists a change, except for the first-save UUID assignment governed by LN-NB-044.                                                                                                                                                                                               |
| LN-NB-013 | Notebook edits MUST round-trip: cell source replacement, cell insertion, and frontmatter updates MUST rewrite only their targeted ranges through host vault/file-manager APIs and MUST NOT write outputs, execution state, or fingerprints into note bytes.                                                                                                                                                                                                                                                                                   |
| LN-NB-014 | Dependency analysis MUST extract top-level definitions and referenced identifiers from TypeScript/JavaScript cells against the reserved builtin name set, and interpolation references from Markdown/HTML/SQL cells. Graph construction MUST detect duplicate definitions and cycles and MUST produce a topological execution order with stale-descendant propagation.                                                                                                                                                                        |
| LN-NB-032 | Entering inline cell editing MUST preserve the source preview's size and padding for unchanged content in reading and live-preview notebooks. The cell editor MUST remain content-sized, without full-document trailing space, and its line-number gutter MUST share the editor background.                                                                                                                                                                                                                                                   |
| LN-NB-034 | Live-preview cell action controls MUST align with the document line-number gutter while retaining the cell's right edge. Cell selection and focus MUST use a single frame in the existing grey focus-border tone, with aligned rounded corners above rendered code within its clipped surface. Source-mode fences inside cell directives MUST retain language syntax highlighting.                                                                                                                                                            |
| LN-NB-035 | Every cell MUST expose its ID as a bottom-right corner badge, including collapsed code cells. Badges MUST match the code background and selected cell border styling. Desktop badges MUST appear on hover or keyboard focus; mobile and touch badges MUST stay visible. Activating a badge MUST allow inline renaming, with Enter or blur to save and Escape to cancel. Saves MUST reject invalid, duplicate, ambiguous or missing IDs, reparse the current document, preserve cell bodies and unrelated content, and use the host vault API. |
| LN-NB-044 | Before its first generated-state save, a notebook MUST persist a UUID under `notebook.id` through the public file-manager API, retaining unrelated frontmatter and valid IDs except when resolving a copied identity under LN-NB-045. Parsing or opening an unrun notebook MUST remain read-only, and identity assignment MUST NOT execute cells.                                                                                                                                                                                             |
