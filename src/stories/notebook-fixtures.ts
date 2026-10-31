/**
 * Vault fixtures for Notebook Storybook shells and acceptance stories.
 *
 * The `.notebook.md` documents follow the portable Markdown cell-directive
 * format specified in `spec/src/plugins/notebook/documents.md`. Stage 0 uses
 * them as inert vault content; later stages execute them.
 */

export const NOTEBOOK_FIXTURE_WELCOME = `# Notebook workspace

A seeded vault for the Notebook plugin shell.

Open [[Getting Started.notebook]] to inspect the executable document format.
`;

export const NOTEBOOK_FIXTURE_GETTING_STARTED = `---
notebook:
  version: 1
  autorun: false
  mode: lazy
---

# Getting Started

:::cell{#calc lang="ts"}

\`\`\`ts
const answer = 42;
display(answer);
\`\`\`

:::

:::cell{#summary lang="md"}

\`\`\`md
The answer is {{answer}}.
\`\`\`

:::
`;

export const NOTEBOOK_FIXTURE_INTERACTIVE_INPUTS = `---
notebook:
  version: 1
  autorun: false
  mode: lazy
---

# Interactive Inputs

:::cell{#controls lang="ts"}

\`\`\`ts
const count = view(
  Inputs.range([0, 10], { value: 2, step: 1, label: "Count" })
);
\`\`\`

:::

:::cell{#echo lang="md"}

\`\`\`md
Count is {{count}}.
\`\`\`

:::
`;

export const NOTEBOOK_FIXTURE_DATA_QUERIES = `---
notebook:
  version: 1
  autorun: false
  mode: lazy
---

# Data Queries

:::cell{#basic lang="sql"}

\`\`\`sql
SELECT 42 AS answer, 'lapis' AS source
\`\`\`

:::

:::cell{#notes lang="sql"}

\`\`\`sql
SELECT count(*) AS note_count FROM lapis.notes
\`\`\`

:::
`;

export const NOTEBOOK_FIXTURE_SLOW = `---
notebook:
  version: 1
  autorun: false
  mode: lazy
---

# Slow Notebook

:::cell{#slow lang="ts"}

\`\`\`ts
await new Promise((resolve) => setTimeout(resolve, 30000));
display("done");
\`\`\`

:::
`;

export const NOTEBOOK_FIXTURE_AUTORUN = `---
notebook:
  version: 1
  autorun: true
  mode: lazy
---

# Autorun Notebook

:::cell{#value lang="ts"}

\`\`\`ts
const n = 7;
display(n);
\`\`\`

:::

:::cell{#show lang="md"}

\`\`\`md
n is {{n}}.
\`\`\`

:::
`;

