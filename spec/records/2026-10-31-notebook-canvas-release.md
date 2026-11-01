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
