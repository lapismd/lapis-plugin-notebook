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

export const NOTEBOOK_FIXTURE_PATHS = {
  welcome: "welcome.md",
  gettingStarted: "Getting Started.notebook.md",
  interactiveInputs: "Interactive Inputs.notebook.md",
  dataQueries: "Data Queries.notebook.md",
  slow: "Slow Notebook.notebook.md",
  autorun: "Autorun Notebook.notebook.md",
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
  ];
}