export const NOTEBOOK_FIXTURE_SYSTEM_GUIDE = `---
notebook:
  version: 1
  mode: lazy
tags:
  - notebook
  - system-guide
---

# Notebook System Guide

A runnable introduction based on the [Observable System Guide](https://observablehq.github.io/notebook-kit/system-guide).
Run this notebook, then explore its cells and change the inputs. Use the
headings to navigate JavaScript, Markdown, HTML, data, charts, and graphs.

## JavaScript

Cells can define values for other cells and use \`display(...)\` to show
text, tables, charts, or DOM content. Async cells can await a promise before
their dependants run.

### File attachments and imports

This cell reads local JSON and CSV attachments and imports a helper from the
notebook's assets folder. \`now\` captures the run's timestamp.

:::cell{#load lang="ts"}

\`\`\`ts
import { describeRelease } from "./assets/system-guide-formatters.js";

const attachment = lapis.FileAttachment("./assets/system-guide-data.json");
const data = await attachment.json();
const tableRows = await lapis.FileAttachment("./assets/system-guide-table.csv").csv({ typed: true });
const executedAt = now;
const carCount = cars.length;
const firstCarName = cars[0]?.name ?? "Unknown";
const miserablesNodeCount = miserables.nodes.length;
const miserablesLinkCount = miserables.links.length;
const penguinCount = penguins.length;
const firstPenguinSpecies = penguins[0]?.species ?? "Unknown";
const productName = data.productName;
const releaseStage = data.releaseStage;
const defaultName = data.defaultName;
const rows = data.rows;
const unsafeLabel = "<not escaped by markdown>";

const greeting = await new Promise((resolve) => {
  setTimeout(() => resolve(\`Hello from \${productName}\`), 25);
});

const rowCount = rows.length;
const tableRowCount = tableRows.length;
const latestRegion = rows[0]?.region ?? "Unknown";
const importedSummary = describeRelease(productName, releaseStage);
\`\`\`

:::

### Inputs and reactivity

\`view(Inputs.text(...))\` displays a control and makes its current value
available to dependent cells. Changing Name updates the Markdown and HTML
examples below. The table input supplies the selected CSV row.

:::cell{#controls lang="ts"}

\`\`\`ts
const selectedName = view(Inputs.text({
  label: "Name",
  value: defaultName,
}));
\`\`\`

:::

:::cell{#table-controls lang="ts"}

\`\`\`ts
const selectedTableRow = view(Inputs.table(tableRows, {
  label: "CSV row",
  multiple: false,
  value: tableRows[0],
  rows: 4,
}));
\`\`\`

:::

### Sample datasets

Twelve datasets are bundled and available by name. The catalog shows their
sizes; the next table previews eight rows from \`penguins\`.

:::cell{#sample-catalog lang="ts"}

\`\`\`ts
const sampleDataSummary = [
  { dataset: "aapl", records: aapl.length },
  { dataset: "alphabet", records: alphabet.length },
  { dataset: "cars", records: cars.length },
  { dataset: "citywages", records: citywages.length },
  { dataset: "diamonds", records: diamonds.length },
  { dataset: "flare", records: flare.length },
  { dataset: "industries", records: industries.length },
  { dataset: "miserables", records: miserables.nodes.length, links: miserables.links.length },
  { dataset: "olympians", records: olympians.length },
  { dataset: "penguins", records: penguins.length },
  { dataset: "pizza", records: pizza.length },
  { dataset: "weather", records: weather.length },
];
display(Inputs.table(sampleDataSummary, {
  label: "Bundled sample datasets", select: false, rows: 12,
}));
\`\`\`

:::

:::cell{#sample-preview lang="ts"}

\`\`\`ts
display(Inputs.table(penguins.slice(0, 8), {
  label: "Penguin sample data", select: false, rows: 8,
}));
\`\`\`

:::

### Charts and graphs

\`Plot\` and \`d3\` are available without an import. Display their SVG or
HTML output just like any other DOM node.

The shared Plot render callback gives labelled marks a group role for
assistive technology while preserving their data and labels.

:::cell{#plot-semantics lang="ts"}

\`\`\`ts
function accessibleMark(index, scales, values, dimensions, context, next) {
  const markGroup = next(index, scales, values, dimensions, context);
  markGroup?.setAttribute("role", "group");
  return markGroup;
}
\`\`\`

:::

#### Scatter plot

Compare bill length and depth across the three penguin species.

:::cell{#penguin-chart lang="ts"}

\`\`\`ts
display(Plot.plot({
  ariaLabel: "Penguin measurements by species",
  width: 640, height: 300,
  style: { fontSize: "12px", maxWidth: "100%", height: "auto" },
  x: { label: "Bill length (mm)" },
  y: { label: "Bill depth (mm)", grid: true },
  color: { legend: true },
  marks: [Plot.dot(penguins, {
    x: "culmen_length_mm", y: "culmen_depth_mm", stroke: "species",
    render: accessibleMark,
  })],
}));
\`\`\`

:::

#### Time series

Plot the bundled \`aapl\` closing prices against their dates, following the
stock-chart pattern in the Observable guide.

:::cell{#stock-chart lang="ts"}

\`\`\`ts
display(Plot.lineY(aapl, {
  x: (row) => new Date(row.Date), y: "Close",
  render: accessibleMark,
}).plot({
  ariaLabel: "Apple closing stock prices",
  width: 640, height: 280,
  style: { fontSize: "12px", maxWidth: "100%", height: "auto" },
  x: { label: "Date" }, y: { label: "Closing price (USD)", grid: true },
}));
\`\`\`

:::

#### Network graph

The \`miserables\` dataset contains 77 characters and 254 co-occurrence
links. D3 computes a finite force layout on copies of the data, leaving the
bundled sample unchanged. Hover a node to see its character name.

:::cell{#network-graph lang="ts"}

\`\`\`ts
display((() => {
  const nodes = miserables.nodes.map((node) => ({ ...node }));
  const links = miserables.links.map((link) => ({ ...link }));
  d3.forceSimulation(nodes).randomSource(d3.randomLcg(0.42))
    .force("link", d3.forceLink(links).id((node) => node.id).distance(25))
    .force("charge", d3.forceManyBody().strength(-90))
    .force("center", d3.forceCenter(320, 180))
    .stop().tick(160);
  const [x0, x1] = d3.extent(nodes, (node) => node.x);
  const [y0, y1] = d3.extent(nodes, (node) => node.y);
  const graph = d3.create("svg")
    .attr("role", "img").attr("aria-label", "Les Misérables character network")
    .attr("width", 640).attr("height", 360)
    .attr("viewBox", [x0 - 12, y0 - 12, x1 - x0 + 24, y1 - y0 + 24].join(" "))
    .style("max-width", "100%").style("height", "auto");
  graph.append("title").text("Les Misérables character network");
  graph.append("desc").text("77 characters connected by 254 co-occurrence links.");
  graph.append("g").attr("stroke", "currentColor").attr("stroke-opacity", 0.25)
    .selectAll("line").data(links).join("line")
    .attr("x1", (link) => link.source.x).attr("y1", (link) => link.source.y)
    .attr("x2", (link) => link.target.x).attr("y2", (link) => link.target.y);
  const color = d3.scaleOrdinal(d3.schemeTableau10);
  graph.append("g").attr("stroke", "white").attr("stroke-width", 1)
    .selectAll("circle").data(nodes).join("circle").attr("r", 5)
    .attr("cx", (node) => node.x).attr("cy", (node) => node.y)
    .attr("fill", (node) => color(node.group))
    .append("title").text((node) => node.id);
  return graph.node();
})());
\`\`\`

:::

### Tables and standard library helpers

\`lapis.table\` displays a data table. \`md\` renders Markdown from JavaScript
and \`tex\` renders a mathematical expression. \`Promises\` and \`Generators\`
also provide helpers; \`invalidation\` signals when a cell's resources should
be disposed. General generator-cell reactivity, \`width\`, and \`visibility\`
from Observable are not currently provided by this runtime.

:::cell{#table lang="ts"}

\`\`\`ts
lapis.table(tableRows);
\`\`\`

:::

:::cell{#helpers lang="ts"}

\`\`\`ts
md\`### Helper output for \${selectedName}\`;
tex\`E = mc^2\`;
\`\`\`

:::

## Markdown

Markdown cells combine prose with values from other cells using
\`\${...}\` expressions or \`{{name}}\` placeholders.

:::cell{#summary lang="md"}

### Values from other cells

\${greeting}.

Hello, **\${selectedName}**!

Release stage: \`\${releaseStage}\`

Rows loaded from \`FileAttachment\`: \`{{rowCount}}\`

CSV rows loaded from \`FileAttachment.csv\`: \`\${tableRowCount}\`

Latest region: **{{latestRegion}}**

Selected CSV row: **\${selectedTableRow.name}** from \`\${selectedTableRow.region}\`

Execution snapshot: \`\${executedAt}\`

Penguins dataset rows: \`\${penguinCount}\` (\${firstPenguinSpecies})

Cars dataset rows: \`\${carCount}\` (\${firstCarName})

Miserables graph: \`\${miserablesNodeCount}\` nodes / \`\${miserablesLinkCount}\` links

Imported helper summary: \`\${importedSummary}\`

:::

## HTML

HTML cells support interpolation too. Interpolated text is escaped, so a value
containing angle brackets stays text. The \`html\` tagged template builds DOM
content from JavaScript, and \`display\` can append more than one output.

:::cell{#html-source lang="html"}

<article data-system-guide-html-source>
  <h2>Hello, \${selectedName}!</h2>
  <p>\${greeting}</p>
  <p data-escaped="\${unsafeLabel}">\${unsafeLabel}</p>
</article>

:::

:::cell{#card lang="ts"}

\`\`\`ts
display(\`Display helper ready for \${selectedName}.\`);
display(html\`<article data-system-guide-card>
  <h2>Hello, \${selectedName}!</h2>
  <p>\${greeting}</p>
  <p>\${productName} is currently in <strong>\${releaseStage}</strong>.</p>
</article>\`);
\`\`\`

:::`;

