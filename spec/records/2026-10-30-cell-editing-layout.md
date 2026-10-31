# Cell editor geometry and plain text output

Follow-up to local execution-status change b5819dc4. No push or PR is authorized
before review.

The focused source preview changed height by 17px on entering inline editing.
Inside live Markdown, the API's document-wide source padding additionally gave
the embedded editor 450px of trailing space. Plain text display output used a
preformatted monospace fallback.

Notebook now matches the preview's 16px padding and line rhythm, uses the code
surface for both editor and gutter, and selects the host muted text tone for its
owned absolute line numbers. The latter fixes an interaction/axe regression
that identified two low-contrast gutter numbers in the new editing scenario.
Plain text output renders as escaped, wrapping prose with preserved line breaks;
structured fallback output keeps its preformatted rendering.

The API owner repair excludes public `mod-inline` source editors from
full-document trailing padding. Owner Storybook `Inline Source Editor Spacing`
failed once before (450px rather than zero) and passed after. The source change
is in the isolated lapis-notes workspace notebook-inline. It does not add a
published API or migration.

Qualification:

- Exact Notebook PreviewCellEditingLayout and LiveCellEditingLayout failed
  before with a height change/extra trailing space; RunProgress's text-face
  assertion also failed before. The initial live scenario incorrectly selected
  raw Source mode and was corrected to use the public live-preview view state.
- Combined final three focused interaction/axe stories pass. Additional exact
  padding assertions for both modes pass (2 stories); gutter and source surfaces
  match, and no height lock prevents the editor from growing with content.
- Docker run lapis-notebook-run-e33b4415-2245-443c-8875-4ad257ffcdbc passed strict
  check (0 Svelte errors/warnings), all 303 unit tests, package/bundle builds,
  bundle audit, publint, static Storybook and all 34 interaction/axe stories.
  Its final spec-first gate found a missing mapped index chapter update; that
  chapter was then updated and the exact specification lane rerun.
- A fresh checkout-owned Storybook was started after installing the API archive;
  a cold browser load exercised the updated editor, output and run popover.
- Changed stories remain visual-pending. No baseline was updated.

Temporary API source acceptance used
`lapis-notes-notebook-inline/.release/validation-packages/lapis-notes-api-0.2.0.tgz`,
SHA-256 `0a10c0df0482eaf238b3c1a9691deef073e0ad51f282ad51922df3f5c1726f6c`.
The isolated installation also retains the documented Design Core archive.
Tracked manifests/lockfiles stay on registry ranges; source releases remain
required before shipping.
