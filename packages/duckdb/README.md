# @lapis-notes/notebook-duckdb

Shared DuckDB-facing notebook contracts. This package owns reusable runtime interfaces, query and
catalog result types, app-table and vault-file registration contracts, DuckDB type mapping, and
small pure helpers used by the notebook plugin.

## Common Scripts

```sh
pnpm --filter @lapis-notes/notebook-duckdb build
pnpm --filter @lapis-notes/notebook-duckdb check
pnpm --filter @lapis-notes/notebook-duckdb test
```

## References

- [Package spec](spec.md)
- [Canonical spec](../../../spec/src/20-packages/notebook-duckdb/index.md)
