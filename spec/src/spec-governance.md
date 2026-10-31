# Specification Governance

Prepack builds the complete npm runtime, declaration and stylesheet entries;
the private type staging tree is never published. Registry Rollup declaration
tooling remains development-only. The package boundary audit rejects private
support-package imports, and bundle emission audits shared import declarations.

Notebook's CI and catalog workflows use `actions/checkout@v7`; catalog Node
setup uses `actions/setup-node@v7`. The Node 24 CI container, frozen installs,
parallel stages, Turbo caching and blocking aggregate remain governed by
LPN-SPEC-021. Both open action updates are consolidated into one dependency PR.

Tracked dependencies use registry Design Core `0.7.2` and Mira `0.1.3`, with
the published Lapis host cohort at `@lapis-notes/api@0.2.2`,
`@lapis-notes/ui@0.1.5`, `@lapis-notes/workspace@0.3.1`,
`@lapis-notes/file-explorer@0.2.0`, `@lapis-notes/markdown@0.2.0`, and
`@lapis-notes/search@0.1.4`. Explicit temporary source acceptance follows
LPN-SPEC-014 with verified sibling archives in isolated worker installations;
publication and consumer adoption remain separate gates. Source ownership and
public contracts remain unchanged. Shared specification tooling resolves the
Deno-free `@lapismd/spec-validator@0.2.0` from npm; QMD-backed specification
search uses the spec-validator-pinned system `qmd` binary (LPN-SPEC-020).

The Storybook catalog declares `@observablehq/plot@0.6.17`, `d3@7.9.0` and
`htl@0.3.1` as development dependencies, matching the private stdlib's existing
versions. Their bare import IDs are explicitly prebundled so Plot's transitive
CommonJS modules receive Vite interop before the System Guide executes. This
catalog setup preserves lazy runtime imports and registry-only lock resolution;
it does not add a new runtime library or change a published host contract.

## Requirements

The complete input catalog consumes registry `mrmime@^2.0.1` in the private
input package for vault MIME inference and accept matching. It is inlined in
the plugin bundle; manifests and lockfiles remain registry portable. Source
qualification may retain the documented verified host archives under LPN-SPEC-014.

