# @lapis-notes/notebook-duckdb-assets

DuckDB asset resolver package for browser and PWA notebook runtimes. It separates raw DuckDB-Wasm
and worker URL ownership from the notebook product plugin while leaving runtime lifecycle and query
execution in `@lapis-notes/notebook`.

## Common Scripts

```sh
pnpm --filter @lapis-notes/notebook-duckdb-assets build
pnpm --filter @lapis-notes/notebook-duckdb-assets check
pnpm --filter @lapis-notes/notebook-duckdb-assets test
```

## References

- [Package spec](spec.md)
- [Canonical spec](../../../spec/src/20-packages/notebook-duckdb-assets/index.md)
