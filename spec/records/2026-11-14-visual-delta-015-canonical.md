# Qualify the Visual Delta 0.1.5 development intake

PR 32 updated the development manifest and frozen registry lock to the verified
published Visual Delta 0.1.5 artifact. Its package, unit, static and browser
acceptance checks passed. The post-merge quality run `43583000506` then failed
at spec-first because both mapped canonical chapters were unchanged.

Docker reproduction:
`pnpm spec:first --base 8451570a4b29f02f8458742d6fa69d8e243a9d36 --head 3367c42c6add5291ebd078ebf0bd8152e598d1e7`
reports two `SPEC-FIRST-MISSING` findings under LPN-SPEC-002. The repaired range
uses the same base and `--head @`, covering the entire intake and both corrected
chapters. No validator, bot exemption, assertion or baseline was weakened.

This documentation repair keeps Notebook at 0.2.4 and retains runtime contracts,
audits and explicit publication approval. Existing immutable npm coordinates do
not authorize a fresh publication from this tooling-only source change.

The repository's documented search form with a bare `--` was rejected by the
installed CLI. Running `pnpm spec:search 'Visual Delta development dependency'`
returned both owning chapters through QMD; no discovery bypass was required.

Docker qualification passes: the explicit full-intake range reports two
protected files and both canonical chapters; `pnpm spec:check` passes all three
specification lanes, validation routing, story parity, no-Tailwind and the one
App-ownership audit test. All four documentation files pass Prettier.
`pnpm spec:index` refreshed the native QMD cache after the chapter edits.
Hosted functional gates remain required on the new documentation PR.
