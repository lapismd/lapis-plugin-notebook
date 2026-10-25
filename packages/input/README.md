# @lapis-notes/notebook-input

Host-neutral input helpers for the notebook runtime. The package owns the Observable-style `viewof`
source transform, tracked wrappers over the stdlib DOM helper surface, DOM input node binding, and
callback-driven view runtime helpers used by the notebook plugin.

## Common Scripts

```sh
pnpm --filter @lapis-notes/notebook-input build
pnpm --filter @lapis-notes/notebook-input check
pnpm --filter @lapis-notes/notebook-input test
```

## References

- [Package spec](spec.md)
- [Canonical spec](../../../spec/src/20-packages/notebook-inputs/index.md)
