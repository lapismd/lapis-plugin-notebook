# 2026-10-26 — Port state handoff after Stages 0–7

## Stage status

| Stage | Scope | State |
| ----- | ----- | ----- |
| 0 | Scaffold, spec, validation runner, CI | Done (`e3a38ef0` lineage) |
| 1 | Six private support packages + 29 legacy suites | Done |
| 2 | Document model, parser, frontmatter, commands, registrations, thin view | Done (Docker `121dd86d`) |
| 3 | Render stack: dataframe family, output renderers, cell chrome (Design Core remap, Tailwind→native CSS) | Done |
| 4 | Runtime wiring: worker transport, run/clear commands, status bar, safe mode, persistence; cancellation + autorun acceptance | Done (Docker `012fe4e6`, `49be9b9a`) |
| 5 | Inputs surface: viewof, Design Core input mounts with `aria-label`, targeted input-change rerun | Done |
| 6 | DuckDB-WASM: SQL cells, app-table snapshots, asset paths | Done (Docker `49be9b9a` includes `b55a5e21` bundle state) |
| 7 | Panels: inspector/dependencies/packages + six-placement story suites + bundle lane | Done (Docker run for `f0b18e06` in flight at writing; final state `4d87b898`) |
| 8 | Native Rust services crate | Deferred by plan until the R6/R7 host boundary stabilizes |
| 9 | Consumer acceptance (web host, Tauri desktop, hosted Rust server) | Not started — see checklist below |

All 43 spec requirements are Implemented; the verification tracker carries no
Planned rows. 25 Storybook stories (7 shell + 18 panel placements) pass with
strict axe; 290 unit tests across 67 files; bundle lane emits `dist/main.mjs`
with the exclusion audit green.

## Stage 9 checklist (consumer acceptance)

1. Host import-map alignment: verify the web/desktop plugin hosts expose the
   28 `sharedDependencies` declared in `manifest.json`
   (`lapis.runtime.entries.workspace`); any module a host does not expose
   must move from bundle externals into the inlined set and out of the
   manifest list (LN-NB-006/029 boundary).
2. Web host: install the bundled `dist/` as a first-party-external plugin,
   open a `.notebook.md`, run cells (worker transport), open all three
   panels, exercise packages install against the npm registry with the
   declared `network.connect` permission.
3. Tauri desktop: same pass; confirm the worker `?worker&url` asset and the
   `duckdb/` asset paths resolve through the plugin asset server
   (`createNotebookDuckDbServiceOptions`).
4. Hosted Rust server (lapis-server): headless workspace boot with the
   plugin registered; execution is browser-side, so server acceptance covers
   registration, settings persistence, and vault file handling only.
5. Consumer refresh per the workspace ownership map once the row is added
   (pending explicit user go-ahead for the shared AGENTS.md edit).

## Upstream flags (owners outside this repo)

- `lapis-plugins`: publish a `@lapis-notes/markdown` release containing the
  outline a11y fix and the LN-MD-104 post-processor bridge (commit
  `e410ffd4`). Until then the cohort tarball
  (`.local/validation/packages.json`) carries both, and hosted CI
  `test:storybook` against published `markdown@0.1.6` will fail on the
  outline `list` violation.
- `mira-mde`/theme: Mira numbered-code-block highlight color `#b85c15` on
  `#f6f7f8` measures 4.27:1 (WCAG AA needs 4.5). Panel stories avoid it by
  using source-mode context leaves; reading-mode documents still render it.
- `lapis-notes` api: no public accessor for the plugin dependency map and no
  host injects `@lapis-notes/notebook-local-package-versions`, so bare
  imports from host-provided packages inside cells stay inert (engine
  `localPackageVersions` receives an empty map; remote ESM descriptors
  work). A generic host contract would restore the legacy capability.
- `lapis-notes` api: `components/editor/extensions/class-highlighter` is
  internal; the port substitutes the standard lezer `classHighlighter`
  (same `cm-*` tag classes). Exporting the api copy would let the editor
  surfaces re-converge.

## Bundle follow-ups (not gates)

- Entry chunk is 16.6MB (sample datasets + vega/d3/Plot inlined), matching
  legacy bundle scale. Trimming datasets and splitting vega/d3/Plot into
  lazy chunks remain recorded follow-ups for the publication push.
- `dist/app.css` ships beside `main.mjs`; host CSS loading follows the
  distribution contract (the legacy package exported `./app.css` for
  workspace installs).

## Validation operating rule learned

`pnpm validation:all` snapshots the jj working copy at launch: only start it
from a quiescent committed state. Two earlier runs failed spec-first purely
because the snapshot caught mid-edit trees (runs `392646a9`, `cb00cbd9`);
the reruns from clean states passed (`012fe4e6`, `49be9b9a`, `b55a5e21`).
