# Notebook canvas cohort release preparation

The integrated UI was approved on 31 October 2026. Local qualification is in
progress. This record authorizes no push, merge, registry publication or signing.

| Owner           | Proposed release | Reason                                                                                                     |
| --------------- | ---------------- | ---------------------------------------------------------------------------------------------------------- |
| Design Core     | 0.9.0 minor      | Public rich table composition, selection scope and custom filter validation                                |
| Notes API       | 0.2.4 patch      | Public renderer build adapter, module admission and dependency compatibility; retain existing plugin peers |
| Notes UI        | 0.1.6 patch      | Core dependency compatibility                                                                              |
| Notes Workspace | 0.3.2 patch      | Core dependency compatibility                                                                              |
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
after separate authorization, refresh all affected consumers to the released
registry ranges, and run the final registry-only matrix and supported-host
acceptance. Candidate package versions and peer warnings are explicitly
temporary; no publishable file/link/archive dependencies were introduced.
