# @lapis-notes/notebook-worker

Shared notebook worker transport package. It owns generic worker protocol shapes, main-thread and
worker-side request plumbing, host response wrappers, and worker eligibility helpers reused by the
notebook plugin.

## Common Scripts

```sh
pnpm --filter @lapis-notes/notebook-worker build
pnpm --filter @lapis-notes/notebook-worker check
pnpm --filter @lapis-notes/notebook-worker test
```

## References

- [Package spec](spec.md)
- [Canonical spec](../../../spec/src/20-packages/notebook-worker/index.md)
