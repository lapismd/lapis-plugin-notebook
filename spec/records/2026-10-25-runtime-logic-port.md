# 2026-10-25 — Runtime logic port and cohort markdown refresh

## Stage 2 Docker gate

The authoritative Docker `validation:all` for the Stage 2 revision
(`68bc670f`) passed end-to-end on the remote `omarchy` worker: run
`lapis-notebook-run-121dd86d-caf4-4097-b893-559e5ca683e6`. An earlier Stage 2
attempt (`lapis-notebook-run-62564290…`) failed `check:types` on the resolver
script's untyped `.mjs` form; the TypeScript rewrite was squashed into the
Stage 2 commit before the green run.

## Upstream bridge (lapis-plugins)

The Stage 3 prerequisite landed source-first in `lapis-plugins` commit
`e410ffd478e6510956f292a69e4c5a0ef6197fb5`: `resolveRegisteredMarkdownMiraExtensions`
now bridges the API global `registerMarkdownPostProcessor` registry into
every Mira Markdown surface with the identical adapted context contract
(LN-MD-104 amended). Empty registries keep prior behavior byte-identical.

The cohort `@lapis-notes/markdown@0.1.6` archive in
`.local/validation/packages.json` was rebuilt from that commit
(`.local/validation/packages/lapis-notes-markdown-0.1.6.tgz`, sha256
`382c7884…`, dist verified to contain the bridge) so Docker acceptance runs
against the fixed source while tracked manifests and the registry lockfile
stay unchanged.

## Runtime logic port

`src/lib/runtime/` and `src/lib/output/` were copied verbatim from legacy
`packages/notebook/src/lib` (36 files): analysis (ts/sql/md/runtime-features),
graph, session (826 lines) and session manager, runtime controller, generic
runtime registry, status, output store, interpolation, execution host and
signal, the shared worker engine (`notebook-worker.ts`, 1,638 lines), worker
client with transport-eligibility policy, runtime protocol and worker entry
(`?worker&url`), the DuckDB-WASM service with app-table/vault-file
registration, and the plugin runtime-asset resolver. Nine legacy test files
came along; the Electron native-DuckDB provider and its test are excluded
(provider seam retained per LN-NB-025). `@duckdb/duckdb-wasm` is pinned
exactly at `1.33.1-dev45.0` in root dependencies per LPN-SPEC-004.

No source adaptation was required: `svelte-check` passed 0/0 over the ported
tree against the current public `@lapis-notes/api` surface (EventDispatcher,
AppDatabase notebook-state types, structural plugin-asset-server typing,
optional safe-mode access).

## Validation

- `svelte-check`: 0 errors, 0 warnings (src + packages).
- Unit lane: 52 files / 227 tests passed (was 43 / 156; +9 ported runtime
  suites, +71 tests).
- LN-NB-014 flipped to Implemented; runtime chapter records the port and the
  remaining wiring boundary.
