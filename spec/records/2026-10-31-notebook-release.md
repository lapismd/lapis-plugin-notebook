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
