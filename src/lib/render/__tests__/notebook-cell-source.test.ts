import { describe, expect, test } from "vitest";
import { parseNotebookDocument } from "../../parse/parse-notebook-document";
import {
  replaceNotebookCellAttributes,
  replaceNotebookCellSource,
  updateNotebookCellSourceRange,
} from "../notebook-cell-source";

describe("notebook cell source helpers", () => {
  test("replaces only the fenced source body", () => {
    const source = [
      "# Notebook",
      "",
      ':::cell{#query lang="sql"}',
      "```sql",
      "SELECT path",
      "FROM lapis.notes",
      "```",
      ":::",
    ].join("\n");

    const document = parseNotebookDocument(source, {
      sourcePath: "helpers.notebook.md",
    });
    const cell = document.cells[0]!;

    const next = replaceNotebookCellSource(
      source,
      cell,
      ["SELECT name", "FROM lapis.notes", "ORDER BY name"].join("\n"),
    );

    expect(next).toContain(
      "```sql\nSELECT name\nFROM lapis.notes\nORDER BY name\n```",
    );
    expect(next).toContain(':::cell{#query lang="sql"}');
    expect(next).toContain(":::");
  });

  test("replaces only the raw markdown body", () => {
    const source = [
      ':::cell{#summary lang="md"}',
      "## Original",
      "",
      "Body",
      ":::",
    ].join("\n");

    const document = parseNotebookDocument(source, {
      sourcePath: "helpers.notebook.md",
    });
    const cell = document.cells[0]!;

    const next = replaceNotebookCellSource(source, cell, "## Updated\n\nBody");

    expect(next).toBe(
      [':::cell{#summary lang="md"}', "## Updated", "", "Body", ":::"].join(
        "\n",
      ),
    );
  });

  test("extends the local source range after an edit", () => {
    const nextRange = updateNotebookCellSourceRange(
      {
        startOffset: 10,
        endOffset: 20,
        startLine: 4,
        endLine: 5,
      },
      "SELECT\n  1\nFROM dual",
    );

    expect(nextRange.endOffset).toBe(30);
    expect(nextRange.endLine).toBe(6);
  });

  test("replaces only the directive attributes", () => {
    const source = [
      "# Notebook",
      "",
      ':::cell{#query lang="sql" run=lazy}',
      "```sql",
      "SELECT path",
      "FROM lapis.notes",
      "```",
      ":::",
    ].join("\n");

    const document = parseNotebookDocument(source, {
      sourcePath: "helpers.notebook.md",
    });
    const cell = document.cells[0]!;

    const next = replaceNotebookCellAttributes(source, cell, {
      ...cell.attributes,
      folded: true,
      outputFolded: true,
    });

    expect(next).toContain(
      ':::cell{#query lang="sql" run=lazy folded outputFolded}',
    );
    expect(next).toContain("```sql\nSELECT path\nFROM lapis.notes\n```");
    expect(next).toContain(":::");
  });
});
