# Notebook DuckDB Package Spec

Canonical rendered spec: [Notebook DuckDB Package](../../../spec/src/20-packages/notebook-duckdb/index.md).

## Purpose

`@lapis-notes/notebook-duckdb` owns shared DuckDB notebook contracts and pure query helpers that can be reused by notebook runtime hosts.

## Current Functionality

- Exposes `NotebookDuckDbRuntime`, `NotebookDuckDbRuntimeProvider`, and `NotebookDuckDbColumnDefinition` contracts.
- Exposes DuckDB query row/result types used by notebook runtime and table output paths.
- Normalizes DuckDB rows and query results into notebook table metadata.
- Maps DuckDB type names into notebook table column categories.
- Exposes DuckDB catalog and table-preview types used by inspector/runtime surfaces.
- Exposes pure helpers for normalizing information-schema table types and quoting DuckDB identifiers.
- Exposes `createNotebookDuckDbCatalog()` for building notebook catalog models from information-schema table/column rows and a host-provided row-count callback.
- Exposes pure catalog/preview SQL helpers, row-count normalization, preview-limit normalization, and `createNotebookDuckDbTablePreview()` for shaping table preview rows.
- Exposes `NotebookAppTablesSnapshot`, stable app-table column contracts, and `registerNotebookAppTablesSnapshot()` for registering app-derived notebook tables into any runtime-shaped registrar that can create JSON tables.
- Exposes `resolveNotebookVaultPath()` and `registerNotebookVaultFile()` for resolving notebook-relative vault paths with the shared stdlib path-normalization rules and registering either host-read file buffers or resolved native vault paths with a DuckDB runtime-shaped registrar.
- Exposes `createDuckDbSchemaSql()` and `createDuckDbJsonTableSql()` for product runtimes that need stable SQL for registering JSON-backed notebook tables.

## Boundary Rules

The current package does not instantiate DuckDB-Wasm, import DuckDB assets, collect app-table snapshots from the app API, read vault files directly, validate desktop vault roots, or import app/plugin runtime modules. Concrete browser/PWA service lifecycle remains in `@lapis-notes/notebook`, while asset URL resolution lives in `@lapis-notes/notebook-duckdb-assets`. Reusing the shared notebook-relative path normalization from `@lapis-notes/notebook-stdlib` is part of the current boundary so DuckDB file registration stays aligned with notebook file-helper behavior.
