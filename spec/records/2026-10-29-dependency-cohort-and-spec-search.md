# Dependency cohort bump, spec-validator 0.2.0 QMD search, and repository meta alignment

Date: 2026-10-29
Commits: `b372f0f7` (dependency cohort + QMD adoption), `1bb7c3ea` (README,
CI hygiene, Pages workflow, AGENTS guidance)

## Dependency cohort bump (`b372f0f7`)

Registry bumps to the latest published releases:

| Package                     | From    | To      | Surface        |
| --------------------------- | ------- | ------- | -------------- |
| `@lapismd/design-core`      | 0.6.0   | 0.7.0   | peer + dev     |
| `@lapismd/spec-validator`   | ^0.1.4  | ^0.2.0  | dev (tooling)  |
| `@lapismd/mira`             | 0.1.1   | 0.1.2   | dev            |
| `@lapis-notes/api`          | 0.1.4   | 0.2.0   | peer + dev     |
| `@lapis-notes/markdown`     | 0.1.6   | 0.1.7   | peer + dev     |
| `@lapis-notes/ui`           | 0.1.3   | 0.1.4   | dev            |
| `@lapis-notes/workspace`    | 0.2.1   | 0.3.0   | dev            |
| `@lapis-notes/file-explorer`| 0.1.2   | 0.2.0   | dev            |
| `@lapis-notes/search`       | 0.1.3   | 0.1.3   | dev (latest)   |

The `pnpm-workspace.yaml` overrides converged on the same kernel cohort
(design-core 0.7.0, mira 0.1.2, ui 0.1.4): `api@0.2.0` and `ui@0.1.4` now
declare exactly those peer ranges, while `markdown@0.1.7` and `search@0.1.3`
still declare `api ^0.1.2` — the overrides keep a single kernel instance
until those two republish. The registry-pure lockfile
(`--lockfile-only --ignore-pnpmfile`) and the local sibling-linked install
(`--lockfile=false`) were both refreshed; no unmet-peer warnings remain.

design-core 0.7.0 is additive for the surfaces this plugin consumes (Radio
Group, composer/chat families, FileTypeIcon, topbar placement); the full
Storybook suite confirms the workspace shell, sidebar groups, buttons,
tooltips, and scroll areas are unaffected.

## spec-validator 0.2.0 and QMD search (`b372f0f7`)

0.2.0 is Deno-free: it no longer bundles `@tobilu/qmd` as a dependency and
instead drives the system `qmd` binary (pinned expectation
`@tobilu/qmd@2.5.3`, satisfied by the global install). Adoption:

- `.qmd/index.yml` tracks the `lapis-plugin-notebook-spec` collection over
  `spec/src` with the standard embed/generate/rerank model set;
  `.qmd/index.sqlite*` is gitignored.
- `spec-validator.config.mjs` maps the `qmd` validator to the new
  requirement `LPN-SPEC-020` (collection, native-only tasks, doctor
  health, rg fallback only when QMD is unavailable) with its verification
  row.
- Root `spec:index` and `spec:search` scripts call the binary directly and
  are registered as reviewed native development exceptions in the routing
  audit (`scripts/validation/model.mjs`); they must never enter Docker
  lanes or CI (the skill contract also forbids CI search/index).
- `spec-validator doctor`: 10 pass / 1 warn — qmd-config, qmd-binary, and
  qmd-native all pass; the single warning is the intentional alias
  deviation because this repository wraps the portable spec lanes through
  the Docker runner (`node scripts/validation.mjs run spec:*`) per
  LPN-SPEC-013. `doctor --fix` must not be used on the scripts section
  here; it would unwrap the Docker routing.
