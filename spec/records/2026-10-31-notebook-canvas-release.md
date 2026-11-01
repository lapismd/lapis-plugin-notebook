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
