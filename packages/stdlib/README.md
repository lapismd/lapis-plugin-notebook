# @lapis-notes/notebook-stdlib

Shared contract and helper package for notebook builtins. It owns the builtin registry contracts,
documented bare global names, dependency-global validation, vault and DOM helper implementations,
and the bootstrap that assembles bundled stdlib bindings for notebook execution.

## Common Scripts

```sh
pnpm --filter @lapis-notes/notebook-stdlib build
pnpm --filter @lapis-notes/notebook-stdlib check
pnpm --filter @lapis-notes/notebook-stdlib test
```

## References

- [Package spec](spec.md)
- [Canonical spec](../../../spec/src/20-packages/notebook-stdlib/index.md)
