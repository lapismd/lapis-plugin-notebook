# @lapis-notes/notebook-core

Shared notebook contracts package. It owns reusable notebook protocol types and pure output helpers
that do not depend on the bundled notebook plugin, Svelte views, DuckDB-Wasm, workers, or
`@lapis-notes/api`.

## Common Scripts

```sh
pnpm --filter @lapis-notes/notebook-core build
pnpm --filter @lapis-notes/notebook-core check
pnpm --filter @lapis-notes/notebook-core test
```

## References

- [Package spec](spec.md)
- [Canonical spec](../../../spec/src/20-packages/notebook-core/index.md)