- `pnpm spec:index` built the local index and `pnpm spec:search` returns
  QMD-ranked hits with collection context (verified with "panel group
  default presentation" and "sidebar group default"); the rg fallback
  prints only when QMD is unavailable.

Spec-first chapters updated in the same change: governance lead versions
and discovery prose plus the LPN-SPEC-020 row, notebook index dependency
cohort prose, and the verification row.

## Repository meta alignment (`1bb7c3ea`)

- README rewritten to the design-core format: badges (CI, Pages, live
  catalog), current package status, install/stylesheet boundary, runtime
  surface and coverage tables, styling and layout contracts, usage
  example, Storybook and local documentation (teaching `spec:search`,
  `spec:index`, and `doctor`), CI and local parity, release/validation
  commands, and a further-reading table. The npm badge is intentionally
  omitted until the package publishes.
- `ci.yml` keeps the plugin-family Docker lane sequence on the exact
  pushed Jujutsu revision and gains the design-core hygiene envelope:
  `permissions: contents: read`, bash defaults, ref-scoped concurrency
  with cancel-in-progress, a 90-minute timeout, and named steps. The
  Storybook test lanes (`test:storybook`, `build-storybook`) were already
  present and remain.
- New `publish-storybook-pages.yml` builds the static catalog from `main`
  with a frozen registry install (absent sibling paths keep registry
  resolution per LPN-SPEC-005) and deploys to GitHub Pages. It is a
  publication pipeline, not a validation lane; validation stays
  Docker-gated in `ci.yml`. Both repositories (`lapismd/lapis-plugin-notebook`)
  are not yet created on GitHub; the workflows and badges activate on push.
- AGENTS.md now instructs agents to prefer `pnpm spec:search` over raw
  `rg` scans of `spec/src`, refresh with `spec:index` after chapter edits,
  and run `spec-validator doctor` fixing reported issues after
  spec-tooling updates; governance chapter prose records the guidance and
  the workflow envelope in the same change.

## Local validation evidence

Native/host lanes after the bump: routing audit (21 lanes, 0 findings),
`spec:validate`, `spec:first`, `spec:check`, `pnpm check` (svelte-check
0/0 with fail-on-warnings), 290 unit tests, Storybook 29/29 (12 + 6 + 11,
native runtime, design-core 0.7.0), `pnpm build` + bundle exclusion audit,
`pnpm publint`, `spec-validator doctor`, `spec:index`, and `spec:search`
smoke — all green.

## Docker acceptance

Authoritative Docker `validation:all` passed at `1bb7c3ea` (covering both
commits) — run
`lapis-notebook-run-054634dd-880e-4197-b896-bc4e2dc17976`: frozen registry
install of the bumped cohort inside the worker, 290 unit tests, package
build plus bundle exclusion audit, publint, static Storybook build, all 29
Storybook interaction/accessibility stories (12 + 6 + 11, including the
`Panel group` acceptance), routing audit (21 lanes, 0 findings), story
parity (4 families), spec validate/mdbook/spec-first on spec-validator
0.2.0, and the App-ownership audit.

## GitHub publication

The repository was created public at `lapismd/lapis-plugin-notebook`
(matching the manifest URL and the family convention) and `main` was
pushed from the Jujutsu bookmark at the record commit. The first Pages
workflow run failed at the install step with
`ERR_PNPM_LOCKFILE_CONFIG_MISMATCH (pnpmfileChecksum)`: the tracked
lockfile is registry-pure (generated with `--ignore-pnpmfile`), while a
plain `pnpm install --frozen-lockfile` computes the hook checksum and
mismatches. The workflow now installs with
`--frozen-lockfile --ignore-pnpmfile`, which also guarantees the
LPN-SPEC-005 registry resolution on CI; the governance chapter records the
flag combination. CI (`ci.yml`) is unaffected — its lanes install inside
the Docker workers.

Pages site creation itself needed a one-time admin call
(`gh api repos/lapismd/lapis-plugin-notebook/pages -X POST -f
build_type=workflow`) because the workflow token may not create the site
("Resource not accessible by integration"); subsequent runs only read it. The
first Pages deployment succeeded and the catalog is live at
<https://lapismd.github.io/lapis-plugin-notebook/>. The superseded CI run
for the pre-fix commit was cancelled by the ref-scoped concurrency group as
designed.

The first GitHub runs surfaced the actions Node 20 deprecation notice; both
workflows moved to the current action majors (checkout/setup-node/pnpm
setup at v6, with the pnpm action reading the `packageManager` pin),
matching the design-core workflow envelope.
