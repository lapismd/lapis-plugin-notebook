# Website product media

The standalone website imports reviewed captures from three fixed production
stories: `plugins-notebook-website-media--workspace`, `--inputs`, and `--panels`.
They use PluginWorkspaceDemo's owned disposable App and actual WorkspaceShell,
execute the real notebook commands, and await specific rendered outputs.
Visual Delta exposes settled render/play readiness. Both themes are captured
at 1200x800 CSS pixels and 2x density, without baseline updates.

## Executed validation

- `pnpm validation:all`: Docker registry-only frozen install passed; normal
  check passed, including nine source-composition families, App ownership,
  Svelte diagnostics (zero warnings/errors), TypeScript and specifications.
- Unit lane: 88 files, 514 tests passed, zero failures.
- Build, publint, packed public types, bundle exclusions and cold npm development
  and production consumers passed. Static Storybook build passed from a fresh
  worker before the interaction lane.
- Full discovered interaction lane retained its assertions and stopped with
  three new media-story axe failures (11 other tests passed in that batch).
- `pnpm test:storybook src/stories/PluginWorkspace.stories.svelte src/stories/panels src/stories/tables`:
  all existing eight files / 67 stories passed. This supplements the failed
  full-discovery run; it does not turn the three failed stories into passes.
- `pnpm spec:check`: passed after recording the catalog/lock governance mapping.
- Six themed captures were generated through the public Visual Delta API.
  Final committed-source capture/import receipts belong to the website.

## Accepted existing accessibility limitations

Workspace, Inputs and Panels complete their plays, then fail enabled axe checks.
Mira code colors include `#b85c15` on `#f6f7f8` (4.27:1); Notebook cell source/output
button roles contain focusable descendants. The existing shell stories already
exempt these areas/rules. The new media stories add no exemption. On November 1
the user explicitly accepted retaining these recorded Notebook limitations to
keep the migration focused. Mira owns its code palette; Notebook owns cell roles.
Runtime repair and visual-baseline approval remain separate work.

## Failed attempts

The initial TS story format was rejected by the CSF-Svelte production-root audit;
it was replaced with supported Svelte stories, with no auditor relaxation.
An initial capture lacked addon readiness; the registered public addon and fixed
media scenes resolved this. A parallel spec invocation hit the active worker's
lease; rerunning sequentially passed. An initial spec-first run lacked the mapped
governance chapter; that chapter is now updated. An initial local install hook
polluted the lock; the tracked lock was regenerated without the hook and passed
frozen registry installs. No local hooks, file dependencies, exemptions, runtime
changes, package publication, push or website deployment are included.
