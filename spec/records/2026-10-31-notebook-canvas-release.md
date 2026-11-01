# Notebook canvas cohort release preparation

The integrated UI was approved on 31 October 2026. On 1 November the user
authorized watching, merging and releasing the four migration PRs as their
required checks complete. Publication retains each owner's protected workflow
and exact-source qualification gates.

| Owner           | Proposed release | Reason                                                                                                     |
| --------------- | ---------------- | ---------------------------------------------------------------------------------------------------------- |
| Design Core     | 0.9.0 minor      | Public rich table composition, selection scope and custom filter validation                                |
| Notes API       | 0.2.4 patch      | Public renderer build adapter, module admission and dependency compatibility; retain existing plugin peers |
| Notes UI        | 0.1.6 patch      | Core dependency compatibility                                                                              |
| Notes Workspace | 0.3.2 patch      | Core dependency compatibility                                                                              |
| File Explorer   | 0.2.1 patch      | Admit the shared Core release without installing a second older Core                                       |
| Markdown        | 0.2.1 patch      | Core dependency compatibility; no runtime changes                                                          |
| Notebook        | 0.2.0 proposed   | Shared result/input/preview tables and structured filters                                                  |

Version intents come from the owning Changesets and current package versions.
Notebook has no Changesets pipeline; keep package.json and manifest.json versions
in sync when its release is authorized. Recheck registry versions before acting.

1. Finish source checks and candidate consumers, including cold plugin loading.
   Do not mark registry qualification passed based on candidate archive receipts.
2. After separate delivery authorization, release Design Core through its normal
   Changesets/CI workflow. Keep its existing public Bits patch contract.
3. Refresh Notes API/UI/Workspace, private app-profile/Web/frozen desktop manifests
   and locks to the released Core range. Markdown admits that Core range while
   retaining existing supported ranges. Re-run owning cohort checks before release.
4. Release the compatible Notes and Markdown packages through their owner lanes.
   Verify npm provenance, signatures and registry metadata using owner commands.
5. Refresh Notebook's API, UI, Workspace, Markdown and Core development pins,
   runtime peer ranges and workspace overrides to the released registry cohort.
   Keep every tracked manifest/lock registry-portable.
6. Run registry-only `pnpm validation:all` plus cold packed-plugin acceptance in
   supported hosts. Retain exact source/package versions, hashes and failure counts.
7. Mark fully qualified only after the entire verification matrix passes.

Candidate qualification uses the ignored `.local/cohort-archives.json` inventory
inside checksum-verifying Docker workers. It must never become a publishable
dependency override or replace the final registry lane.

No visual comparisons or baseline updates are part of this delivery. Changed
stories remain visual-pending. Preserve the existing default workspaces and
Storybook processes, including port 10329.

Local source qualification is complete at Core a1f8f433, Notes aa723cf7 and
Markdown compatibility 3518932a, plus the Notebook checkpoint containing this
record. Notebook's complete candidate `validation:all` passed at receipt
lapis-notebook-run-7df6f350-1454-4f29-8ea1-8f93d9eeb6f9. The exact package consumer
also passed both cold modes with App/plugin teardown. Core's complete checks
passed and Notes' full normal Storybook retry passed after the retained browser
startup disconnect receipts. Do not replay failed runs as passes or publish the
old-version qualification archives.

Remaining work requires the release cohort: publish through owner workflows only
after successful exact-head qualification, refresh all affected consumers to the released
registry ranges, and run the final registry-only matrix and supported-host
acceptance. Candidate package versions and peer warnings are explicitly
temporary; no publishable file/link/archive dependencies were introduced.

## Release watch — 1 November 2026

| PR                  | Signed head | Observed CI disposition                                                                                                                  |
| ------------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Design Core #51     | 70457606    | Unit, interaction/accessibility, governance, static Storybook passed; remaining lanes running                                            |
| Notes #60           | b12c89c0    | Registry fixture/build-cache passed; two canonical mapping findings cancelled downstream jobs; documentation correction verified locally |
| Plugins #49         | 46f601ac    | Prerequisites/build-cache passed; downstream lanes running                                                                               |
| Notebook #7 (draft) | 397b9f95    | Build fails on released API missing rendererHostModulePlugin; wait for upstream releases, refresh registry pins and rerun                |

