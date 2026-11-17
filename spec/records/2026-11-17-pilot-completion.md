# Notebook dependency-completion caller

Notebook is selected for the operator's single-repository end-to-end workflow
pilot. The caller observes successful CI, Storybook Pages and Version packages
completion from the default branch and delegates to the immutable shared
verifier atc1c5ddf184af4166ee11ea3329e7ca85f8333828. That source policy binds the
actual workflow IDs401183623,401183626 and403592523 respectively.

The caller retains read-only contents, Actions and PR permissions, performs no
checkout or local step and reuses the existing encrypted App credential only
through the trusted verifier. It excludes its own callback and registry-release
triggers; existing npm publication notification remains separate. A hint grants
no current-CI, source, merge or publication qualification.

The exact `scripts/release-pipeline.test.mjs` verifier case fails once before
the missing caller is added and passes afterward. All15 release-tool cases
and567 complete units across94 files pass. Explicit native qualification also
passes spec:check, check, build and publint; Svelte reports zero errors and
warnings. Actionlint passes; QMD discovery and doctor retain only the existing
intentional script-alias warning. No package, lockfile, release intent, runtime,
Storybook scenario, visual baseline or publication gate changes.

Hosted PR/main acceptance, actual callback dispatch and genuine Core intake
remain separate gates. This source slice does not enable coordinator scheduling.
