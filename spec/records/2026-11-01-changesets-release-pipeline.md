# Notebook automatic Changesets releases — 1 November 2026

Notebook previously had CI and registry submission but no Changesets configuration,
version PR workflow or npm publisher. The exact focused command
`pnpm test -- scripts/release-pipeline.test.mjs` first reproduced two failures.
The final exact regression finishes with four passes after artifact-upload,
main-only dispatch and canonical-version guard hardening.

## Implementation

Main pushes automatically open or update the Changesets version PR through the
same Changesets 1.8.0 action and GitHub API commit mode as lapis-plugins. Only the
public root package is versioned. Version generation synchronizes the runtime
manifest and canonical version; the spec-validator configuration reads the root
version. Private support packages remain unpublished and unversioned.

After the version PR merges, all existing CI lanes qualify the exact npm tarball
and source. Pending Changesets and published versions skip publication. A main-only
npm-production environment requires stevejuma approval. The publisher uses OIDC
trusted publishing with npm provenance, checks downloaded bytes and a clean frozen
consumer, then creates the matching immutable GitHub release. CI completion feeds
the existing registry submission workflow. Main runs do not cancel an approved
publisher in progress. No production release or registry submission is performed
by local validation.

## Executed qualification

- `pnpm validation:all` passed in Docker run
  `lapis-notebook-run-091ff85d-ecea-4b35-8c5a-ee7d959d1052`: complete check/spec
  and App ownership, 548 unit tests, build/publint, cold development and production
  public npm consumers, static Storybook, all 69 interaction/axe cases (13/19/37),
  22 registry cases, all 16 deterministic media variants, registry preparation and
  the new npm release artifact preparation.
- The qualified local npm test artifact contains 40 files and is about 24.1 MB
  compressed. Its source and SHA-512 integrity are retained in candidate.json.
  It is validation evidence only, not an approved production artifact.
- Release regressions use the actual Changesets CLI to bump a fixture from 0.2.1
  to 0.2.2 while preserving a private package at 0.0.0. They reject stale sources,
  changed bytes, temporary dependency archives, path traversal, missing public
  entries, non-registry dependencies, missing provenance and foreign publication
  contexts. The final workflow/canonical guard runs are separate from the
  548-test full snapshot.
- Final focused helper/CI/aggregate checks passed all 17 cases. Final canonical
  specification checking, actionlint, the pending-Changesets publication hold
  and Node 24 QMD discovery also passed.
- Full and production audits passed. The existing approved development-only
  deepmerge/GHSA-gcqx-w48m-w2h4 exception is unchanged; no advisory is added.
- Actionlint passed for both modified workflows. New handwritten JavaScript
  remains below 300 lines per file. No visual baseline or committed media changes.
- Spec-validator 0.2.0 is the latest Deno-free release. Node 24 QMD index/search
  and doctor run natively; doctor reports ten passes and the existing intentional
  Docker-alias warning. QMD remains outside Docker and CI.

## Rollout

The npm-production environment now allows only main and requires stevejuma review.
The npm trusted publisher must bind this package to lapismd/lapis-plugin-notebook,
ci.yml and npm-production; its account-level configuration requires npm 2FA.
No long-lived npm token is introduced. The already-configured registry-production
key/App gate remains separate. The first generated version PR targets 0.2.2,
since main already contains the unpublished 0.2.1 preparation. Merging a version
PR and approving publication remain maintainer actions.
