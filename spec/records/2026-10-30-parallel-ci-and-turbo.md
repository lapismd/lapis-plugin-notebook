# Parallel Notebook CI and Turbo cache

PR #1 failed in CI run 41099857322, job 124215071718. All validation
steps, including the complete browser suite and static catalog build, passed.
The single failure occurred during setup-node post-job cleanup: its host pnpm
store did not exist because all installations ran inside Docker volumes.

The replacement uses the existing immutable Lapis CI base as a job container,
then primes a Turbo build cache and fans out quality, unit, package lint,
static Storybook and three browser jobs. The named Validation lanes aggregate
requires success from every prerequisite. Local portable commands retain their
fail-closed Docker routing. All CI installation remains registry-only/frozen.

Turbo caches root tasks, includes the six private support-package source trees,
and restores dist outputs. GitHub Actions backs the local task cache; signed
remote configuration matches Lapis Plugins and falls back when unavailable.
Specification, smoke, browser and accessibility checks execute every run.

Executed validation:

- Original hosted run: 1 failed job, 0 failing product lanes. Its exact failing
  boundary was the setup-node post-job cache save (`Path Validation Error`).
- `actionlint .github/workflows/ci.yml` and formatting checks passed.
- Focused `validation:check`: 29 existing checks before, 32 checks after; all
  passed, including aggregate fail/cancel/skip handling and the shared image pin.
- Full Docker `pnpm validation:all`: check (0 Svelte errors/warnings), 292 unit
  tests at that snapshot, build and bundle audit, publint, static Storybook,
  all 29 interaction/accessibility stories across three fresh batches, and
  specification checks passed. The final unit suite with the image-pin
  regression passed 293/293 through Turbo, alongside the full quality task.
- Latest Docker `pnpm validation:smoke` passed denied-directory writes and the
  exact locked Chromium after the bootstrap extraction fix.
- Direct cold CI-base smoke: pinned pnpm/Jujutsu/mdBook install, frozen registry
  installation, browser install/smoke, 32 focused checks and Turbo build passed.
  An initial root/capability-dropped tool extraction failed once on the archive
  builder's uid/gid; `--no-same-owner` corrected it. CI uses checkout uid 1001
  with writable temporary Corepack, pnpm and browser stores.
- Turbo cold build: 32.32 seconds. With the entire dist tree moved away, a warm
  hit restored all 276 files with identical SHA-256 hashes in 3.855 seconds
  (1 local hit, 0 executed tasks). This measures local task restoration, not
  hosted end-to-end runtime.
- A temporary private core-source edit changed the Turbo build hash from
  `d474c5b03736a835` to `4bcf87709967d623`; restoring the source restored the
  original hash. The plan included 109 private-package input files.
- `spec-validator doctor` passed under Node 24 (the installed QMD native ABI);
  semantic QMD search and index refresh passed. The expected script-alias
  warning reflects Docker routing and is not an error. Spec-validator 0.2.0
  was confirmed to be the latest published Deno-free release.

The required branch-protection context remains `Validation lanes`. Hosted
parallel execution and signed remote-cache hits are a separate PR-run check.
