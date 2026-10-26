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

# System Guide Acceptance

This markdown-native notebook captures the Lapis-owned subset of Observable's
System Guide that the current runtime intentionally supports: async JavaScript
cells, plain \`view(...)\` inputs, Markdown and HTML source interpolation,
trusted \`html\` outputs, selected stdlib helpers, and vault-backed file
attachments.

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

:::cell{#summary lang="md"}

## Summary

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

:::

:::cell{#helpers lang="ts"}

\`\`\`ts
md\`### Helper output for \${selectedName}\`;
tex\`E = mc^2\`;
\`\`\`

:::

:::cell{#table lang="ts"}

\`\`\`ts
lapis.table(tableRows);
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

export const NOTEBOOK_FIXTURE_PATHS = {
  welcome: "welcome.md",
  gettingStarted: "Getting Started.notebook.md",
  interactiveInputs: "Interactive Inputs.notebook.md",
  dataQueries: "Data Queries.notebook.md",
  slow: "Slow Notebook.notebook.md",
  autorun: "Autorun Notebook.notebook.md",
  systemGuide: "System Guide.notebook.md",
  gallery: "Notebook Gallery.notebook.md",
} as const;

export function notebookWorkspaceMarkdownFixtures(): Array<{
  path: string;
  raw: string;
}> {
  return [
    { path: NOTEBOOK_FIXTURE_PATHS.welcome, raw: NOTEBOOK_FIXTURE_WELCOME },
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
    ...Object.entries(NOTEBOOK_SHOWCASE_ASSETS).map(([path, raw]) => ({
      path,
      raw,
    })),
  ];
}
