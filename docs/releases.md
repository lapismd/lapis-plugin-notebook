# Notebook package releases

Add a Changeset for `@lapis-notes/lapis-plugin-notebook` with each releasable
change. Merging it to main automatically opens or updates **chore: version
Notebook package**, using the same Changesets action and GitHub API commit mode
as lapis-plugins. The workflow also has a manual **Run workflow** control.
Only the public root package is versioned; private support packages stay private.

The generated PR consumes pending Changesets and updates the npm package,
runtime manifest, changelog and canonical release-version declaration together.
The specification validator reads the current package version, so generated
version PRs retain the normal specification checks. Main already contains the
unpublished 0.2.1 preparation; the first generated patch is 0.2.2.

Merge the version PR after its checks pass. Main CI runs every existing blocking
lane and retains the exact npm tarball, source commit and integrity from the
qualified package job. Pending Changesets and already-published package versions
skip publication and do not request an environment approval. Main CI runs are
serialized so a later push cannot cancel an approved publication in progress.

An unpublished version requests maintainer approval in `npm-production`, which
allows only main. After approval, the publisher downloads the qualified artifact,
uses npm trusted publishing with provenance, verifies downloaded npm bytes,
and checks a clean install, frozen npm ci, strict peers, package signatures and
publint. It then creates `v<version>` at the qualified source commit. Existing
npm versions, tags and release assets are immutable. Retry a failed publication
job at its original source; changed existing bytes require a new patch release.

The npm trusted publisher is scoped to:

- Package: `@lapis-notes/lapis-plugin-notebook`
- Repository: `lapismd/lapis-plugin-notebook`
- Workflow: `ci.yml`
- Environment: `npm-production`

The npm owner can configure that relationship with:

```sh
npm trust github @lapis-notes/lapis-plugin-notebook \
  --file ci.yml --repo lapismd/lapis-plugin-notebook \
  --env npm-production --allow-publish --yes
```

This account change requires npm's two-factor authentication. No long-lived npm
token belongs in repository secrets. Approval and OIDC credentials enter only
the publication job, after source qualification.

Successful CI completion then starts **Publish plugin to registry**, covering
GitHub release events suppressed by GITHUB_TOKEN. That workflow verifies the
published archive and asks for its separate `registry-production` approval.
It requests the one-file PR in plugin-registry; registry maintainers merge the
submission and combined publication PR before registry deployment.

Local verification uses `pnpm release:check` and `pnpm release:prepare` through
the governed Docker worker, also included in `pnpm validation:all`. The
`release:version`, `release:plan`, `release:publish` and `release:verify` commands
are reviewed native release-orchestration exceptions. Versioning intentionally
updates the checkout; publishing requires the approved exact main CI source.
