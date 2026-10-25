# Notebook DuckDB Assets Package Spec

Canonical rendered spec: [Notebook DuckDB Assets Package](../../../spec/src/20-packages/notebook-duckdb-assets/index.md).

## Purpose

`@lapis-notes/notebook-duckdb-assets` owns DuckDB-Wasm and DuckDB worker asset URL resolution for browser/PWA notebook runtimes.

## Current Functionality

- Imports the DuckDB-Wasm MVP and exception-handling wasm modules as Vite asset URLs.
- Imports the matching DuckDB browser worker bundles as Vite asset URLs.
- Exposes `getNotebookDuckDbBundles()` so the notebook DuckDB service can call `duckdb.selectBundle()` without owning raw asset imports.

## Boundary Rules

The package owns asset location and bundle mapping only. It must not instantiate DuckDB, register vault files, query data, load app tables, or import product-plugin runtime modules. Future desktop or offline hosts can replace or extend this resolver behind the same contract.