export const NOTEBOOK_FIXTURE_GALLERY = `---
notebook:
  version: 1
  mode: lazy
tags:
  - notebook
  - sample
---

# Notebook Gallery

This notebook covers the main notebook authoring and runtime surfaces.

:::cell{#setup lang="ts"}

\`\`\`ts
const selectedRegion = "North";
const releaseName = "E2E Vault";
lapis.markdown(\`Running **\${releaseName}** samples for \${selectedRegion}.\`);
\`\`\`

:::

:::cell{#app-notes lang="sql"}

\`\`\`sql
SELECT path, name, extension
FROM lapis.notes
ORDER BY name
LIMIT 10
\`\`\`

:::

:::cell{#csv-register lang="ts"}

\`\`\`ts
await lapis.duckdb.registerVaultFile("sales_csv", "./assets/sales.csv");
lapis.markdown("Registered \`./assets/sales.csv\` for DuckDB queries.");
\`\`\`

:::

:::cell{#csv-query lang="sql"}

\`\`\`sql
SELECT month, amount
FROM read_csv_auto('sales_csv')
WHERE region = {{selectedRegion}}
ORDER BY month
\`\`\`

:::

:::cell{#input lang="ts"}

\`\`\`ts
const gain = view(Inputs.range([0, 10], {
  value: 4,
  step: 1,
  label: "Gain"
}))
\`\`\`

:::

:::cell{#markdown-output lang="md"}

## Markdown Output

Selected region: **{{selectedRegion}}**

Input value placeholder: \`{{gain}}\`
:::`;

