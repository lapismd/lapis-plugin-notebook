# Local validation

The portable root pnpm commands default to Docker. A missing fingerprinted
image is built automatically. Docker errors fail the command without a host
fallback. The routing audit rejects every unclassified root script, so a future
test cannot silently bypass this policy.

```sh
pnpm validation:doctor
pnpm validation:images
pnpm validation:check
pnpm validation:smoke
pnpm validation:all
pnpm check
pnpm test
pnpm build
pnpm spec:check
pnpm test:storybook -- src/stories/PluginWorkspace.stories.svelte
```

Every worker receives the exact tracked Jujutsu snapshot and ancestry. It
receives neither ignored configuration/secrets nor host node_modules, source
mounts or a Docker socket. Registry installs use the frozen lockfile and ignore
local pnpm hooks. The image pins its base/toolchain identities and installs
Chromium for the exact Playwright version in the lockfile. Browser tests use
one worker and three fresh sequential shards by default. Explicit file,
test-name and shard arguments stay literal. The image retains the pinned Rust
toolchain for the planned native services crate; no native lane is registered
yet, and the routing audit rejects unregistered lanes.

`validation:all` runs existing check, test, build, publint, static Storybook,
complete catalog and specification lanes sequentially in one worker, snapshot
and installation. It stops at the original first failure; individual commands
and exact selectors remain available. It accepts no selectors of its own.

Image identity covers the actual recipe, tool installer, selected pnpm,
Playwright, Rust toolchain and architecture. Unrelated script/dependency changes
do not rebuild it. The pnpm cache separately keys the lockfile and verified
archive identities. Rust cache identity covers its recipe/toolchain, Cargo
manifest/lock (empty until a crate lands) and architecture, so a UI dependency
refresh does not discard compiled Rust artifacts. Reports retain both cache
identities.

Workers run under Docker's init process and drop all Linux capabilities. The
smoke lane proves that a denied-directory write fails and that the Node worker
is not PID 1, before exercising real headless Chromium. This keeps permission
and subprocess cleanup checks representative of an ordinary application.

## Run on another machine

Docker on this Mac still uses this Mac's resources. To offload work, configure
a Docker context and ignored `.local/validation/config.json`:

```json
{
  "context": "linux-builder",
  "transport": "ssh-cli",
  "cpus": 4,
  "memoryGiB": 12,
  "shmGiB": 2
}
```

Omit `transport` for the ordinary Docker context transport. The `ssh-cli` mode
streams build context, source and reports through the context's SSH endpoint;
no local filesystem path must exist remotely. A per-checkout remote lease
prevents overlapping workers. The limits above are also the default limits.
`LAPIS_NOTEBOOK_VALIDATION_CONTEXT` overrides the selected context.

For intentional host diagnosis, select it explicitly:

```sh
LAPIS_NOTEBOOK_VALIDATION_RUNTIME=native pnpm validation:check
```

Interactive `pnpm storybook`, stop/restart and validation bootstrap commands
remain native. Native execution is never a Docker error-recovery mechanism.
Hosted CI uses the digest-pinned Lapis CI job container directly, with the
explicit native execution port inside that container as the checkout uid (1001),
with a writable temporary Corepack/browser cache. Local commands keep their
Docker default. The image/build stage is followed by parallel quality, unit,
package lint, static Storybook and three browser-shard jobs, then the stable
`Validation lanes` aggregate. All jobs must succeed, including every shard.

The shared CI setup installs once per job with frozen registry resolution and
caches the container pnpm store. Turbo caches root build/check/test tasks and
includes all private support-package sources in their inputs. Build cache hits
restore the complete `dist` tree. GitHub Actions persists task results between
jobs and runs; signed remote cache uses the same organization/repository
`TURBO_API`, `TURBO_TEAM`, `TURBO_TOKEN` and
`TURBO_REMOTE_CACHE_SIGNATURE_KEY` settings as Lapis Plugins. If those settings
are unavailable (including fork PRs), normal execution and the GitHub task cache
remain enabled. Per-job summaries distinguish local hits, remote hits and
executed tasks. Specification checks, smoke tests and browser interaction/axe
always execute. Browser jobs install Chromium through the locked Playwright
provider and cache its files separately. CI no longer asks setup-node to cache
a host pnpm directory that never receives dependencies.

## Outputs, archives and cleanup

Reports and available build outputs are collected under
`.local/validation/runs/<run>/`. Each report records source/parent identities,
image inputs, tools, resources, exact arguments, status and combined logs.
`installed-lock.yaml` retains the actual installed graph, including temporary
archive resolution, separately from the unchanged tracked registry lockfile.
Docker `build` produces Linux artifacts in that report; it does not update the
host `dist` directory. Host npm package lifecycle commands require the explicit
native override, preventing a host pack from silently consuming stale output.
This does not authorize npm publication.

Each lane starts from a fresh source checkout. Standalone `pnpm publint` builds
the Svelte package before checking it; it cannot assume a previous worker's
`dist` directory exists.

Registry-only installation is the default. For explicitly documented temporary
source qualification, `LAPIS_NOTEBOOK_VALIDATION_ARCHIVES` may name a JSON array of
`{name, version, path, sha256}` archives. Checksums and package identities are
verified. Only the isolated installation projection changes; tracked manifests
and the lockfile are restored before checks, and archive provenance is retained
in the report.

Passed containers are removed after collection; failures remain inspectable.
An active worker or failed remote-state query retains its checkout lease.
Lease removal uses its container ID, so an older caller cannot remove a
successor's lease. Cleanup accepts exited/dead workers, not preparing or paused
ones. It releases an owned lease only after collection and proof that its named
run finished with no active owned worker. A lease with no completion evidence
remains for inspection.
Use `pnpm validation -- collect <run>` to retry collection.
`pnpm validation:clean` previews stopped runs owned by this checkout;
`pnpm validation:clean -- --apply` collects and removes those runs. It never
prunes global Docker data or removes another checkout's containers.

## Story composition

`stories/catalog/story-parity.json` declares every executable family as
application, component, integration or prototype coverage. The guard follows
CSF-Svelte default components and selected templates through rendered imports.
Application stories need exactly one public `WorkspaceShell`; component stories
name their real public or source-owned subject. Missing/stale declarations,
unused imports, replacement roots, private presentation overrides and
unisolated synthetic controls fail checks. Other CSF formats fail closed until
explicitly supported.

`src/stories/FixtureControls.svelte` visibly separates setup actions with a label,
padding and dotted border. Application fixtures use its overlay placement;
focused components may use inline placement. Its children contain native setup
controls rather than hidden production components. Functional, accessibility
and visual approval remain separate; this tooling does not approve baselines.

The browser setup installs a fatal Svelte diagnostic guard before story hooks.
It forwards console warnings/errors and fails Svelte runtime diagnostics during
mount, interaction and teardown. The wrapper records origin stacks without
throwing through framework cleanup; post-test and post-file assertions make
every retained diagnostic fatal. No suppression or allowlist is permitted.