| ID           | Requirement                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| LPN-SPEC-001 | `spec/src` MUST remain the canonical standalone specification and MUST build with mdBook.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| LPN-SPEC-002 | Protected package, manifest, source, sub-package, Storybook, validation, and CI changes MUST update an owning canonical chapter in the same Jujutsu change. Host plugin-class registration is specified in LN-NB-002 and does not move governance ownership.                                                                                                                                                                                                                                                                                                                                                                                 |
| LPN-SPEC-003 | Every normative requirement ID MUST be unique and MUST have exactly one verification row with concrete evidence.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| LPN-SPEC-004 | Published package manifests MUST use portable semver ranges and MUST NOT contain `workspace:`, `link:`, `file:`, or machine-specific dependency paths. Registry packages MAY be added when the notebook document model, render layer, or runtime needs them. DuckDB-WASM execution MUST pin `@duckdb/duckdb-wasm` exactly so engine behavior cannot drift independently from its compatibility tests.                                                                                                                                                                                                                                        |
| LPN-SPEC-005 | Published LapisMD dependencies MUST resolve through npm semver ranges. Local package source or artifacts MAY replace matching install dependencies through `.pnpmfile.cjs` only when those paths exist; absent local paths and CI MUST retain registry resolution. External repositories MUST NOT become workspace members or mutate dependency `node_modules`. Workspace overrides MUST pin the CodeMirror and Lezer packages used by Storybook shell hosts and MUST converge the published API peer graph (`@lapismd/design-core`, `@lapismd/mira`, `@lapis-notes/ui`) onto one instance so typecheck and runtime observe a single kernel. |
| LPN-SPEC-006 | Package Storybook MUST expose checkout-owned `storybook`, `storybook:stop`, and `storybook:restart` commands. They MUST default to port 7040, honour `.env.storybook.local`, reuse one supervisor per checkout, refuse to replace a listener owned by another checkout, apply exactly one Svelte transform pipeline to package and linked-source modules in both the dev server and browser-test project, and synchronously apply the selected preview theme before story play functions run.                                                                                                                                                |
| LPN-SPEC-007 | Tracked agent guidance MUST require explicit or context-owned App access, restrict `globalThis.app`, and require the package ownership audit for App-related changes.                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| LPN-SPEC-008 | Repository validation MUST reject story titles outside the `Plugins/Notebook/*` taxonomy.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| LPN-SPEC-009 | Repository validation MUST compare every SUMMARY chapter with an exact metadata-only Storybook mirror and MUST keep those mirrors as Storybook's first section in SUMMARY order.                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| LPN-SPEC-011 | Tracked agent guidance MUST require preserving unrelated work, committing every independently verified change with Jujutsu without waiting for another request, and using a PR-quality message that explains what changed, why it changed, and which validation passed.                                                                                                                                                                                                                                                                                                                                                                      |
| LPN-SPEC-012 | Every executable Storybook family MUST declare application, component, integration or prototype coverage. The guard MUST follow its selected CSF-Svelte render path through actual imports. Application coverage MUST reach exactly one public WorkspaceShell; focused component coverage MUST identify the real rendered subject. Missing or stale declarations, unused imports, replacement roots and private production presentation overrides MUST fail checks.                                                                                                                                                                          |
| LPN-SPEC-013 | Portable root validation commands MUST default to the fail-closed Docker runner and be registered in the lane inventory. Every other root script MUST match an explicitly reviewed native development or bootstrap exception. Docker errors MUST NOT trigger a host fallback. Intentional native diagnosis MUST require an explicit runtime override.                                                                                                                                                                                                                                                                                        |
| LPN-SPEC-014 | Local Docker validation MUST transfer the exact tracked Jujutsu revision and ancestry without ignored local state, host dependency/source mounts or a Docker socket. Registry installs MUST be frozen. Explicit temporary archive acceptance MUST verify package identity and checksum, restore tracked manifests and lockfiles before checks, and record archive provenance.                                                                                                                                                                                                                                                                |
| LPN-SPEC-015 | The Docker image MUST pin base and toolchain identities and install Chromium matching the locked Playwright version. Default browser acceptance MUST use sequential bounded shards and one worker, clamping the shard count to the discovered story-file count so a catalog smaller than the shard bound runs one unsharded batch. Explicit file, test-name and shard arguments MUST remain literal and MUST NOT be silently expanded into unrelated cases.                                                                                                                                                                                  |
| LPN-SPEC-016 | Synthetic story controls MUST use the visible padded dotted FixtureControls boundary. Application fixtures MUST use overlay placement outside production geometry; focused component stories MAY use inline placement. The boundary MUST NOT conceal production roots or dynamic component replacement. Functional acceptance MUST verify the visible boundary in an affected story.                                                                                                                                                                                                                                                         |
| LPN-SPEC-017 | Every local Docker worker MUST have finite CPU, memory and shared-memory limits and a per-checkout lease. Reports MUST retain source, image, tool, argument and outcome identities with available outputs and combined logs. Cleanup MUST collect reports before deleting stopped owned runs and MUST NOT prune global data or delete another checkout's containers.                                                                                                                                                                                                                                                                         |
| LPN-SPEC-018 | Browser acceptance MUST fail on Svelte runtime diagnostics from console warnings or errors, including mount, interaction and teardown. The guard MUST install before story hooks, retain original diagnostic stacks until post-test and post-file assertions without interrupting framework cleanup, and preserve console output without suppression or allowlisting.                                                                                                                                                                                                                                                                        |
| LPN-SPEC-019 | The classified validation:all command MUST execute the existing check, unit test, build, publint, clean public-package consumers, static Storybook, complete catalog and specification lanes sequentially within one Docker snapshot and dependency installation. It MUST preserve first-failure propagation, refuse aggregate selectors and retain every individual command and exact target.                                                                                                                                                                                                                                               |
| LPN-SPEC-020 | Specification discovery MUST be QMD-backed: a tracked `.qmd/index.yml` collection over `spec/src`, root `spec:index` and `spec:search` tasks kept as reviewed native development exceptions out of Docker lanes and CI, and `spec-validator doctor` verifying collection config, system binary, and native index health. Search MAY degrade to the printed `rg` fallback only when QMD is unavailable.                                                                                                                                                                                                                                       |
| LPN-SPEC-021 | Hosted CI MUST use a digest-pinned job container, frozen registry installation, parallel quality, unit, package, static-catalog and complete browser-shard jobs, and an always-running aggregate that fails on any failed, cancelled or skipped prerequisite. Turbo MUST cache root build/check/test tasks including private support-package sources, restore `dist` for consumers, sign remote artifacts when credentials are available, and execute normally with the GitHub Actions task-cache fallback when they are absent. Specification checks and browser interaction/accessibility MUST execute independently of task-cache hits.   |

Aggregate validation shares the outer worker's single lease, exact snapshot and
installation. Inner gates use the native execution port inside that worker;
they MUST NOT create nested workers or silently omit a gate. Reports retain the
actual installed pnpm graph separately from the tracked registry lock.

Specification discovery runs host-local: `pnpm spec:search -- "<topic>"`
queries the tracked `lapis-plugin-notebook-spec` QMD collection over
`spec/src` through the system `qmd` binary that spec-validator pins, and
`pnpm spec:index` rebuilds the local index after chapter edits. Both root
scripts are reviewed native development exceptions in the routing audit and
MUST NOT enter Docker lanes or CI. `spec-validator doctor` reports the
collection config, binary, and native-index health; agents prefer `spec:search`
over raw `rg` scans of `spec/src` and run `doctor` after tooling updates.

