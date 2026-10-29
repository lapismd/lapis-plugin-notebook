# `@lapis-notes/lapis-plugin-notebook`

[![CI](https://github.com/lapismd/lapis-plugin-notebook/actions/workflows/ci.yml/badge.svg)](https://github.com/lapismd/lapis-plugin-notebook/actions/workflows/ci.yml)
[![Storybook Pages](https://github.com/lapismd/lapis-plugin-notebook/actions/workflows/publish-storybook-pages.yml/badge.svg)](https://github.com/lapismd/lapis-plugin-notebook/actions/workflows/publish-storybook-pages.yml)
[![Storybook](https://img.shields.io/badge/storybook-live-ff4785?logo=storybook&logoColor=white)](https://lapismd.github.io/lapis-plugin-notebook/)

First-party external Notebook plugin for Lapis. It ports the legacy
`@lapis-notes/notebook` plugin: executable `.notebook.md` Markdown documents
with reactive cells, rich outputs, interactive inputs, and DuckDB queries,
presented through public `@lapismd/design-core` surfaces inside the host
workspace.

The plugin owns notebook documents, execution, panels, and settings. Hosts
own routing, vault state, persistence, and application policy.

## Current package status

- Public package: `@lapis-notes/lapis-plugin-notebook@0.1.0` (release
  pending; the repository validates against published registry
  dependencies).
- Runtime plugin id: `lapis-notebook` (preserved from the legacy plugin so
  persisted plugin-data keys stay compatible).
- Runtime peers: `@lapis-notes/api@^0.2.0`, `@lapis-notes/markdown@^0.1.7`,
  `@lapismd/design-core@^0.7.0`, `svelte@^5`.
- Canonical repository: `lapismd/lapis-plugin-notebook`.
- Live catalog: <https://lapismd.github.io/lapis-plugin-notebook/>.
- The port is staged per `spec/src/plugins/notebook/`; verification
  statuses in `spec/src/verification.md` track exactly which stage has
  landed.

## Install

Hosts load the plugin class through the Lapis plugin lifecycle; `onload`
registers the notebook editor view, commands, settings tab, and panels.

```sh
pnpm add @lapis-notes/lapis-plugin-notebook
```

Import the plugin stylesheet once at the application boundary:

```ts
import "@lapis-notes/lapis-plugin-notebook/styles.css";
```

## Runtime surfaces

| Surface           | Entry                                                          | Use for                                                                                    |
| ----------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Notebook view     | `*.notebook.md` exclusive editor-view contribution             | Cell rendering, source/preview modes, run-all header action, inline editors                |
| Execution         | Shared engine with Web Worker transport and in-process fallback | TypeScript/JavaScript, SQL, and Markdown/HTML cells with dependency-graph ordering         |
| Inputs            | `packages/input` DOM runtime on Design Core primitives         | `viewof` text/table/range and every UI-backed input factory with targeted reruns           |
| DuckDB            | `packages/duckdb` on pinned DuckDB-WASM                        | SQL cells over app snapshot tables (`lapis.notes`, `lapis.links`, `lapis.search_documents`) |
| Panels            | Variables, Dependencies, and Packages right-sidebar views      | Data-source inspection, dependency graphs, and npm package management                      |
| Default grouping  | `Notebook` sidebar group seeded from layout state              | One right-sidebar group presenting Variables, Dependencies, and Packages together          |
| Settings          | Versioned plugin data plus settings tab                        | Execution, autorun, and panel auto-open policy                                             |

## Cell and output coverage

Cells execute through one shared engine reachable over two transports: a
dedicated module Web Worker for eligible notebooks and an in-process
fallback for notebooks that need DuckDB, live DOM outputs, or host-only
providers. Reactivity is Lapis-owned and explicit — a marimo/Pluto-style
dependency graph reruns or marks stale descendants; there is no implicit
observer runtime. Generated outputs persist as typed generated state through
the host `appDatabase` notebook-state contract, shared by web, desktop, and
hosted Rust back ends.

## Styling contract

The plugin uses native CSS, Design Core semantic tokens, and notebook-owned
`notebook-` prefixed classes. Production sources stay free of Tailwind
utility strings (`pnpm check:no-tailwind`).

1. Import `@lapis-notes/lapis-plugin-notebook/styles.css` once.
2. Theme through Design Core tokens; the notebook layer rebinds public
   custom properties (editor surfaces, table previews, status palette) at
   its own boundaries.
3. Do not style private production selectors to make a story or host look
   correct.

Status tones use a static AA-contrast palette with `.dark` overrides;
section anatomy paints grey full-bleed headers over white bodies.

## Layout conventions

```text
src/
  lib/            plugin class, settings, views, render layer, panels, styles
  stories/        App-backed shell stories, panel placement stories, demos
packages/
  notebook-core/  host-neutral document model, graph, and stdlib
  notebook-stdlib/
  notebook-input/ lazy DOM input runtime
  notebook-duckdb/
  notebook-duckdb-assets/
  notebook-worker/ transport-only worker entry
spec/
  src/            canonical specification (mdBook)
  records/        slice and acceptance records
stories/
  catalog/        story parity and taxonomy declarations
```

Private support packages keep host-neutrality boundaries (LN-NB-027) and
resolve from TypeScript source through shared Vite/tsconfig plumbing, so the
published root manifest stays free of `workspace:` dependencies.

## Usage example

A notebook document is ordinary Markdown with `:::cell` directives:

````markdown
---
notebook.autorun: true
---

:::cell lang="ts" id="calc"
const answer = 6 * 7;
display(`The answer is ${answer}.`);
:::

:::cell lang="sql" id="query"
SELECT count(*) AS note_count FROM lapis.notes;
:::
````

Interactive inputs use `viewof` cells; dependencies rerun targeted
downstream cells on change.

## Storybook and local documentation

Run the local catalog (defaults to port 7040):

```sh
pnpm storybook
pnpm storybook:stop
pnpm storybook:restart
```

Build the static catalog:

```sh
pnpm build-storybook
```

The canonical specification lives in `spec/src`. Prefer QMD-backed search
for locating requirements and guidance, and keep the wiring healthy after
tooling updates:

```sh
pnpm spec:search -- "panel group"
pnpm spec:search -- "worker transport" --semantic
pnpm spec:index
pnpm exec spec-validator doctor
pnpm spec:check
```

### CI and local parity

Portable validation defaults to the fail-closed Docker runner
(`scripts/validation.mjs`); Docker failure never falls back to the host.
See `docs/validation.md` for contexts, reports, and owned cleanup. Native
diagnosis requires the explicit `LAPIS_NOTEBOOK_VALIDATION_RUNTIME=native`
override.

`pnpm test:storybook` runs the Storybook Vitest project in sequential
shards, each with a fresh browser process and one worker, mirroring the
Tasks mitigation for intermittent orchestrator transport drops. Keep the
unbatched command available for diagnosis.

CI runs the validation, specification, quality, unit, build, publint, and
Storybook interaction and static-build lanes on every pull request and push
to `main`, and publishes the static catalog to GitHub Pages from `main`.

### Refreshing local development dependencies

When the sibling repositories are present, `.pnpmfile.cjs` installs local
package snapshots for development acceptance. These snapshots need
refreshing after sibling source or public exports change. If Storybook
reports missing files that exist in the owning repository, stop it and
refresh the snapshots:

```sh
pnpm storybook:stop
pnpm install --lockfile=false --force
pnpm test
pnpm test:storybook
pnpm storybook
```

This temporary local validation setup leaves the registry lockfile
unchanged. Validate releases and CI against the published registry
dependencies.

The preview inherits DM Sans Variable and Source Code Pro Variable from
Design Core, matching the Lapis hosts.

## Release and validation

Common validation commands:

```sh
pnpm spec:first
pnpm spec:check
pnpm check
pnpm test
pnpm build
pnpm publint
pnpm test:storybook
pnpm build-storybook
pnpm validation:all
```

## Further reading

| Resource                                                                     | Use                                        |
| ---------------------------------------------------------------------------- | ------------------------------------------ |
| [`spec/src/plugins/notebook/index.md`](./spec/src/plugins/notebook/index.md) | Canonical plugin specification           |
| [`spec/src/plugins/notebook/runtime.md`](./spec/src/plugins/notebook/runtime.md) | Execution, panels, and settings runtime |
| [`spec/src/spec-governance.md`](./spec/src/spec-governance.md)               | Governance, validation, and discovery rules |
| [`spec/src/verification.md`](./spec/src/verification.md)                     | Requirement verification evidence          |
| [`docs/validation.md`](./docs/validation.md)                                 | Docker validation contexts and reports   |
| [`AGENTS.md`](./AGENTS.md)                                                   | Contributor and agent workflow             |
| [`PROVENANCE.md`](./PROVENANCE.md)                                           | Legacy port provenance and exclusions      |