// Vault assets referenced by the legacy showcase notebooks (FileAttachment,
// registerVaultFile, and the relative ESM import in the load cell).
export const NOTEBOOK_SHOWCASE_ASSETS: Record<string, string> = {
  "assets/sales.csv": `month,region,amount
2026-01,North,120
2026-01,South,86
2026-02,North,142
2026-02,South,91
2026-03,North,150
2026-03,South,112`,
  "assets/system-guide-data.json": `{
  "productName": "Lapis Notebook Kit",
  "releaseStage": "beta",
  "defaultName": "anonymous",
  "rows": [
    {
      "region": "North",
      "amount": 42,
      "owner": "Ada"
    },
    {
      "region": "South",
      "amount": 35,
      "owner": "Grace"
    },
    {
      "region": "West",
      "amount": 27,
      "owner": "Linus"
    }
  ]
}`,
  "assets/system-guide-formatters.js": `export function describeRelease(productName, releaseStage) {
  return \`\${productName} (\${releaseStage})\`;
}`,
  "assets/system-guide-table.csv": `name,region,score
Ada,North,7
Grace,West,9
Katherine,South,8`,
};

export const NOTEBOOK_FIXTURE_INPUT_TYPES = `---
notebook:
  version: 1
  autorun: false
  mode: lazy
---

# Input Types

All twenty Observable-compatible input factories and the Lapis Markdown composer
extension are shown below, one control per cell.
Run the notebook and change a control. A separate reactive output cell follows
each input cell and shows its current value.

## Text and textareas

:::cell{#text-input lang="ts"}

\`\`\`ts
const textValue = view(Inputs.text({ label: "Text", value: "ada" }));
\`\`\`

:::

:::cell{#text-input-value lang="ts"}
\`\`\`ts
display(textValue);
\`\`\`
:::

:::cell{#textarea-input lang="ts"}

\`\`\`ts
const textareaValue = view(Inputs.textarea({ label: "Textarea", value: "line one" }));
\`\`\`

:::

:::cell{#textarea-input-value lang="ts"}
\`\`\`ts
display(textareaValue);
\`\`\`
:::

The Markdown composer is a Lapis extension. It returns Markdown text live,
with formatting controls and no submit step.

:::cell{#markdown-input lang="ts"}
\`\`\`ts
const markdownValue = view(Inputs.markdown({ label: "Markdown notes", value: "**Notebook notes**" }));
\`\`\`
:::

:::cell{#markdown-input-value lang="ts"}
\`\`\`ts
display(markdownValue);
\`\`\`
:::

:::cell{#markdown-preview lang="ts"}
\`\`\`ts
display(lapis.markdown(markdownValue));
\`\`\`
:::

## Numeric controls

:::cell{#number-input lang="ts"}

\`\`\`ts
const numberValue = view(Inputs.number([0, 100], { label: "Number", value: 12, step: 1 }));
\`\`\`

:::

:::cell{#number-input-value lang="ts"}
\`\`\`ts
display(numberValue);
\`\`\`
:::

:::cell{#range-input lang="ts"}

\`\`\`ts
const rangeValue = view(Inputs.range([0, 10], { label: "Range", value: 4, step: 1 }));
\`\`\`

:::

:::cell{#range-input-value lang="ts"}
\`\`\`ts
display(rangeValue);
\`\`\`
:::

## Toggle

:::cell{#toggle-input lang="ts"}

\`\`\`ts
const toggleValue = view(Inputs.toggle({ label: "Toggle", value: true }));
\`\`\`

:::

:::cell{#toggle-input-value lang="ts"}
\`\`\`ts
display(toggleValue);
\`\`\`
:::

## Typed text fields

:::cell{#email-input lang="ts"}

\`\`\`ts
const emailValue = view(Inputs.email({ label: "Email", value: "ada@lapis.notes" }));
\`\`\`

:::

:::cell{#email-input-value lang="ts"}
\`\`\`ts
display(emailValue);
\`\`\`
:::

:::cell{#tel-input lang="ts"}

\`\`\`ts
const telValue = view(Inputs.tel({ label: "Telephone", value: "+1 555 0100" }));
\`\`\`

:::

:::cell{#tel-input-value lang="ts"}
\`\`\`ts
display(telValue);
\`\`\`
:::

:::cell{#url-input lang="ts"}

\`\`\`ts
const urlValue = view(Inputs.url({ label: "URL", value: "https://lapis.notes" }));
\`\`\`

:::

:::cell{#url-input-value lang="ts"}
\`\`\`ts
display(urlValue);
\`\`\`
:::

:::cell{#password-input lang="ts"}

\`\`\`ts
const passwordValue = view(Inputs.password({ label: "Password", value: "secret" }));
\`\`\`

:::

:::cell{#password-input-value lang="ts"}
\`\`\`ts
display(passwordValue);
\`\`\`
:::

## Dates and color

:::cell{#date-input lang="ts"}

\`\`\`ts
const dateValue = view(Inputs.date({ label: "Date", value: "2026-01-15" }));
\`\`\`

:::

:::cell{#date-input-value lang="ts"}
\`\`\`ts
display(dateValue);
\`\`\`
:::

:::cell{#datetime-input lang="ts"}

\`\`\`ts
const datetimeValue = view(Inputs.datetime({ label: "Datetime", value: "2026-01-15T09:30" }));
\`\`\`

:::

:::cell{#datetime-input-value lang="ts"}
\`\`\`ts
display(datetimeValue);
\`\`\`
:::

:::cell{#color-input lang="ts"}

\`\`\`ts
const colorValue = view(Inputs.color({ label: "Color", value: "#8a5cf5" }));
\`\`\`

:::

:::cell{#color-input-value lang="ts"}
\`\`\`ts
display(colorValue);
\`\`\`
:::

## Table selection

:::cell{#table-input lang="ts"}

\`\`\`ts
const tableValue = view(Inputs.table([
  { name: "Ada", role: "Math" },
  { name: "Grace", role: "Compilers" }
], { label: "Rows", multiple: false, rows: 3 }));
\`\`\`

:::

:::cell{#table-input-value lang="ts"}
\`\`\`ts
display(tableValue);
\`\`\`
:::

## Buttons and choices

Buttons can count clicks or reduce a value with grouped actions. Choice controls
return the original typed values, including Map values and objects.

:::cell{#button-input lang="ts"}
\`\`\`ts
const clicks = view(Inputs.button("Click me"));
\`\`\`
:::

:::cell{#button-input-value lang="ts"}
\`\`\`ts
display(clicks);
\`\`\`
:::

:::cell{#reducer-input lang="ts"}
\`\`\`ts
const score = view(Inputs.button([["−1", value => value - 1], ["+1", value => value + 1]], { value: 0 }));
\`\`\`
:::

:::cell{#reducer-input-value lang="ts"}
\`\`\`ts
display(score);
\`\`\`
:::

:::cell{#checkbox-input lang="ts"}
\`\`\`ts
const flavours = view(Inputs.checkbox(["Salty", "Sweet", "Sour", "Bitter", "Umami"], { label: "Flavours", value: ["Sweet"] }));
\`\`\`
:::

:::cell{#checkbox-input-value lang="ts"}
\`\`\`ts
display(flavours);
\`\`\`
:::

:::cell{#radio-input lang="ts"}
\`\`\`ts
const pizzaSize = view(Inputs.radio(["Small", "Medium", "Large"], { label: "Pizza size", value: "Medium" }));
\`\`\`
:::

:::cell{#radio-input-value lang="ts"}
\`\`\`ts
display(pizzaSize);
\`\`\`
:::

:::cell{#select-input lang="ts"}
\`\`\`ts
const choiceNumber = view(Inputs.select(new Map([["One", 1], ["Two", 2], ["Three", 3]]), { label: "Number choice", value: 2 }));
\`\`\`
:::

:::cell{#select-input-value lang="ts"}
\`\`\`ts
display(choiceNumber);
\`\`\`
:::

:::cell{#multiple-input lang="ts"}
\`\`\`ts
const selectedSpecies = view(Inputs.select(["Adelie", "Chinstrap", "Gentoo"], { label: "Species", multiple: true, value: ["Adelie"] }));
\`\`\`
:::

:::cell{#multiple-input-value lang="ts"}
\`\`\`ts
display(selectedSpecies);
\`\`\`
:::

## Search a dataset

Search matches case-insensitive word beginnings across the selected columns.
Try “gentoo biscoe” to find penguins by species and island.

:::cell{#search-input lang="ts"}
\`\`\`ts
const matchingPenguins = view(Inputs.search(penguins, { label: "Search penguins", columns: ["species", "island"], query: "gentoo" }));
\`\`\`
:::

:::cell{#search-input-value lang="ts"}
\`\`\`ts
display({ count: matchingPenguins.length, preview: matchingPenguins.slice(0, 3) });
\`\`\`
:::

:::cell{#search-results lang="ts"}
\`\`\`ts
const searchRows = view(Inputs.table(matchingPenguins.slice(0, 5), { label: "Matching penguins", rows: 5 }));
\`\`\`
:::

:::cell{#search-results-value lang="ts"}
\`\`\`ts
display(searchRows);
\`\`\`
:::

## Live forms

Forms aggregate child controls immediately, without a submit button. Object
forms return named properties; array forms return values in order.

:::cell{#form-input lang="ts"}
\`\`\`ts
const profile = view(Inputs.form({ name: Inputs.text({ label: "Profile name", value: "Ada" }), enabled: Inputs.toggle({ label: "Profile enabled", value: true }) }));
\`\`\`
:::

:::cell{#form-input-value lang="ts"}
\`\`\`ts
display(profile);
\`\`\`
:::

:::cell{#array-form-input lang="ts"}
\`\`\`ts
const coordinates = view(Inputs.form([Inputs.number([0, 100], { label: "X coordinate", value: 10 }), Inputs.number([0, 100], { label: "Y coordinate", value: 20 })]));
\`\`\`
:::

:::cell{#array-form-input-value lang="ts"}
\`\`\`ts
display(coordinates);
\`\`\`
:::


## Code output

Use the code renderer when the output is source code in a specific language.
Ordinary values can be passed directly to display.
Arrays, objects and other non-string JavaScript values are highlighted automatically.
Circular references are shown as "[Circular]" without evaluating getters or toJSON.

:::cell{#code-output-example lang="ts"}
\`\`\`ts
lapis.code('{ "message": "Hello from a code output" }', "json", { title: "JSON code output" });
\`\`\`
:::

:::cell{#javascript-values-example lang="js"}
\`\`\`js
display([1, undefined, NaN, Infinity, 12n]);
const circularValue = { name: "Loop-safe object" };
circularValue.self = circularValue;
display(circularValue);
\`\`\`
:::

## Vault files and temporary uploads

Choose CSV or JSON files from the vault, upload files from your browser, or mix
both sources. Uploads remain in memory during this session and must be selected
again after reopening. Vault references are restored when their files exist.
File contents are read only when requested by a cell.

:::cell{#file-input lang="ts"}
\`\`\`ts
const selectedFiles = view(Inputs.file({ label: "Data files", accept: ".csv,.json", multiple: true }));
\`\`\`
:::

:::cell{#file-input-value lang="ts"}
\`\`\`ts
display(selectedFiles);
\`\`\`
:::

:::cell{#file-results lang="ts"}
\`\`\`ts
const parsedFiles = await Promise.all(selectedFiles.map(async file => ({ name: file.name, source: file.source, data: file.name.endsWith(".json") ? await file.json() : await file.csv({ typed: true }) })));
if (parsedFiles.length) display(parsedFiles);
else display("Choose a CSV or JSON file to preview its data.");
\`\`\`
:::


`;