Workspace inventory: `.local/release-watch/2026-11-01/workspace-inventory.json`.
All noncandidate workspace work is excluded; the default checkouts and existing
Storybooks remain preserved. No open Dependabot PRs were found during initial
preflight; recheck before each push. Planned versions above require registry
existence checks, since latest dist-tags lag some already published host versions.
The File Explorer compatibility floor was discovered during cohort inspection
and must be included in the Notes owner before final registry qualification.

Resume in dependency order: merge qualified Core #51; qualify/merge its version
PR and verify 0.9.0 publication; refresh Notes and Markdown to that registry
release; qualify/merge/release those owners; refresh and version Notebook;
complete registry-only validation and cold packed-host acceptance before merging
and publishing Notebook. Do not rerun Notebook's unchanged known failing head.

### Core feature merged — 1 November, 00:16 UTC

Core #51 exact head `7045760617b39fbd7d1d886c181e389a1d42a239` passed all
11 CI jobs at run `41254765867`, including dependency audits and Validate;
0 failing, cancelled or skipped required lanes. GitHub reported CLEAN before
the exact-head merge. Merge source: `b426f97541aabed3a95b6c038aa1cdf4ba559224`.
Automatic release/version workflow `41256032414` has started; 0.9.0 has not
been published yet. Plugins #49's initial CI `41254770785` also passed its
aggregate, but its Core 0.9 range refresh still precedes merge/release.
Notes corrected-head run `41255428727` passed governance, unit, quality,
static Storybook and release artifacts; browser lanes were still running.

The user additionally requested default checkout refresh after every merge.
Core's default workspace now has a clean empty change on merged remote main
`b426f975`; the previous snapshot remains recoverable. Fetch the other owners
and update their default checkouts after landing, preserving unrelated changes.
Notes' active overlapping session work remains untouched. Core version PR #52
is prepared for 0.9.0 at `047b9fdc`; normal CI `41256135610` was triggered by
human reopen after its initial bot run failed before executing jobs.

### Core version merged — 1 November, 00:47 UTC

Version PR #52 exact head `047b9fdcb3e343c70832cbe3e4a0c0b05da5d2de`
passed all 11 required jobs at CI `41256135610`; 0 failures. The exact-head
merge produced `a31e02a7eb8a96f9d1df6b4caf6fd39352780b44`. Publication is
pending its normal protected release workflow, not yet claimed complete.
Preflight refreshed remote main, found no Dependabot PRs, and inspected all 23
Core workspaces without snapshotting active work. Receipt:
`.local/release-watch/2026-11-01/core-version-preflight-0046.json`.
Nine roots were unavailable; all unrelated work remains excluded and preserved.

Core's default checkout now has active, unrelated Button/Storybook edits on
the feature-merged source. Remote main is fetched, but updating its working-copy
parent to the version merge is deferred to avoid rewriting an active owner's
work. The existing checkout is preserved; refresh it after a safe checkpoint.

### Core 0.9 released — 1 November, 01:01 UTC

Release workflow `41258271966` completed all five jobs, including trusted npm
publication, clean installed-package integrity/provenance and GitHub tag/release.
Published source: `a31e02a7eb8a96f9d1df6b4caf6fd39352780b44`.
Registry integrity: `sha512-xIqcgSbzrUnSxRtTmfi5DsUyjgbi3ggiW3UNgHhdED9YfT8SSRayTIVZD78nMvzJxl7MgKRepwrhgovsqskjjg==`.
Release: https://github.com/lapismd/design-core/releases/tag/design-core%400.9.0.

Notes' eight manifests and registry lock now target/admit published Core 0.9.0,
preserving supported public ranges. Focused spec-first/validation, formatting
and Docker package policies/100 release tests passed (0 failures). Notes #60
new signed head `30437df70725ea71973b0e8724ab11e6bd0c55b9` is in full CI
`41259587797`. This includes the Explorer compatibility patch intent.
Markdown's 0.9 range/catalog intake is prepared locally but waits for Notes'
API/UI/Workspace/Explorer registry patches to remove temporary Core peer
mismatches before its final CI. No newly mismatched graph will be published.

### Notes feature merged — 1 November, 01:23 UTC