GitHub Actions mirrors the local gates in separate jobs. `image-pin` resolves
`.ci/images.json` to the same immutable Lapis CI base used by the local Docker
recipe. `build-cache` builds the package and audits its bundle, then quality,
unit tests, package lint, static Storybook and three interaction/accessibility
shards run in parallel. Jobs run as the checkout uid (1001), with writable temporary tool/browser
caches, init, dropped capabilities, finite resource limits and the explicit
native execution port inside that container, avoiding
nested Docker builds and repeated worker installations. Quality selects the
exact CI Jujutsu revision with full ancestry for uncached specification gates.
The stable `Validation lanes` aggregate runs even after prerequisite failure
and requires every job to succeed; skipped or cancelled jobs cannot pass it.

The composite setup caches the actual container pnpm store and `.turbo/cache`
with OS, architecture, image and lockfile identities. The build job primes
Turbo results for downstream jobs; job-specific save keys preserve quality and
unit results too. Root tasks hash private `packages/**` sources and restore
`dist/**` outputs. Remote cache uses the same `TURBO_API`, `TURBO_TEAM`,
`TURBO_TOKEN` and `TURBO_REMOTE_CACHE_SIGNATURE_KEY` settings as Lapis Plugins,
with signature verification enabled. Missing remote configuration retains
normal execution and the GitHub task cache. Run summaries report actual local
and remote hits. Specification checks, smoke tests and browser acceptance are
never skipped by Turbo. Chromium resolves through the locked browser provider,
with a separate image/lock-keyed browser installation cache.

`publish-storybook-pages.yml` builds the static catalog from `main` with a
frozen registry install whose pnpm hooks stay disabled
(`--frozen-lockfile --ignore-pnpmfile`, matching registry resolution per
LPN-SPEC-005), and deploys it to GitHub Pages as a publication pipeline outside
the validation lanes. Its Node/pnpm bootstrap and cache remain appropriate
because this publication job installs on the runner itself.
Dependabot maintains registry currency with weekly grouped pull requests
for the npm and GitHub Actions ecosystems; the exact `@duckdb/duckdb-wasm`
engine pin is excluded from automated updates because LPN-SPEC-004 keeps
engine bumps owned by the ported compatibility tests.

`spec-first` maps notebook document model, parser, and file-identity sources to
[Documents](plugins/notebook/documents.md); execution, commands, settings, and
private `packages/*` support-package sources to
[Runtime](plugins/notebook/runtime.md). Leftover package, manifest, plugin,
sub-package contract, and Storybook sources stay on
[Notebook](plugins/notebook/index.md).

Private sub-package specifiers resolve from TypeScript source through
`scripts/vite-notebook-packages.ts` (shared by the Vitest projects and the
Storybook Vite pipeline) plus matching tsconfig paths, keeping the published
root manifest free of `workspace:` dependencies per LN-NB-006. The
`build:bundle` lane compiles `src/bundle-entry.ts` into `dist/main.mjs` and
`dist/app.css` with the sub-packages inlined, copies the pinned DuckDB-WASM
engine assets into `dist/duckdb/`, mirrors `manifest.json` into `dist/`, and
runs `scripts/check-bundle-exclusions.mjs`, which fails on forbidden private
surfaces, missing inlining, missing externalization of host-shared modules,
missing engine assets, or a missing workspace runtime entry and
`network.connect` permission.

The six private support packages ported from the legacy notebook
(`notebook-core`, `notebook-stdlib`, `notebook-input`, `notebook-duckdb`,
`notebook-duckdb-assets`, `notebook-worker`) remain unpublished workspace
members. Their host-neutrality boundaries are specified in
[Runtime](plugins/notebook/runtime.md); a future native services crate needs
its own specification and lane intake before it lands. The root manifest peers `@lapismd/mira`
for the dependencies snippet's public `miraClassHighlighter` (token colors
scope to Mira's code-editor surface). `notebook-input`
peers onto `@lapismd/design-core` (its lazy UI runtime mounts Design Core
input/slider/switch/textarea primitives); support packages MUST NOT peer
onto retired legacy UI surfaces.

Every executable story file MUST stay registered in
`stories/catalog/story-parity.json` with its family kind; the four notebook
families are the App-backed shell acceptance and the three six-placement
panel suites, all recorded as `application` coverage of the public
WorkspaceShell. The tracked lockfile MUST be regenerated without local pnpm hooks
(`pnpm install --lockfile-only --ignore-pnpmfile`) so it stays registry-pure
and matches the Docker workers' frozen `--ignore-pnpmfile` installation;
local development then relinks sibling sources with
`pnpm install --lockfile=false`. A lockfile carrying pnpmfile checksums or
sibling `file:` specifiers fails the worker install fail-closed.