export const NOTEBOOK_FIXTURE_INPUT_ROWS = `---
notebook:
  version: 1
  mode: lazy
---
# Input rows

:::cell{#row-text lang="ts"}
\`\`\`ts
const rowText = view(Inputs.text({ label: "Name", value: "Ada" }));
\`\`\`
:::
:::cell{#row-select lang="ts"}
\`\`\`ts
const rowSelect = view(Inputs.select(["Small", "Medium", "Large"], { label: "Size" }));
\`\`\`
:::
:::cell{#row-checkbox lang="ts"}
\`\`\`ts
const rowCheckbox = view(Inputs.checkbox(["Sweet", "Salty"], { label: "Flavours", value: ["Sweet"] }));
\`\`\`
:::
:::cell{#row-file lang="ts"}
\`\`\`ts
const rowFile = view(Inputs.file({ label: "Files" }));
\`\`\`
:::
`;

export const NOTEBOOK_FIXTURE_INPUT_LIFECYCLE =
  `---
notebook:
  version: 1
  mode: lazy
---
# Retained inputs

` +
  [
    ...NOTEBOOK_FIXTURE_INPUT_TYPES.matchAll(
      /^:::cell\{#([^\s}]+)[^}]*\}[\s\S]*?^:::/gm,
    ),
  ]
    .filter((match) =>
      new Set([
        "markdown-input",
        "markdown-input-value",
        "markdown-preview",
        "button-input",
        "button-input-value",
        "search-input",
        "search-input-value",
        "form-input",
        "form-input-value",
        "file-input",
        "file-input-value",
        "file-results",
      ]).has(match[1]!),
    )
    .map((match) => match[0])
    .join("\n\n");

export const NOTEBOOK_FIXTURE_TABLE_FILTERS = `---
notebook:
  version: 1
  mode: lazy
---
# Table filters

Filter the sample rows by text, score, enabled state, or date.

:::cell{#filter-table lang="ts"}
\`\`\`ts
// Arbitrary column keys must not collide with properties of ordinary objects.
lapis.table({
  columns: ["constructor", "score", "enabled", "created"],
  columnMeta: [
    { key: "constructor", label: "name", type: "string" },
    { key: "score", type: "number" },
    { key: "enabled", type: "boolean" },
    { key: "created", type: "date" },
  ],
  rows: [
    ["Ada", 7, true, "2026-01-10"],
    ["Grace", 9, false, "2026-02-15"],
    ["Katherine", 8, true, "2026-03-20"],
  ],
});
\`\`\`
:::
`;

export const NOTEBOOK_FIXTURE_PROGRESS =
  `---
notebook:
  version: 1
  autorun: false
  mode: lazy
---
# Run progress
` +
  [1, 2, 3, 4]
    .map(
      (n) => `
:::cell{#step-${n} lang="js"}
\`\`\`js
await Promises.delay(1000);
display("Step ${n} complete");
\`\`\`
:::
`,
    )
    .join("\n");

export const NOTEBOOK_FIXTURE_IN_PROCESS_PROMISE = `---
notebook:
  version: 1
  autorun: false
  mode: lazy
---
# In-process promise
:::cell{#waiting lang="js"}
\`\`\`js
const input = Inputs.range([0, 10], { value: 2, label: "Count" });
await Promises.delay(30000);
display("late output");
\`\`\`
:::
`;
export const NOTEBOOK_FIXTURE_FAILURE = `---
notebook:
  version: 1
  autorun: false
  mode: lazy
---
# Failed run
:::cell{#broken lang="js"}
\`\`\`js
throw new Error("The sample data could not be loaded");
\`\`\`
:::
`;

export const NOTEBOOK_FIXTURE_REACTIVE_OUTPUT = `---
notebook:
  version: 1
  mode: lazy
---
# Reactive output publication

The answer should appear while the later promise cell is still running.

:::cell{#publication-input lang="js"}
\`\`\`js
const answer = 42;
\`\`\`
:::
:::cell{#publication-value lang="js"}
\`\`\`js
display(answer);
lapis.markdown("**Markdown output**");
\`\`\`
:::
:::cell{#publication-slow lang="js"}
\`\`\`js
display("Later cell started");
await Promises.delay(3000);
display("Later cell complete");
\`\`\`
:::
`;

export const NOTEBOOK_FIXTURE_PATHS = {
  welcome: "welcome.md",
  gettingStarted: "Getting Started.notebook.md",
  interactiveInputs: "Interactive Inputs.notebook.md",
  dataQueries: "Data Queries.notebook.md",
  slow: "Slow Notebook.notebook.md",
  progress: "Run Progress.notebook.md",
  inProcessPromise: "In Process Promise.notebook.md",
  failure: "Failed Run.notebook.md",
  autorun: "Autorun Notebook.notebook.md",
  systemGuide: "System Guide.notebook.md",
  gallery: "Notebook Gallery.notebook.md",
  inputTypes: "Input Types.notebook.md",
  inputRows: "Input Rows.notebook.md",
  inputLifecycle: "Input Lifecycle.notebook.md",
  reactiveOutput: "Reactive Output.notebook.md",
  tableFilters: "Table Filters.notebook.md",
} as const;

export function notebookWorkspaceMarkdownFixtures(): Array<{
  path: string;
  raw: string;
}> {
  return [
    { path: NOTEBOOK_FIXTURE_PATHS.welcome, raw: NOTEBOOK_FIXTURE_WELCOME },
    { path: NOTEBOOK_FIXTURE_PATHS.progress, raw: NOTEBOOK_FIXTURE_PROGRESS },
    {
      path: NOTEBOOK_FIXTURE_PATHS.inProcessPromise,
      raw: NOTEBOOK_FIXTURE_IN_PROCESS_PROMISE,
    },
    { path: NOTEBOOK_FIXTURE_PATHS.failure, raw: NOTEBOOK_FIXTURE_FAILURE },
    {
      path: NOTEBOOK_FIXTURE_PATHS.gettingStarted,
      raw: NOTEBOOK_FIXTURE_GETTING_STARTED,
    },
    {
      path: NOTEBOOK_FIXTURE_PATHS.interactiveInputs,
      raw: NOTEBOOK_FIXTURE_INTERACTIVE_INPUTS,
    },
    {
      path: NOTEBOOK_FIXTURE_PATHS.dataQueries,
      raw: NOTEBOOK_FIXTURE_DATA_QUERIES,
    },
    {
      path: NOTEBOOK_FIXTURE_PATHS.slow,
      raw: NOTEBOOK_FIXTURE_SLOW,
    },
    {
      path: NOTEBOOK_FIXTURE_PATHS.autorun,
      raw: NOTEBOOK_FIXTURE_AUTORUN,
    },
    {
      path: NOTEBOOK_FIXTURE_PATHS.systemGuide,
      raw: NOTEBOOK_FIXTURE_SYSTEM_GUIDE,
    },
    {
      path: NOTEBOOK_FIXTURE_PATHS.gallery,
      raw: NOTEBOOK_FIXTURE_GALLERY,
    },
    {
      path: NOTEBOOK_FIXTURE_PATHS.inputTypes,
      raw: NOTEBOOK_FIXTURE_INPUT_TYPES,
    },
    {
      path: NOTEBOOK_FIXTURE_PATHS.inputRows,
      raw: NOTEBOOK_FIXTURE_INPUT_ROWS,
    },
    {
      path: NOTEBOOK_FIXTURE_PATHS.inputLifecycle,
      raw: NOTEBOOK_FIXTURE_INPUT_LIFECYCLE,
    },
    {
      path: NOTEBOOK_FIXTURE_PATHS.reactiveOutput,
      raw: NOTEBOOK_FIXTURE_REACTIVE_OUTPUT,
    },
    {
      path: NOTEBOOK_FIXTURE_PATHS.tableFilters,
      raw: NOTEBOOK_FIXTURE_TABLE_FILTERS,
    },
    ...Object.entries(NOTEBOOK_SHOWCASE_ASSETS).map(([path, raw]) => ({
      path,
      raw,
    })),
  ];
}