Notes #60 exact head `30437df70725ea71973b0e8724ab11e6bd0c55b9` passed
all ten required CI jobs at run `41259587797`, including web acceptance,
Storybook interaction/accessibility and Validate; 0 failures. GitHub reported
CLEAN before merging. Merge source: `8b08baccb133a18ae644b6b8a3c7d23a81e897bc`.
The normal release/version workflow `41260873808` is queued to prepare the
version PR. None of the new Notes versions is claimed published yet.

Remote main was fetched after merge. Notes' default checkout still has active
overlapping session/startup/dependency edits (`mlwtkxom`); its working-copy
parent remains preserved. Complete that checkout refresh after a safe owner
checkpoint rather than rewriting ongoing work. No unrelated image-pin PR was
merged as part of this feature.

### Notes version merged — 1 November, 01:44 UTC

Version PR #61 exact head `7945bceb7def9f377520c6d3ae587aad31b75cba`
passed every required job at CI `41261229317`, 0 failures. Reviewed scope:
API 0.2.4, UI 0.1.6, Workspace 0.3.2 and File Explorer 0.2.1, matching internal
ranges, changelogs, generated API version metadata and four lock specifiers.
Merge source: `ff088a423a939fe3c08406aebbe95c795f290f47`.

Preflight inspected all 11 registered Notes workspaces without snapshotting,
preserved three unrelated dirty workspaces, and found no Dependabot PRs. None
of the four new versions was already published. Receipt:
`.local/release-watch/2026-11-01/notes-version-preflight-0143.json`.
Remote main was fetched; active default-workspace edits remain preserved.

Dispatched the normal `release.yml` with `publish=true` on exact versioned main:
run `41262301909`. The redundant nonpublishing push workflow `41262288942`
was cancelled after confirming the replacement's identical source SHA; its
cancellation is not a validation pass. The publishing workflow retains the
complete required validation and protected npm gate. Publication/verification
remain pending; approve only its eligible cohort deployment after those checks.

### Notes registry cohort released — 1 November, 02:06 UTC

Run `41262301909` passed full release-candidate validation and publication.
The first verification job failed once while npm was still processing
Workspace 0.3.2 (`ERR_PNPM_NO_MATCHING_VERSION` after its existing bounded
retries). After all four versions became visible, reran only failed jobs;
attempt 2 passed registry installation, integrity/provenance and GitHub releases.
No source change, retry-policy increase, republish or assertion waiver occurred.
All four releases are now verified from `ff088a423a939fe3c08406aebbe95c795f290f47`:
API 0.2.4, UI 0.1.6, Workspace 0.3.2 and File Explorer 0.2.1 (existing next-tag
policy retained). The original failed receipt remains part of the record.

Markdown's final registry graph now uses these packages and Core 0.9.0;
the two temporary Core peer warnings are gone. Focused isolated Docker checks
passed strict checking/build/publint, 154 units, package metadata/boundaries,
App/native CSS/story parity and audit (only its unchanged two ignored lows).
Specifications and formatting passed; refreshed PR #49 goes through full CI
before merge. No CSV or other plugin runtime file changed.

### Plugins strict compatibility regression repaired

CI `41263868277` failed quality with one History settings-page type error;
all other applicable lanes passed. History still declared Core 0.7.4 while
the refreshed API used 0.9, producing incompatible nominal controller types.
Exact Docker `pnpm check -- --filter=@lapis-notes/history` reproduced 1 error,
then passed 0 errors/0 warnings after a portable History dependency-range repair.
The owning build/check/test lane passed 23 Vitest + 96 repository tests = 119,
0 failures. Specifications, audit and formatting passed. History runtime source,
native services, CSV and other plugin behavior remain unchanged.

The repair has an independent History patch Changeset; its publication remains
separate from the selected Markdown release. Updated PR #49 describes the final
scope and is pushed at `bb3a6a4526a7eb5826b2b8763d18c61142248ea5`; full CI
`41265025659` must pass before merge. Retain the original failure receipt and
the exact before/after Docker receipts in the Plugins compatibility record.

### Plugins compatibility merged — 1 November, 02:35 UTC

