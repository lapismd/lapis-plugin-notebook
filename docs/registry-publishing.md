# Registry publication

`registry.json` is the source of listing copy, banner, overview, gallery order,
alt text and fixed screenshot story IDs. `pnpm registry:media:capture` generates
cards in Docker. Copy `registry-assets/` from that run's report into this checkout
and commit it. `pnpm registry:media:check` proves the committed assets are current.
Neither command changes Visual Delta baselines.

After the matching npm version and stable GitHub release are published from a
commit on main with successful aggregate CI, **Publish plugin to registry**
prepares the installable bundle and media checks. Tasks also watches successful
completion of its CI/npm workflow because GitHub suppresses release events made
with GITHUB_TOKEN. Automatic discovery skips old releases lacking onboarding
metadata. Re-run manually on main with `release_tag` and `dry_run` (default true).
A dry run never signs, uploads, or dispatches.

Configure a protected `registry-production` environment before the first live run.
Allow `main` and the plugin's stable release tags in its deployment ref policy;
the resolver independently admits only a tag merged into main with successful CI.
Set repository variable `REGISTRY_PUBLICATION_APPROVED=true` only after reviewing
the release setup; live jobs remain closed until this explicit gate is set.
Grant it the existing approved `LAPIS_PLUGIN_RELEASE_KEY_ID`,
`LAPIS_PLUGIN_RELEASE_PRIVATE_KEY`, `LAPIS_REGISTRY_APP_CLIENT_ID` and
`LAPIS_REGISTRY_APP_PRIVATE_KEY` secrets. The signing key must match the app and
registry's pinned `lapis-plugin-release-2026-06` public key; do not generate or
silently trust another key. Install the registry App on plugin-registry with
contents write access for repository_dispatch. Source release assets use the
repository's GITHUB_TOKEN. Secrets enter only the signing/publication job after
artifact preparation; they never enter source builds or validation workers.

The sender uploads only absent archive/checksum pairs, verifies the actual
published bytes, then dispatches a request for `lapis-notebook`. Existing assets are immutable;
an incomplete pair requires a patch release. Retried dispatches are idempotent in
the registry. Submission and publication PR merges stay maintainer-controlled.
The current released source lacks onboarding metadata, so publish a new patch
from these changes rather than moving a tag or replacing existing assets.

The Apache-2.0 shared implementation is pinned under `scripts/vendor/`; see its
provenance inventory. Runtime bundling and metadata remain owned by this repo.

The pinned compositor is byte-identical to lapis-plugins main at
`f1b8823d3f1ce8e238a61f529d0fb5c66deabb43` (verified 1 November 2026).
Capture uses the same published Visual Delta engine and read-only addon
readiness hook, with fixed Storybook IDs and no baseline writes.
