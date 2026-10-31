# Notebook release qualification

The user's 2026-10-31 instruction authorizes pushing, merging and releasing
Notebook and its changed source owners, superseding the review-only pause.
Visual status stays pending; baselines are unchanged.

## Source and dependency scope

The execution, cancellation, input factories, cell presentation, System Guide,
reactive display, UUID persistence and Markdown embed slices are retained on
fetched main, including the merged parallel CI/Turbo work and dependency PR #4.
The replacement action updates are verified before Dependabot #2/#3 close.
Supporting Mira, Design Core and API releases remain separate owning-source
gates. Final registry-only qualification follows their actual npm publication.

## npm packaging regression

The original native prepack and publint pass, but the new exact
`node scripts/check-npm-package.mjs` audit fails once with 67 imports of
unpublished support packages in runtime JavaScript and declarations. The npm
entry still points at source-resolution output; that is not portable outside
the workspace.

Prepack now builds the inlined runtime and bundled declaration entry, keeping
type staging under ignored `.local` and publishing the compiled CSS/assets.
The root export uses the compiled entry. Both runtime and declaration private
import audits now pass. Bundle generation also fails once on an undeclared
Svelte import before the manifest's shared import inventory is completed.
Relative asset URLs and production defines preserve ordinary browser loading.

The package consumer installs the actual tarball into a clean npm project,
checks public declaration usage and kernel class identity, and opens fresh
development and production browsers. Its first attempt finds two esbuild
diagnostics because the fixture omits the host's existing `esnext` optimizer
target. The next finds invalid fixture cell syntax; it now uses the public
cell-template producer and parser together. No product assertion is removed.

The exact Docker `pnpm packages:pack` then passes the type usage and both cold
browser consumers, with errors/warnings retained through teardown. Report:
`lapis-notebook-run-0f1b0060-7b95-4820-9b0a-1f959dce7196`.
The actual tarball SHA-256 is
`748a6e6a93b97878376688a009f9b23fdc2b3f06720e9deaeb55b1dceebb80c0`.
This is preliminary package qualification, not a publication receipt.

The aggregate regression fails once (three passes) before the required package
consumer lane is wired into `validation:all`. The package-boundary and aggregate
targets then pass all six cases. CI runs the same consumer in its existing
parallel package job with the locked browser version.

The full preliminary `pnpm validation:all` passes all eight lanes: quality,
433 unit cases, build, publint, clean packed consumers, static Storybook,
all 47 interaction/accessibility stories and final specification checks.
Report: `lapis-notebook-run-71f67c7d-e255-4d62-8208-f56c12600766`.
This source run still uses the recorded checksum-verified dependency archives;
final released-cohort validation, hosted checks and verified publication remain
separate gates. Visual status remains pending; baselines are unchanged.

## Registry cohort admission

Design Core 0.7.2, Mira 0.1.3 and API 0.2.2 are published. Their protected
workflows verify installed packages. Registry integrity matches the approved
artifacts; independent npm signature/provenance verification also passes. API 0.2.2
retains its existing next channel. Notebook now requires their released
minimums and the compatible UI 0.1.5 / Workspace 0.3.1 cohort through registry
manifests and the existing singleton pins. The ignored archive projection is
disabled; final qualification uses an empty archive inventory.

Notebook main CI `41165576265` confirms signed Turbo remote caching enabled,
GitHub task-cache restoration from the build job, and unit/package cache hits.
Final feature CI and registry-only validation receipts follow separately.

The final frozen registry-only `pnpm validation:all` passes all eight lanes:
433 unit cases, builds/publint, both cold public npm consumers, static Storybook,
all 47 interaction/accessibility stories and specifications. Report:
`lapis-notebook-run-fa20c73f-ee6d-4278-97da-9a6bfbb1cdb1`. Its request has
no archives and its retained installed lock has no file dependency resolution.
The prior exact six packaging/aggregate cases pass at
`lapis-notebook-run-513a255d-50a0-4ca4-9092-68b4294129c5`; the exact
standalone package consumer passes at
`lapis-notebook-run-2ac00d62-1cbb-4354-8a14-0272d1ed4d96`, tarball SHA-256
`4cbb6b0534ac9e862399b4f6693c7f4a5968aeae871c9de4b9d0ae4a73462b66`.

API 0.2.2's release workflow `41174359801` succeeds from
`8f97e4babad0bac61244b1b8314b01abe242e9fa`. Independent clean npm signature
verification confirms its provenance with zero invalid or missing signatures.
Core 0.7.2 and Mira 0.1.3 retain their successful protected signature receipts.
All functional and accessibility failures are resolved; visual status remains
pending and baselines are unchanged. Hosted Notebook CI and initial publication
remain separate gates.

## Hosted resource regressions

