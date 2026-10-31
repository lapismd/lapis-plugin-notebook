# System Guide and input coverage

Reference checked: <https://observablehq.github.io/notebook-kit/system-guide>.
Its main sections are JavaScript, Markdown and HTML. Its JavaScript examples
include display, asynchronous values, inputs, attachments, a stock-price chart,
standard-library helpers and the penguins sample dataset.

Source audit confirms Plot and D3 are bundled in notebook-stdlib and twelve
sample datasets are injected as bare globals: aapl, alphabet, cars, citywages,
diamonds, flare, industries, miserables, olympians, penguins, pizza and weather.
The old guide displayed counts for three datasets but no charts or graph.

Input Types already covered all thirteen supported factories: range, number,
toggle, text, textarea, date, datetime, color, email, tel, url, password and
table. No supported input was missing. The input runtime explicitly rejects
button, checkbox, radio, select, file, search and form. Metadata reconstruction
support for an option list is not evidence of an implemented input factory.

The refreshed guide groups cells under the reference's language sections and
feature subheadings. It shows the complete dataset catalog, eight real penguin
rows, a penguin scatter plot, an Apple stock-price chart, and a finite seeded
77-node/254-link network layout. The layout clones its inputs and stops its
simulation before ticking. The input example has feature headings and lists
unsupported factories separately, including the distinction between table row
selection and a standalone radio-input factory.

Explicit native diagnostic baselines:

- `pnpm test -- src/stories/notebook-fixtures.test.ts`: 1 pass, proving no
  supported factory was missing from the original fixture. The audit obtains
  supported factories from the actual headless input runtime.
- `pnpm test:storybook -- src/stories/PluginWorkspace.stories.svelte -t 'SystemGuide|InputTypes'`:
  2 failures before fixture changes (missing guide headings/visuals and missing
  unsupported-input documentation).

The new visualizations exposed an additional loading regression: Plot's
`interval-tree-1d` CommonJS dependency reached the browser without its default
export interop. The post-fixture exact run had 1 failure / 1 pass. Private
package include chains could not resolve from the catalog root (another
1 failure / 1 pass), and absolute include entries built unused optimization
outputs (another 1 failure / 1 pass). Declaring the existing Plot/D3/htl versions
as catalog development dependencies lets normal bare import IDs resolve and
prebundle. The runtime packages and their lazy import boundary are unchanged.
The browser then rendered all three charts, revealing a separate false
dependency cycle: the word `table` in an attachment filename linked the load
cell back to the table cell. The graph regression initially failed once, and
four narrow analyzer cases failed before the fix. Analysis now filters source
identifiers through the existing syntax parser so strings, comments and raw
template text do not produce definitions or references. Template interpolations
and independent variables sharing a member-property name remain tracked.
After the lexical fix, all functional guide assertions passed, while axe found
two prohibited labelled SVG mark groups. The guide uses Plot's public render
transform to give these groups roles while preserving labels and all rendered
marks. No accessibility rule or assertion was loosened.

Final focused results:

- Analyzer/fixture/graph selection: 14 pass across three files. Four analyzer
  regressions move from 4 failures to 0; the fixture graph moves from 1 failure
  to 0 and includes every cell without a cycle.
- Exact SystemGuide/InputTypes selector: 2 pass, 0 functional or accessibility
  failures. The stock line contains the full series, the penguin chart contains
  342 valid points, and the graph contains all 77 nodes and 254 links.
- Input coverage remains 13 of 13 supported factories, with all seven
  unsupported factories documented separately.

Logs: `/tmp/notebook-guide-analysis-final.log`,
`/tmp/notebook-guide-accessibility-after.log`.
The first aggregate stopped at specification validation because the new
verification row was in a separate leading table, which hid the existing rows
from the configured extractor. It is now part of the canonical table; the
exact spec-validation target passes again. This was a documentation failure.

Full Docker qualification run
`lapis-notebook-run-c38bdad2-812c-4be4-b715-1667105319fc` completed the quality,
unit, package build, publint, static Storybook and full browser lanes:

- Quality: zero Svelte errors/warnings, typecheck and ownership/routing/parity
  audits pass.
- Unit: 318 tests across 72 files pass.
- Build and package: plugin bundle and exclusion audit pass; publint passes.
- Static Storybook: build passes.
- Interaction/accessibility: all 36 stories pass in three fresh browser batches
  (12 + 6 + 18), including both exact guide/input cases.

The final specification lane built the book and validated all requirements but
stopped at one spec-first finding: the registry lockfile change also maps to the
tooling-governance chapter. The chapter now documents the catalog dependencies
and prebundling boundary. No product, assertion, or validation policy changed.
The aggregate log is `/tmp/notebook-guide-full-validation-final.log`.

The exact Docker `pnpm spec:check` recheck passes in run
`lapis-notebook-run-cccc6b9b-1772-4f83-b47a-6050c4afae96`:
validation, mdBook, spec-first and App ownership all pass. The one spec-first
finding moves from 1 to 0. Log: `/tmp/notebook-guide-spec-check-final.log`.
Together with the unchanged product lanes above, every required lane is now
qualified. The final edit is documentation only, so the passing product suites
were not repeated. Both runs retain the verified temporary Design Core/API/Mira
archives listed in their request/result manifests; tracked manifests and lockfiles
remain registry portable. QMD index/search work and doctor passes ten checks,
with its existing warning about the deliberate Docker script aliases.

Manual cold review uses a freshly started checkout-owned Storybook at port 7042.
The guide completes with zero Problems; keyboard outline navigation reaches the
Scatter plot and Network graph headings. Real chart marks, sample rows and the
network render visibly. Review captures are
`notebook-system-guide-scatter.png` and `notebook-system-guide-network.png` under
the task's local visualization directory. The unchanged StoriesExtractor
`Meta is not a function` messages remain as recorded in earlier qualification;
all guarded functional/axe tests pass and no diagnostics were suppressed.

Keep visual-pending; no baselines, push, publication or PR.
