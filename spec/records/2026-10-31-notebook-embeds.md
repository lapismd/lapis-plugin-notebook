# Rendered Notebook embeds

Notebook uses the same public Markdown embed registration contract as Transcripts;
CSV uses the parallel extension registry for non-Markdown files. The plugin does
not register a generic Markdown handler or change a host API.

## Original regression

`pnpm test:storybook -- src/stories/PluginWorkspace.stories.svelte -t '^NotebookEmbed$'`
records one failed story and 26 skipped before implementation: neither notebook
reference mounts a Notebook embed (expected two, received zero). Report:
`.local/validation/runs/lapis-notebook-run-e5b56c24-55cd-4b91-aecc-73e433030439`.

The first implementation passes the functional story but records one axe failure
for duplicate named region landmarks. Embeds are now semantic groups within the
host-owned document landmark. The exact target then passes one story and axe;
report `.local/validation/runs/lapis-notebook-run-416835ba-774d-4e48-828a-6ecd5bf1767a`.
The expanded three-story run records two incorrect link-role queries (the host
uses an accessible link-preview button) and one premature async cell assertion;
queries now use the actual host control and await cell rendering without removing
any assertion.

`pnpm test:storybook -- src/stories/PluginWorkspace.stories.svelte -t '^NotebookEmbedInputs$'`
records one product failure before independent control ownership: two embeds
contain only one slider. Report:
`.local/validation/runs/lapis-notebook-run-811fba4f-1d49-48e8-8dff-25fe89906793`.
Separate controls fix that failure and expose one identity failure: cell polling
replaces equivalent metadata objects and reconstructs a focused slider. A stable
serialized metadata key retains the owner and focus. The exact story then passes,
including both controls, reactive results and persisted value assertions; report
`.local/validation/runs/lapis-notebook-run-f9f77b32-c11b-4bba-8cf4-ca68259927bf`.

Input copies synchronize through factory snapshots so choice IDs and transient
file values preserve their owners' types. Snapshotting still uses the canonical
notebook control; embed teardown disposes only its copy. Pending reconstruction
uses an owner-local abort signal. Callback-dependent inputs never trigger an
execution merely by opening an embed.

Native source diagnosis initially records one event-reference typing error and
one Svelte initial-value warning, then zero errors and zero warnings after the
owned listener cleanup and explicit initial capture are corrected.

## Focused qualification

The focused render-service, source observer, embed owner and independent input
tests pass 36 cases across four files. Command:
`pnpm test -- src/lib/render/__tests__/notebook-embed.test.ts src/lib/render/__tests__/notebook-embed-source.test.ts src/lib/render/__tests__/notebook-embed-inputs.test.ts src/lib/render/__tests__/notebook-render-service.test.ts`.
Report `lapis-notebook-run-611346d8-85a2-4e65-b3d0-bd69c4dbcee3`.

Two added native diagnostic regressions for unresolved canonical/copy input
restoration record two failures before the abortable wait, then two passes:
`LAPIS_NOTEBOOK_VALIDATION_RUNTIME=native pnpm test -- src/lib/render/__tests__/notebook-embed-inputs.test.ts -t 'aborting an unresolved'`.
Logs `/tmp/notebook-embed-pending-{red,fixed}.log`. The full focused Docker
rerun includes both, proves immediate release and disposal of late copies,
and preserves the canonical notebook owner.

## Source dependency and cross-story lifecycle

Isolated stories exposed an upstream Mira recursion defect only when run
together: after the custom renderer unregisters during teardown, generic
Markdown fallback repeatedly expands a self-reference. Interrupted diagnostic
runs are not passing evidence. The bounded source regression records one
failure then one pass, and all eight source embed stories pass. See Mira's
`spec/records/2026-10-31-recursive-embeds.md` for source qualification.

