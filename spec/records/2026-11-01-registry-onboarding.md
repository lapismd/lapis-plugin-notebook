# Notebook registry onboarding — 1 November 2026

The prepared patch is 0.2.1. Existing v0.2.0 and v0.1.0 releases are immutable;
this change does not replace their npm packages, tags or assets. Root source
metadata, changelog, licence, deterministic installable packaging and the
release/manual workflow prepare the next approved release for the registry's
one-file submission queue. Registry merges and publication remain maintainer-owned.

## Qualification

- `pnpm test -- scripts/registry-onboarding.test.mjs`: the original narrow
  regression starts with two missing-file failures and finishes with two passes.
- `pnpm registry:check`: 22 passes across archive, sender, source admission,
  pagination/latest CI result, retained assets, dry-run, trust/coordinate/hash/tag
  rejection, media paths/order and pinned vendor provenance checks.
- `pnpm test:storybook -- src/stories/RegistryScreenshots.stories.svelte`:
  two interaction/axe passes. New fixture setup initially produced two failures;
  the corrected App-owned document opening passes. A clock-spy instrumentation
  recursion produced two failures; an uninstrumented scoped fixture clock and
  its teardown restoration pass. No runtime warnings are suppressed.
- `pnpm validation:all`: passed in Docker run
  `lapis-notebook-run-05e35094-0823-491b-9ec9-9f8ee015841e`: check, specification,
  App ownership, 535 unit tests, build/publint, npm pack, cold development and
  production public npm consumers, static Storybook, all 69 interaction/axe
  cases in three fresh batches, media verification and archive preparation.
- Final copy-only media refinement uses the normal capture command; all 16
  declared assets are regenerated and rechecked through `registry:media:check`.
  Preview cards were inspected for clipping. This creates no Visual Delta baseline.
- Full and production `pnpm audit` exit zero after patched Storybook 10.6.5,
  Vitest 4.1.12, Vite 6.4.5, Sharp 0.35.5 and KaTeX >=0.18.2. The sole admitted
  development advisory is the explicitly approved Tasks-equivalent exception
  for deepmerge/GHSA-gcqx-w48m-w2h4; its removal condition is in governance.
- spec-validator 0.2.0 is the latest Deno-free release. Node 24 QMD index/search
  and doctor run natively. Doctor has ten passes and the expected warning for
  governed Docker script aliases; QMD is not added to CI or Docker lanes.
- Workflow actionlint passes after excluding only its stale metadata diagnostics
  about create-github-app-token v3's `client-id`. The actual upstream v3
  `action.yml` was checked: `client-id` is supported and `app-id` is deprecated.

## Registry receiver acceptance

The actual prepared archive was signed with a disposable acceptance-only key
and passed `verifyReleaseBundle` plus the complete pinned-source metadata/media
reader from plugin-registry main
`0f3b61317a6e1331b6e6c600560cc36fa7587de8`. The verifier files are unchanged
between that revision and the checked-out verifier. This supplementary native
diagnostic verifies 34 signed files and a 25,385,250-byte test archive. Its key
and archive are temporary; no production key, trust change, upload or dispatch
is used. CI rebuilds and signs from the actual admitted release tag.

## Media and release boundaries

Captures use the same Visual Delta 0.0.7 browser engine and unmodified compositor
as lapis-plugins: fixed owned Storybook IDs, real WorkspaceShell, 1200x800 at 2x,
Lapis light/dark, Inter copy, diagonal split, and preview/full/light/dark variants.
The compositor's SHA-256 is
`adb5e891846522f8cc916bd2a774e3ee922f2712cf7c50dceaf22d4452dff5b9`, identical to
lapis-plugins main `f1b8823d3f1ce8e238a61f529d0fb5c66deabb43` when inspected.
The full-shell accessibility policy is shared with existing functional stories;
its existing rules are unchanged. Human visual approval stays pending.

Before a live run, review/land the source, configure the protected
registry-production environment and existing approved signing/App secrets, and
explicitly enable REGISTRY_PUBLICATION_APPROVED. Publish matching npm and stable
GitHub release v0.2.1. The sender verifies actual published bytes and the tag,
then dispatches their signed source commit. Manual dry runs do not sign, upload
or dispatch. Submission/publication PR merges stay maintainer-controlled.
