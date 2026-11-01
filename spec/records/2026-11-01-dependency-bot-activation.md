# Dependency bot activation

The generated version PR uses a short-lived repository-scoped App token. The
activation variable gates preparation, and checkout does not retain credentials.
Publication remains outside the version workflow. The existing publisher now
notifies the coordinator only after successful npm verification; retrying that
job does not republish. Existing npm-production approval remains required. The App token allows generated PRs
to start ordinary functional CI; GitHub token-authored PR workflows otherwise
require manual approval on supported GitHub versions.

Validation: frozen pnpm installation, actionlint, spec:check, check (Svelte,
types, routing, app ownership and taxonomy), and all 549 unit tests pass in
the governed Docker worker. Local npm build exits during Vite transform without
a diagnostic; the hosted package/consumer lane must pass before merge. No
package was published, and the version activation flag remains disabled.