PR #5 run `41176512435` passes image/build, quality, unit, static Storybook
and both panel shards. Its exact `pnpm packages:pack -- --already-built` job
fails once after the cold development consumer passes: the production Vite
child reaches the default 2 GiB V8 heap limit inside the bounded 7 GiB job.
A real Node subprocess regression under inherited `NODE_OPTIONS` reproduces
the insufficient heap (one failure). The production child alone now requests
4 GiB old space; the test retains an unrelated Node condition and checks the
parent's options and heap limit are unchanged.

The full-shell shard also reports two 60-second timeouts, Input Types and
Input Types Mobile (27 other shell cases pass). Exact reproduction now uses
two CPUs and 7 GiB, matching hosted CI. Those assertions and timeout remain
unchanged while the slow work is diagnosed. Local qualification under the
earlier four-CPU / 12 GiB budget does not waive these hosted failures.

The two exact input stories pass locally at the original two-CPU / 7 GiB cap
(35.8 and 28.7 seconds; report
`lapis-notebook-run-d08874d7-aa7d-4150-bdde-8ccd989eaf06`). GitHub documents
four CPUs and 16 GB for public `ubuntu-latest`; this public repository now
uses those four standard CPUs while retaining its 7 GiB memory / 2 GiB shared
memory bounds. No paid runner is selected. A workflow regression first records
one failure / three passes for the old cap; the final configuration must pass
the same target plus the unchanged input plays and full browser lane.

The resource targets now pass all five cases (`scripts/ci.test.mjs` and
`scripts/package-consumer-build.test.mjs`). The unchanged exact input plays
pass at four CPUs / 7 GiB in a fresh worker: desktop 33.1 seconds, mobile
27.4 seconds, report
`lapis-notebook-run-89f83d38-cefa-48d6-9433-0fd31d1fd1cd`. QMD indexing,
search and doctor pass; the documented portable script aliases remain intact.

## Runtime story extraction

The bounded full run exposes caught `Meta is not a function` mount errors
in the three panel families. The installed CSF 5 `defineMeta` returns only
`Story`; their obsolete `<Meta />` aborts runtime story extraction before
collecting play functions. The earlier reported 18 passing panel cases are
therefore invalid evidence. A new guard regression records one failure / six
passes before caught extraction errors join fatal diagnostics. Ordinary
expected notebook diagnostics continue to be forwarded unchanged.

The panel sources must use the documented CSF 5 declaration, and the exact
browser target must fail with the obsolete source before passing its actual
placement interactions. Complete interaction/axe and qualification lanes must
then rerun with the stricter guard. Baselines and assertions remain unchanged.

With the stricter guard and unchanged Dependencies panel source,
`LAPIS_NOTEBOOK_VALIDATION_RUNTIME=native pnpm test:storybook --
src/stories/panels/DependenciesPanels.stories.svelte` records one failure /
five empty passes. The caught extraction error retains its original stack.
All three panel families now destructure only `Story` from `defineMeta` and
omit the obsolete component, matching the installed addon's public API.

The repaired Dependencies extraction runs real interactions: five placements
pass and Right Sidebar fails once because the production graph's Horizontal
Tree and Vertical Tree labels are reversed relative to their handlers. Correct
those labels in the owning panel; preserve the settings assertion and timeout.

The exact Dependencies file now passes all six actual placement interactions,
including graph switching and persisted horizontal orientation (16.4 seconds,
4.95 seconds in plays), with the stricter console guard and unchanged settings
assertion. The prior extraction-error case took only 0.48 seconds in empty
cases. The guard unit regression now passes all seven cases.

All three panel families now pass all 18 actual placement interactions and
accessibility checks in one fresh native browser process (30.0 seconds,
12.92 seconds in plays), with no extraction errors. The exact Dependencies
regression moves from one failure / five passes to six passes; the stricter
guard regression moves from one failure / six passes to seven passes.
A final bounded Docker aggregate now replaces earlier panel qualification.

## Final bounded qualification

`pnpm validation:all` passes all eight lanes at four CPUs / 7 GiB memory /
2 GiB shared memory in a fresh Docker checkout. Report:
`lapis-notebook-run-0aa15130-495d-4a05-929e-c0d8b749ebca`. Quality reports
zero Svelte errors/warnings; all 436 unit cases pass; builds, publint and
private-import audits pass; both cold public npm consumers and public types
pass; static Storybook and all 47 actual interaction/accessibility stories
pass; final specification and App ownership checks pass. There are zero caught
story-extraction errors. Input Types completes in 32.2 seconds and mobile in
31.1 seconds under their unchanged 60-second limit.

