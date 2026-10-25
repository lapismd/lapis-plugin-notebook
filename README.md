# Notebook for Lapis

`@lapis-notes/lapis-plugin-notebook` is the first-party external Notebook
plugin for Lapis. It ports the legacy `@lapis-notes/notebook` plugin:
executable `.notebook.md` Markdown documents with reactive cells, rich
outputs, interactive inputs, and DuckDB queries. The package Storybook
includes a real Lapis workspace that loads the plugin.

The runtime plugin ID is `lapis-notebook`.

The port is staged per `spec/src/plugins/notebook/`: document model and plugin
skeleton first, then cell rendering, TypeScript/Markdown execution with
generated-state persistence, inputs, DuckDB-WASM, and the panel/package
surfaces. Verification statuses in `spec/src/verification.md` track exactly
which stage has landed.

## Development

Published LapisMD dependencies resolve through npm semver ranges. Package
manifests must stay portable and contain no machine-specific dependency ranges.

```sh
pnpm install
pnpm spec:check
pnpm check
pnpm test
pnpm build
pnpm test:storybook
pnpm build-storybook
```

Package Storybook defaults to port 7040. Portable lanes default to the
fail-closed Docker runner; see `docs/validation.md` for remote contexts and
reports.

### Refreshing local development dependencies

When the sibling repositories are present, `.pnpmfile.cjs` installs local
package snapshots for development acceptance. These snapshots need refreshing
after sibling source or public exports change. If Storybook reports missing
files that exist in the owning repository, stop it and refresh the snapshots:

```sh
pnpm storybook:stop
pnpm install --lockfile=false --force
pnpm test
pnpm test:storybook
pnpm storybook
```

This temporary local validation setup leaves the registry lockfile unchanged.
Validate releases and CI against the published registry dependencies.

### Batched browser acceptance

`pnpm test:storybook` runs the Storybook Vitest project in sequential shards,
each with a fresh browser process and one worker, mirroring the Tasks
mitigation for intermittent orchestrator transport drops. Keep the unbatched
command available for diagnosis.

The preview inherits DM Sans Variable and Source Code Pro Variable from Design
Core, matching the Lapis hosts.