Temporary archive acceptance uses the existing Design Core and API archives
plus Mira 0.1.2 built from `mira-mde-notebook-fences`, SHA-256
`305669affbb3bc1d642eafb7404cf6982f2870e1a7020c158039ec6e55d886fa`.
The ignored archive manifest and isolated install projection carry this intake;
tracked manifests and locks retain registry versions. Native review installation
restores both tracked files byte-for-byte after installing those same archives.
The source repair is committed locally as Mira `94e7ee05`; its full source
specification, quality, 520-test, 178-story, 60-browser, six-package and static
catalog qualification passes independently of Notebook acceptance.

With the source repair, the exact combined command
`pnpm test:storybook -- src/stories/PluginWorkspace.stories.svelte -t '^NotebookEmbed'`
passes all four stories and accessibility, including cross-story teardown.
Report `lapis-notebook-run-350abcfe-9002-4076-9369-aa16e6af6ec9`.
A fresh checkout-owned server and cold browser display both saved Notebook
references and their outputs, with no notebook execution status on the report.

Full functional qualification is recorded below. Visual review remains pending;
baselines remain unchanged.

## Main-control regression found by the full lane

The first full `pnpm validation:all` passes quality, all 431 unit cases,
package/build lint and static Storybook, then records 45 passing stories and
two failures in Input Types desktop/mobile. A stable descriptor key retained
the main notebook's old table node after reactive execution replaced its
canonical owner. Report `lapis-notebook-run-620f7822-8c65-48c9-bfa7-787d72e039a6`.

The exact command
`pnpm test:storybook -- src/stories/PluginWorkspace.stories.svelte -t '^InputTypes(Mobile)?$'`
reproduces both failures before the correction (27 skipped), report
`lapis-notebook-run-d05c19b2-8a85-4cc5-847d-770f3e16c6fe`.
Descriptor stability now applies only to independently owned embed controls;
the main notebook reclaims its current canonical node on refreshed output
metadata. The same exact command passes both stories with all assertions and
accessibility retained, report
`lapis-notebook-run-b7ba0361-fcec-4acb-b0f6-acec835fe721`.
The full aggregate is rerun after the correction.

## Final qualification and review

The corrected `pnpm validation:all` passes the complete aggregate: strict quality
with zero Svelte errors/warnings, all 431 tests in 81 files, package build and
publint, static Storybook, all 47 interaction/accessibility stories (29 shell
and 18 panel cases), specification validation/book/spec-first and the fail-closed
App ownership audit. Report
`lapis-notebook-run-d305d5d9-d576-43d0-909b-59abf988d094` retains exact source,
archive checksums, installed graph, commands and execution results.

The attachment/mount boundaries were also diagnosed natively with
`LAPIS_NOTEBOOK_VALIDATION_RUNTIME=native pnpm test -- src/lib/render/__tests__/notebook-embed.test.ts -t '<selector>'`.
Each exact selector records one failure before and one pass after:
`waits for attachment`, `defers connected`, and `defers component unmount`.
Their before/after logs are `/tmp/notebook-embed-attachment-{red,fixed}.log`,
`/tmp/notebook-embed-effect-{red,fixed}.log`, and
`/tmp/notebook-embed-unmount-{red,fixed}.log`. These safeguards keep ancestry
inspection after attachment and Svelte root ownership outside host effects;
they remain covered by the complete 431-test run.

The table-control regression is two failures to zero in both the exact target
and the full aggregate. The four embed stories also pass within that complete
shell sequence, preserving independent control identity and focus.

A fresh checkout-owned server runs at `http://localhost:7042/`. Review stories:
`plugins-notebook-shell--notebook-embed`, `--notebook-embed-mobile`,
`--notebook-embed-lifecycle` and `--notebook-embed-inputs`. A cold browser run on
the restarted server confirms the rendered report, saved outputs and two
references; its screenshot is retained in the task's visualization artifacts.
All changed stories remain `visual-pending`. No baselines were updated, and no
push, PR or package publication is performed before user review.

After advancing LN-NB-047–049, the standalone portable `pnpm spec:check` passes
again, report `lapis-notebook-run-ed3d896b-9dbf-41ca-b003-5b0a77b6933f`.
`spec-validator doctor` passes the QMD/configuration health checks with the
existing intentional portable-wrapper alias warning; `pnpm spec:index` and the
semantic `pnpm spec:search` check both complete successfully.
