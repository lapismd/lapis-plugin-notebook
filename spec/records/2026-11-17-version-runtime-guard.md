# Notebook qualified Node version guard

Shared CI PR25 merges at `ae1be182813d6049eddf0fb57bc33e66cbf049c5`;
its exact-main CI43987270173 passes. Actual whole-recipe run43987271519 at
that shared revision qualifies public Notebook source
`64d5f7b7e21e6e9d98a821898f9c1411a620d391`. Immutable artifact14286425548,
`notebook-changesets3-runtime-qualification`, has downloaded/verified ZIP digest
`sha256:4c2f49bcdb08fa65e1c436b4db233e02423569ff7b07a8816475888912764a27`.

The real source command `node scripts/release.mjs version` runs on Node24.15.0
with pnpm10.32.1 and Changesets3.0.3. The guarded disposable fixture restores
one exact historical patch note from ancestorcb79a6a7, labelled validation input
with currentReleaseIntent=false. The counterfactual root and runtime manifest
become0.2.5; all six private package manifests, the lock graph, imported release
helper, version workflow and non-version canonical evidence stay unchanged.
The receipt reports status=passed, denoOnPath=false, published=false and
writerAppMinted=false. This is whole-command qualification, not a real release.

Owner adoption pins that qualified shared revision and binds the exact source
Changesets config, pnpm version, Node major, unconfigured formatter policy,
version script, workspace policy and both imported release helpers. The guard
runs after the existing frozen install and before the one-repository App token.
Its actual release-plan output gates both App minting and the Changesets action;
empty maintenance notes create no writer work. The source recipe, CLI major,
private versions, runtime ID `lapis-notebook`, v2 hyphenated Changesets inputs,
GitHub API writes, signing and protected publication remain unchanged.

The exact release-pipeline regression starts with four passing cases and one
missing-guard failure, then passes all five cases after adoption. Native
execution is used only for this explicit focused diagnosis; required root
validation retains its default Docker workers without host fallback. Final-head
hosted CI and merged-main no-intent/no-App read-back remain required before
claiming deployed guard acceptance.

The source guard accepts the actual local qualified inputs and reports
hasChangesets=false without a token or source mutation. All five required root
commands pass in their default Docker workers: spec:check, check, test, build
and publint. The unit lane passes 566 tests across 94 files; Svelte reports zero
errors and warnings. Actionlint and formatting pass, and QMD indexing/search
work; doctor retains only the intentional Docker-script alias warning. No
runtime, story, visual baseline, package version or publication policy changes.