PR #49 exact head `bb3a6a4526a7eb5826b2b8763d18c61142248ea5` passed all
required lanes at CI `41265025659` (13 successful jobs, 0 failures; the normal
optional specification job was skipped, with source specification checks already
passed as recorded). GitHub reported CLEAN before the exact-head merge.
Merge source: `edefb28f0c126c7bdbb5777782886b9095528540`.

Fetched remote main and updated the clean default Plugins workspace to that
merged source, preserving its prior named snapshot. Existing unrelated local
bookmark conflicts were not rewritten. Normal version workflow `41265857176`
is preparing the Changesets PR. Expect Markdown 0.2.1 plus the separate History
0.2.1 metadata intent; publication remains selected for Markdown only.

### Plugin version merged and scoped release started — 02:52 UTC

Version PR #50 exact head `b6e43b7492fc733f2e7106f16c1d8c4ec3867915`
passed full CI `41266192666` (0 failing applicable jobs). Reviewed scope was
the two expected 0.2.1 versions and matching manifests/README/changelogs;
no extra bumps or lock churn. Merge source:
`f1b8823d3f1ce8e238a61f529d0fb5c66deabb43`.
Preflight found no Dependabot PRs, inspected all nine workspaces without
snapshotting, and preserved one unrelated dirty release workspace. Receipt:
`.local/release-watch/2026-11-01/plugins-version-preflight-0251.json`.

Fetched main and updated the clean default Plugins checkout to the versioned
source. Dispatched normal static `release.yml` run `41266913507` on that exact
main SHA, with Markdown true and every other plugin, including History, false;
asset replacement false. Inputs are retained in ignored
`markdown-021-release-inputs.json`. First CLI dispatch failed before creating
a run because gh requires string input values; corrected that representation
and the exact scoped dispatch succeeded. No publication or asset replacement
occurred from the failed invocation. Protected release gates remain intact;
Markdown publication/verification are pending and History is not selected.

### Markdown released and registry intake merged — 1 November

Scoped static workflow `41266913507` passed from
`f1b8823d3f1ce8e238a61f529d0fb5c66deabb43`, selecting only Markdown.
`@lapis-notes/markdown@0.2.1` is published with integrity
`sha512-/G7S3fHWE+NJEdMSB6KCGEhbgB/bSpeJ9SkOaMYIRZ3q7ELuCvDfhO1rdRIE2J5VA8GJY0g69G7n7nCQrZugCA==`.
The owner `verifiedPublishedCoordinates` helper independently verified the
6,001,101-byte archive, checksum, Ed25519 signature, signed file list, package
coordinates and tag-to-source commit. GitHub release:
<https://github.com/lapismd/lapis-plugins/releases/tag/markdown%400.2.1>.
History 0.2.1 remains versioned but unpublished and outside the selection.

Registry intake PR #58 added only `submissions/markdown/0.2.1.jsonc`; exact
head `479bd5c781a5bfde441f5057a8d3ccf13bc25035` passed checks
`41269152825` and merged as `d97e63faf188634bbeb293b05d1844d807bf8338`.
Registry publication PR #55 contains unrelated PDF entries; it is outside this
cohort and must not be merged without separate scope authorization.

### Final Notebook registry refresh started

Package and runtime manifest advance together to 0.2.0. Runtime peer minimums
are API 0.2.4, Markdown 0.2.1, UI 0.1.6 and Core 0.9.0. The development host
cohort additionally pins Workspace 0.3.2 and File Explorer 0.2.1. Existing
Search 0.1.4, Mira 0.1.3, CodeMirror/Lezer and renderer Svelte 5.56.10 remain.
Registry-only lock regeneration passed without peer warnings. No runtime
behavior, typed row, selection, lifecycle, persistence or wire-format change.

Latest Deno-free validator remains 0.2.0. `pnpm exec spec-validator doctor`
passed 10 checks with the expected Docker wrapper script-alias warning;
`pnpm spec:search "canvas table released registry cohort"` and `pnpm spec:index`
passed. An earlier literal `--` search invocation was rejected before search;
the supported invocation passed. `pnpm validation:all` now runs through Docker
with registry-only installs and no candidate archives; final results pending.

