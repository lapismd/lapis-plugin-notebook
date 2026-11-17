# Source-reviewed Core development inputs

Shared CI28 mergesd678a21e8bbe2160f20c72d6ec78afe25fde02fe after its required
`validate` check passes all301 source tests. Notebook pins the reviewed helper
commitdd71275c5b2618afceae0b97ee0a071649781971 in both ordinary quality CI and
main version preparation. The separate unchanged Darwin CLI job was queued;
it is not the required validation gate or a changed component in this slice.

The old guard accepts Notebook's exact workspace but rejects a legitimate
Core development override0.13.4→0.13.5. Its new source-owned opt-in binds the
complete workspace with only that literal value normalized, and requires the
root development pin, installed identity and direct override to agree within
stable0.13/minimum patch4. The normalized fingerprint is
`1ee11996c7e0a434716de23b031f294b602d3c178d1bce45d0bf368a00475bd1`.
Both actual release helpers, Changesets config, command, Node/CLI and formatter
bindings remain exact. Forward-only admission and all other dependency facts,
functional, audit and canonical checks remain independent.

An isolated fresh frozen copy of source4b9ccc3f4c4536a0cae8b7266dba05620f6fa193
installs released Core0.13.5, restores only the exact historical note from
cb79a6a7d294f0f9c83deea7410296db5ecc4fcc, and executes the unchanged
`node scripts/release.mjs version`. Node24.15.0/pnpm10.32.1/CLI3.0.3 succeeds
with Deno absent from PATH. Only the six expected package/runtime versions,
canonical version marker, changelog and consumed-note paths change; all six
private manifests, lock graph, workspace and other source remain identical.
No App, remote write or package publication participates. The fixture's own
post-main reference is advanced locally before checking its real empty plan;
stale fixture metadata remains distinct from production acceptance.

This is counterfactual local whole-command evidence alongside prior hosted
proof43987271519. Current source still selects Core0.13.4 and returns
hasChangesets=false without mutation or a token. The genuine Core0.13.5 bot
candidate and live main/completion/scheduling acceptance remain pending.

The exact missing-quality-guard test fails once and passes after wiring the
same pinned action immediately after frozen setup, without a bot exemption.
The existing exact version-action pin assertion is updated to that same
reviewed commit, preserving ordering/authentication/intent checks. All16 release
cases and568 units pass. Normal spec/check/build/publint pass; final source
spec/index/range/format checks and hosted CI remain separately recorded.
