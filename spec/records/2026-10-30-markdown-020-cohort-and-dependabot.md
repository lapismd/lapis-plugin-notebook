# Markdown 0.2.0 cohort pickup, registry-pure acceptance, and Dependabot

Date: 2026-10-30

## Why: the published-markdown gap behind the Pages and CI failures

The GitHub Pages catalog and the first GitHub CI run failed identically:
Mira parsed `:::cell` directives (`data-directive="cell"` elements present),
notebook views opened in preview mode, and execution ran, but the plugin's
markdown post-processor never mounted cells. Isolation:

- A source-linked static build (`.pnpmfile` siblings) served under the same
  subpath mounted cells and rendered outputs ("42", "The answer is 42.").
- A pristine registry-resolved static build (`git archive` +
  `pnpm install --frozen-lockfile --ignore-pnpmfile`) reproduced the
  deployed failure exactly (`directiveEls: 2`, `cells: 0`, no
  `data-notebook-cell-mounted`).
- The published `@lapis-notes/markdown@0.1.6` and `0.1.7` tarballs both end
  `resolveRegisteredMarkdownMiraExtensions` at
  `app.markdownExtensions.getAll()`; neither composes the global
  `app.mardownPostProcessor` registry that
  `Plugin.registerMarkdownPostProcessor` feeds.
- The bridge (LN-MD-104, lapis-plugins commit `4af5d28bc047`, "Compose
  globally registered Markdown post-processors into every Markdown
  surface", authored Oct 27) lived on an unbookmarked lineage; 0.1.7 was
  cut Oct 29 17:41 UTC from a worktree whose base did not contain it.

Local Docker validation had been masking the gap through the documented
temporary archive acceptance (`.local/validation` markdown cohort tarball),
which GitHub CI does not have — so CI and Pages were the first pure-registry
production-build consumers.

## Resolution: markdown 0.2.0 and search 0.1.4

lapis-plugins released `@lapis-notes/markdown@0.2.0` (Oct 30 14:58 UTC) and
`@lapis-notes/search@0.1.4`. Verified from the fresh registry tarball:
markdown 0.2.0's `dist/mira/registered-extensions.js` contains the
`api:markdown-post-processors` composition, and its peers declare the
current cohort (`api ^0.2.0`, `ui ^0.1.4`), as does search 0.1.4
(`api ^0.2.0`). Every other tracked Lapis dependency was already at the
latest published release (api 0.2.0, ui 0.1.4, workspace 0.3.0,
file-explorer 0.2.0, design-core 0.7.0, mira 0.1.2, spec-validator 0.2.0).

Changes in this slice:

- `package.json`: markdown peer `^0.1.7` -> `^0.2.0` and dev `0.1.7` ->
  `0.2.0`; search dev `0.1.3` -> `0.1.4`. Lockfile refreshed through the
  registry-pure ritual.
- `pnpm-workspace.yaml`: override pins kept (single-instance kernel
  guarantee per LPN-SPEC-005) with the stale-peer-range rationale replaced
  — the whole cohort now declares current ranges.
- The temporary archive acceptance was dropped from the local
  `.local/validation` configuration so local Docker validation is
  registry-pure and matches CI exactly.
- README and the governance/index chapters record the new cohort versions.
- New `.github/dependabot.yml`: weekly grouped updates for the npm and
  GitHub Actions ecosystems, with the Lapis cohort, Storybook, and
  CodeMirror/Lezer groups, and an ignore rule for the exactly pinned
  `@duckdb/duckdb-wasm` engine (LPN-SPEC-004).

## Delivery through the new branch protection

`main` now requires pull requests with the `Validation lanes` check green
(strict up-to-date, linear history) and deletes merged head branches, so
this slice ships as the repository's first protected-flow PR instead of a
direct bookmark push.

## Validation evidence

- Pristine registry repro (the exact CI/Pages dependency resolution):
  `git archive` of the bump commit, `pnpm install --frozen-lockfile
  --ignore-pnpmfile` (markdown 0.2.0 and search 0.1.4 from npm), native
  static Storybook build served under the Pages subpath — the Run notebook
  story mounts both cell directives (`data-notebook-cell-mounted="true"`,
  4 cell nodes) and renders the executed outputs ("42", "The answer is
  42.") through the worker transport.
- Local lanes: `pnpm check` green, 290 unit tests green, Storybook 29/29
  green (native runtime), build + bundle exclusion audit green, publint
  green, `spec:check` and `spec:first` green.
- Authoritative Docker gate: the PR's required `Validation lanes` CI run on
  the pure-registry runner install.
