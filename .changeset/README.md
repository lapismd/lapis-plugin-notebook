# Changesets

Add a patch, minor or major Changeset for `@lapis-notes/lapis-plugin-notebook`
when a change needs a release. Private support packages remain unpublished.

A push to main updates the **chore: version Notebook package** PR. Merge that
PR after its checks pass; main CI qualifies the exact npm artifact and requests
approval in `npm-production`. Publication uses npm trusted publishing and then
the registry workflow requests a separate registry submission PR.