The first aggregate attempt, `lapis-notebook-run-ee35c0be-b491-49c0-8d7d-02278d9ea7af`,
stopped before installation/checks because the preserved remote 10529 review
worker holds this checkout's lease. No worker or lease was removed. The supported
Docker Desktop `desktop-linux` daemon is available independently, so the same
registry-only aggregate was restarted there through the normal Docker runner.
This is a Docker transport change in ignored local configuration, with no native
fallback, tracked runner change or review-process interruption.

Docker Desktop run `lapis-notebook-run-fae81592-1227-4e04-b236-b8035a55468a`
passed full strict checking (0 errors/0 warnings), routing/story/App/CSS audits,
specification validation and all 510 units in 88 files. It then failed during
bundle chunk rendering: Docker inspect confirms `OOMKilled: true` and a Docker
OOM event. The Desktop VM provides about 3 GiB; no product diagnostic preceded
the resource kill. Later aggregate lanes did not run and are not counted passed.

Created an independent JJ qualification checkout under this authorized root at
`.local/release-watch/2026-11-01/registry-qualification`, with its own checkout
lease and immutable source snapshot. Its normal `pnpm validation:all` uses the
remote omarchy Docker daemon, without disturbing the review checkout or changing
global Docker capacity. No checks, resource assertions or runner policy changed.

The first nested-checkout attempt stopped before checks when the parent
working-copy documentation update rebased its empty child, making the checkout
stale during image selection. The source refresh is committed before updating
the qualification checkout and retrying; no running check is counted as a pass.

### Isolated registry qualification evidence

Committed refresh `4225a758401b7d9ec7f4de80a2cc9bbcb6133412` is under test
through its identical-tree empty qualification child `13814341d67f348f98e4d2926948635e0916ad23`.
Remote report: `lapis-notebook-run-e1b6953b-6e19-477e-bafa-c83ecfa6e11f`.
Full strict checks and 510 units passed, as did build, publint, public declaration
usage and both cold development/production npm consumers with real App/plugin
load and teardown. The packed tarball SHA-256 was
`6a88c5d7dff151260f4209a5dd768f3fe93f4f32a2bc5305b5a3348ce4be49d3`;
its `candidateArchives` list was empty. Static Storybook also passed.
All 67 interaction/axe stories passed across three fresh shards (18 + 18 + 31),
and final specification/mdBook/spec-first/App checks passed. The complete eight-lane
`pnpm validation:all` finished successfully at 03:51:36 UTC on 1 November.
No candidate archives or local dependency resolutions were used.

The disposable npm consumer install reported 11 advisories (10 low, 1 high).
Its temporary directory was removed after successful acceptance before an audit
capture could be made. A separate read-only worker `pnpm audit --json` of the
tracked frozen graph reports 3 low, 6 moderate, 3 high and 2 critical advisories.
Repeating that exact audit against the pre-refresh `397b9f95` package/workspace/lock
files in a separate worker temporary directory gives identical advisory IDs,
versions and counts. Full receipts are retained as ignored
`notebook-registry-audit.json` and `notebook-baseline-audit.json`.

The high/critical findings are unchanged development tooling: Vite 6.4.3
(GHSA-587h-7wmj-h5pm; patched 6.4.4) and Storybook/addon-vitest 10.5.7
(GHSA-f2ph-cmg5-wxc8 and GHSA-px85-f4q5-jh77; patched 10.6.2).
Notebook owns that separate toolchain follow-up. This is not an audit pass,
CVE ignore or baseline approval; no audit policy, dependency script approval,
assertion, diagnostic guard or running review server was changed. The standard
Notebook qualification lanes have no audit gate; their results remain separately
reported from this additional diagnostic.

Push preflight inspected all seven live Notebook workspaces without snapshotting
other owners and found no open Dependabot PRs. Historical/unrelated work remains
excluded and preserved; the nested qualification checkout is an identical-tree
copy of the selected source. Receipt:
`.local/release-watch/2026-11-01/notebook-registry-preflight.json`.
Full GitHub CI on the final signed head remains mandatory before merge.

Final canonical verification/receipt edits passed formatter, QMD index refresh
and Docker `pnpm spec:check`, report
`lapis-notebook-run-9724d63b-5023-4eeb-b5ec-cd8c219559bd` (specification,
mdBook, spec-first, story/routing and App audit passed). No product suite was
repeated for those documentation-only edits.
