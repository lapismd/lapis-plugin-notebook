# 2026-10-25 — Stage 0 scaffold and Stage 1 support-package port

## What landed

- Standalone repository scaffold copied from `lapis-plugin-tasks` (Docker-first
  validation runner, spec-first gates, Storybook supervisor on port 7040,
  parity/taxonomy/routing audits, fatal Svelte console guard, CI workflow) and
  renamed to `@lapis-notes/lapis-plugin-notebook`, runtime id `lapis-notebook`.
- Canonical specification: `spec/src` with governance (LPN-SPEC), plugin
  identity (LN-NB-001–005), documents (LN-NB-010–014), and runtime
  (LN-NB-020–028) chapters plus Storybook mirrors and verification table.
- Stage 0 plugin skeleton: `NotebookPlugin` loading through the public host
  lifecycle, and the App-backed `Plugins/Notebook/Shell` story copied from the
  Tasks harness (`PluginWorkspaceDemo`, compatibility lease, memory vault) with
  `.notebook.md` fixtures.
- Stage 1 support packages copied verbatim from `legacy-lapis-notes`
  `packages/notebook/{core,stdlib,input,duckdb,duckdb-assets,worker}` at
  revision `8ec68e18` with their 29 test files, spec.md/README provenance docs,
  and self-contained tsconfigs.

## Adaptations from the legacy/donor sources

- Sub-package manifests: dropped monorepo scripts and devDependencies (root
  lanes drive tests/typechecks); `@lapis-notes/ui` peer moved from
  `workspace:*` to registry `^0.1.3`; internal links stay `workspace:*`
  (private members); `@duckdb/duckdb-wasm` stays pinned `1.33.1-dev45.0`.
- Root `tsconfig.app.json` includes `packages/*/src` so `check:svelte` covers
  support packages; `tsconfig.pack.json` keeps packing only `src/lib`.
- Browser-batch shard count clamps to the discovered story-file count
  (LPN-SPEC-015 update) so a single-story catalog runs one unsharded batch.
- Removed the Tasks native-crate lanes; the Docker image retains the Rust
  toolchain for the planned Stage 8 services crate. `cacheKeys` tolerates
  absent Cargo manifests.
- `jj config set --repo snapshot.max-new-file-size 10107918` so the three
  legacy sample datasets over 1 MiB (diamonds, olympians, pizza) stay in the
  tracked snapshot and reach Docker workers. Dataset trimming is deferred to
  the Stage 5 inputs/stdlib slice.
- Tracked lockfile generated with `pnpm install --lockfile-only
  --ignore-pnpmfile` (registry-pure); local development reinstalls through
  `.pnpmfile.cjs` with `--lockfile=false` per the documented temporary local
  validation setup.
- `bits-ui`, `@lezer/common`, and `@lezer/markdown` added as devDependencies
  for Storybook shell resolution (Tasks ships them as runtime deps; they move
  to dependencies when ported runtime source imports them).

## Duplicate kernel-instance finding (Docker gate)

The first Docker `validation:all` failed `check:svelte` with two errors:
`App`/`PluginConstructor` from two materialized `@lapis-notes/api@0.1.4`
instances were nominally incompatible (private `unloaders` declarations).
Cause: published `api@0.1.4` declares `@lapismd/design-core ^0.3.2` and
`@lapismd/mira ~0.0.3` peers while the family pins `0.6.0`/`0.1.1`; the root
importer resolves the newer pins (unmet-peer warning) while nested
`workspace@0.2.1`/`file-explorer@0.1.2` contexts auto-install design-core
0.3.5, splitting the api peer suffix. Local `.pnpmfile.cjs` source links
converge everything and mask the split; only the registry-pure Docker install
exposes it.

Reproduced identically in a pristine registry install of `lapis-plugin-tasks`
at its currently tracked state (same two errors, instances `f8139fe…` vs
`41dffb2…`); Tasks' last green Docker `check` (16:42) predates its 18:38
lockfile refresh. Reported to the user as a family finding with owner
`lapis-plugin-tasks` (same override fix) and root cause in the next
`@lapis-notes/api` release's peer ranges.

Fix (LPN-SPEC-005 extension): workspace overrides converge
`@lapismd/design-core` `0.6.0`, `@lapismd/mira` `0.1.1`, and
`@lapis-notes/ui` `0.1.3` so one api instance serves typecheck and runtime.
Verified: lockfile shows a single `api@0.1.4(83433a6…)` suffix; pristine
`pnpm install --frozen-lockfile --ignore-pnpmfile` + `svelte-check` = 0
errors 0 warnings.

## Validation (native override `LAPIS_NOTEBOOK_VALIDATION_RUNTIME=native`)

Before/after failure counts: every lane started red only where noted and ended
green; no pre-existing failures were inherited (new repository).

| Lane | Result |
| --- | --- |
| `pnpm validation:check` | 2 files / 29 tests passed |
| `pnpm test` (unit project) | 36 files / 130 tests passed (29 legacy sub-package test files + ownership audit + 6 script tests) |
| `pnpm check:validation-routing` | 20 lanes, 0 findings |
| `pnpm check:storybook-parity` | 1 family, 0 findings |
| `pnpm check:no-tailwind` | clean |
| `pnpm check:types` | clean |
| `pnpm check:svelte` | 0 errors, 0 warnings |
| `pnpm spec:validate` | 9 validators, 6 chapters, 38 requirements |
| `pnpm spec:check` | passed |
| `pnpm build` (svelte-package + publint) | All good |
| `pnpm test:storybook` | 1 file / 1 test passed (`Plugins/Notebook/Shell` → Workspace) |
| `pnpm build-storybook` | static build succeeded |
| `node scripts/validation.mjs doctor` | remote daemon reachable via `omarchy` SSH context |

Docker `validation:all` on the remote worker is the authoritative gate and is
recorded separately once complete.