The retained request has an empty archive inventory and the structurally parsed
installed lock has zero file dependency resolutions. The final runtime tarball
SHA-256 is `0202c384718bec6f96a607b6d3a89c20f714ff85641c98d02d361eefaff9e67e`.
Visual status stays pending and no baselines changed. Hosted PR checks and npm
publication remain separate gates.

## Live polling performance

Hosted run `41179552482` passes every lane except the two unchanged Input Types
60-second cases (27 other shell plays pass). Both time out before initial
execution returns, so increasing CPU capacity alone does not resolve them.
The exact public package command now passes both cold consumers, and its
restored build reports one local Turbo hit / zero executed build tasks. Signed
remote caching is enabled.

Cell polling reparses the entire notebook and updates the session graph twice
per cell. Scheduled cells poll every 150 ms, multiplying parsing and graph
analysis while the initial 54-cell run is still active. The two exact source
regressions first record two failures / 23 passes. The render service now owns
a weak cache keyed by the actual file, source text, path and normalized
metadata. Session polling retains the immutable cached snapshot's graph and
cell state. Source edits with unchanged mtime, in-place metadata edits, renames
and replacement files invalidate the snapshot. Live progress/output polling
and all existing story assertions/timeouts remain intact.

The exact two source files now pass all 25 cases (two failures before, zero
after). The unchanged exact browser selector passes in a fresh four-CPU /
7 GiB worker: Input Types 23.0 seconds and mobile 18.6 seconds. Report:
`lapis-notebook-run-aae9a3df-f173-4294-afd9-c3a5d77bd20b`. Status, inspector
and dependency refresh paths also load through this owned render service.
The full aggregate and hosted shell shard must requalify this runtime change.

The bounded full run `lapis-notebook-run-011c51c1-9a09-4f04-8efb-8f04bc774add`
passes quality, all 438 unit cases, build, publint, both cold npm consumers,
static Storybook and all 47 interaction/accessibility cases. Input Types and
mobile finish in 23.9 and 23.8 seconds. The final specification lane alone
fails once because mapped source changes also require the canonical Notebook
index chapter, in addition to runtime.md. Add that chapter's reuse/invalidation
summary without changing implementation, then rerun the exact specification
lane. The public consumer tarball SHA-256 is
`f02149eabfd5994f19f772121e1137f2dea538f459e20181184e186855db0ff5`.

The exact Docker `pnpm spec:check` rerun passes after the documentation-only
chapter correction, report
`lapis-notebook-run-e147a92c-585e-419f-8901-b081734e64d6`. QMD index and doctor
pass. Together with the unchanged implementation lanes from `011c51c1`, all
eight required lanes are green: 438 unit cases, two cold consumers, static
Storybook, 47 actual interaction/accessibility stories and specifications.
The installed graph remains registry-only with no archives or file resolutions.
Visual status stays pending and baselines are unchanged.

## Public vault-copy regression before publication

Merged-main CI `41181600305` exposes two remaining shell failures: desktop
checks checkbox output before its async rerun completes; mobile reaches the
60-second deadline after the initial run consumes 37 seconds. All other lanes
pass. Publication stays paused even though PR CI passed. npm login is now valid.

The owning API deliberately returns `file.copy()` from `getFileByPath`; a
weak cache keyed by wrapper identity misses these ordinary reads. A source
regression using public `TFile.copy()` records one failure / 15 passes. The
cache now keys stable path, source, normalized metadata and creation time,
with bounded retention. Copied wrappers reuse parsing; changed creation time
represents replacement. The earlier same-object fixture is strengthened to
model actual replacement, rather than treating a wrapper copy as replacement.

The checkbox play now awaits its actual completed `[]` result, as its existing
button play does, then retains the original DOM assertion. Assertions and the
60-second story limit remain unchanged. The complete shared-helper story suite
and source lanes must requalify before the release draft is finalized.

The corrected public-copy boundary passes all 26 focused cases. The unchanged
input catalogs pass at 14.9 seconds desktop / 11.3 seconds mobile in a fresh
four-CPU / 7 GiB worker, report
`lapis-notebook-run-67d93014-00ba-417a-ba73-8632f9b0acb0`. The runtime and
DOM checkbox assertions both remain required. Full qualification follows.

The final corrected `pnpm validation:all` passes all eight lanes, report
`lapis-notebook-run-e4844ad9-2166-4026-b0c3-4a4811cc9661`: quality, 439 unit
cases, build, publint, both cold public npm consumers, static Storybook, all
47 interaction/accessibility cases and specifications. The source uses no
dependency archives or file resolutions. Its qualified consumer tarball SHA-256
is `346a29751a19a0c2fc3b415e0e686c9712b956ea8648f21b40f9066af352c8e6`.
The SDK-copy regression and the runtime-completion/DOM assertions are retained.
Visual status stays pending and baselines are unchanged. The initial 0.1.0
release artifact will be rebuilt from the corrected merged source.
