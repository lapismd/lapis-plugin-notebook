# Action dependency consolidation

The 2026-10-31 pre-push query identifies two open Notebook Dependabot PRs:
checkout v7 (#2) and setup-node v7 (#3). This dependency-only candidate applies
both updates across the CI and catalog workflows and leaves runtime packages,
the registry lockfile, parallel stages and Turbo behavior unchanged.

The candidate starts from fetched main `e5e7ee21`. Existing CI/routing/specification
regressions and hosted pipeline checks qualify the action intake before merge.
The original PRs are closed only after the consolidated replacement is verified
and merged; no update is silently omitted.

The registry-only Docker `pnpm validation:check` passes all 32 CI, validation
routing and catalog-guard regressions, report
`lapis-notebook-run-75a867c7-6ddd-4deb-a7ee-cf93535758ad`.
`pnpm spec:check` passes all specification/book/mapping and App ownership gates,
report `lapis-notebook-run-5661f3ee-d8c0-4b23-96d7-cdc007a707fd`.
Hosted CI repeats the full pipeline before this dependency-only PR is merged.
