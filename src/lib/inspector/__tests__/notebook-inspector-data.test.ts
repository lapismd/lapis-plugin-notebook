import { describe, expect, test } from "vitest";
import { parseNotebookDocument } from "../../parse/parse-notebook-document";
import { buildNotebookGraph } from "../../runtime/notebook-graph";
import {
  buildNotebookInspectorSchemas,
  buildNotebookInspectorVariables,
} from "../notebook-inspector-data";

function createNotebook(source: string) {
  return parseNotebookDocument(source, {
    sourcePath: "Notebook.notebook.md",
    frontmatter: { version: 1, mode: "lazy" },
  });
}

describe("notebook inspector data", () => {
  test("builds variable definitions and usages from the notebook graph", () => {
    const document = createNotebook(
      [
        ':::cell{#setup lang="ts"}',
        "```ts",
        'const selectedFolder = "Notes";',
        "const monthlyTotal = 12;",
        "```",
        ":::",
        "",
        ':::cell{#query lang="sql"}',
        "```sql",
        "SELECT * FROM lapis.notes WHERE path LIKE {{selectedFolder}} || '/%'",
        "```",
        ":::",
        "",
        ':::cell{#summary lang="md"}',
        "Folder: {{selectedFolder}} / Total: {{monthlyTotal}}",
        ":::",
      ].join("\n"),
    );

    const variables = buildNotebookInspectorVariables(
      buildNotebookGraph(document),
    );

    expect(variables).toEqual([
      {
        name: "monthlyTotal",
        declaredBy: ["setup"],
        usedBy: ["summary"],
        duplicate: false,
      },
      {
        name: "selectedFolder",
        declaredBy: ["setup"],
        usedBy: ["query", "summary"],
        duplicate: false,
      },
    ]);
  });

  test("groups duckdb catalog entries by schema", () => {
    const schemas = buildNotebookInspectorSchemas({
      schemas: [
        {
          name: "lapis",
          tables: [
            {
              name: "notes",
              type: "table",
              rowCount: 24,
              columns: [
                { name: "path", dataType: "VARCHAR", nullable: false },
                { name: "name", dataType: "VARCHAR", nullable: true },
              ],
            },
          ],
        },
        {
          name: "main",
          tables: [
            {
              name: "totals",
              type: "view",
              rowCount: null,
              columns: [{ name: "count", dataType: "BIGINT", nullable: true }],
            },
          ],
        },
      ],
    });

    expect(schemas).toEqual([
      {
        name: "lapis",
        tables: [
          {
            schema: "lapis",
            name: "notes",
            type: "table",
            rowCount: 24,
            columns: [
              { name: "path", dataType: "VARCHAR", nullable: false },
              { name: "name", dataType: "VARCHAR", nullable: true },
            ],
          },
        ],
      },
      {
        name: "main",
        tables: [
          {
            schema: "main",
            name: "totals",
            type: "view",
            rowCount: null,
            columns: [{ name: "count", dataType: "BIGINT", nullable: true }],
          },
        ],
      },
    ]);
  });
});
