# Notebook provenance

The plugin runtime, private support packages, fixtures, and regression tests
are copied from `legacy-lapis-notes` `packages/notebook` (including its
`core`, `stdlib`, `input`, `duckdb`, `duckdb-assets`, and `worker`
sub-packages) and adapted onto the current public `@lapis-notes/api`,
`@lapismd/design-core`, and `@lapis-notes/markdown` exports. The 2026-10-25
legacy source audit revision is `8ec68e18`.

The repository scaffold (validation runner, Storybook shell harness, spec
gates, and CI) is copied from `lapis-plugin-tasks` and renamed. Copied
component names, notebook-owned BEM classes, and `--notebook-*` variables are
retained for visual comparison with the legacy plugin; legacy
`@lapis-notes/ui` primitive imports are remapped to Design Core rather than
forked. The legacy Electron native-DuckDB sidecar provider is excluded; the
provider seam is retained per `spec/src/plugins/notebook/runtime.md`.
