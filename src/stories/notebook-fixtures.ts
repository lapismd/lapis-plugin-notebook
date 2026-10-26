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

export const NOTEBOOK_FIXTURE_PATHS = {
  welcome: "welcome.md",
  gettingStarted: "Getting Started.notebook.md",
  interactiveInputs: "Interactive Inputs.notebook.md",
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
  ];
}
