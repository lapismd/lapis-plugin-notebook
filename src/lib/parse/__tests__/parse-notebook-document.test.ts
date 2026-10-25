import { describe, expect, test } from "vitest";
import { parseNotebookDocument } from "../parse-notebook-document";

describe("parseNotebookDocument", () => {
  test("parses a mixed notebook note into prose and cells", () => {
    const source = [
      "---",
      "notebook:",
      "  version: 1",
      "  autorun: true",
      "  mode: lazy",
      "  mounts:",
      "    notes: app://notes",
      "---",
      "",
      "# Weekly Review",
      "",
      "Ordinary prose before cells.",
      "",
      ':::cell{#load-data lang="ts" run=autorun}',
      "```ts",
      'const selectedFolder = "Projects";',
      "```",
      ":::",
      "",
      ':::cell{#matching-notes lang="sql"}',
      "```sql",
      "SELECT path, name",
      "FROM notes",
      "WHERE path LIKE {{selectedFolder}} || '/%'",
      "ORDER BY name",
      "```",
      ":::",
      "",
      ':::cell{#report lang="md"}',
      "## Matching Notes",
      "",
      "Folder: `{{selectedFolder}}`",
      ":::",
      "",
      "Closing prose.",
    ].join("\n");

    const document = parseNotebookDocument(source, {
      sourcePath: "Weekly Review.notebook.md",
    });

    expect(document.enabled).toBe(true);
    expect(document.frontmatter).toEqual({
      version: 1,
      autorun: true,
      mode: "lazy",
      mounts: { notes: "app://notes" },
    });
    expect(document.cells.map((cell) => [cell.id, cell.lang])).toEqual([
      ["load-data", "ts"],
      ["matching-notes", "sql"],
      ["report", "md"],
    ]);
    expect(document.cells[0]?.source).toBe(
      'const selectedFolder = "Projects";',
    );
    expect(document.cells[0]?.sourceRange.startLine).toBe(16);
    expect(document.cells[0]?.sourceRange.endLine).toBe(16);
    expect(document.cells[1]?.source).toContain(
      "WHERE path LIKE {{selectedFolder}}",
    );
    expect(document.cells[1]?.sourceRange.startLine).toBe(22);
    expect(document.cells[1]?.sourceRange.endLine).toBe(25);
    expect(document.cells[2]?.source).toContain("## Matching Notes");
    expect(document.cells[2]?.sourceRange.startLine).toBe(30);
    expect(document.cells[2]?.sourceRange.endLine).toBe(32);
    expect(document.blocks.map((block) => block.kind)).toEqual([
      "markdown",
      "cell",
      "cell",
      "cell",
      "markdown",
    ]);
  });

  test("returns a disabled document for ordinary notes", () => {
    const document = parseNotebookDocument("# Plain note\n\nJust markdown.", {
      sourcePath: "Plain note.md",
    });

    expect(document.enabled).toBe(false);
    expect(document.cells).toEqual([]);
    expect(document.blocks).toEqual([]);
  });

  test("falls back to generated cell ids when they are omitted", () => {
    const source = [
      ':::cell{lang="ts"}',
      "```ts",
      "const value = 1;",
      "```",
      ":::",
    ].join("\n");

    const document = parseNotebookDocument(source, {
      sourcePath: "Scratch.notebook.md",
    });

    expect(document.cells[0]?.id).toBe("cell-1");
    expect(document.cells[0]?.source).toBe("const value = 1;");
    expect(document.cells[0]?.sourceRange.startLine).toBe(3);
    expect(document.cells[0]?.sourceRange.endLine).toBe(3);
    expect(document.frontmatter).toEqual({
      version: 1,
      mode: "lazy",
      mounts: {},
    });
  });

  test("infers the cell language from a fenced body when the directive omits lang", () => {
    const source = [
      ":::cell{#query}",
      "```sql",
      "SELECT path",
      "FROM lapis.notes",
      "```",
      ":::",
    ].join("\n");

    const document = parseNotebookDocument(source, {
      sourcePath: "Scratch.notebook.md",
    });

    expect(document.cells[0]?.lang).toBe("sql");
    expect(document.cells[0]?.source).toBe(
      ["SELECT path", "FROM lapis.notes"].join("\n"),
    );
    expect(document.cells[0]?.sourceRange.startLine).toBe(3);
    expect(document.cells[0]?.sourceRange.endLine).toBe(4);
  });

  test("unwraps fenced code when the cell body has surrounding blank lines", () => {
    const source = [
      ':::cell{#setup lang="ts"}',
      "",
      "```ts",
      'const selectedRegion = "North";',
      "```",
      "",
      ":::",
    ].join("\n");

    const document = parseNotebookDocument(source, {
      sourcePath: "Scratch.notebook.md",
    });

    expect(document.cells[0]?.lang).toBe("ts");
    expect(document.cells[0]?.source).toBe('const selectedRegion = "North";');
    expect(document.cells[0]?.sourceRange.startLine).toBe(4);
    expect(document.cells[0]?.sourceRange.endLine).toBe(4);
  });

  test("keeps raw markdown cell source lines when the body is not fenced", () => {
    const source = [
      ':::cell{#report lang="md"}',
      "## Matching Notes",
      "",
      "Folder: `{{selectedFolder}}`",
      ":::",
    ].join("\n");

    const document = parseNotebookDocument(source, {
      sourcePath: "Scratch.notebook.md",
    });

    expect(document.cells[0]?.source).toContain("## Matching Notes");
    expect(document.cells[0]?.sourceRange.startLine).toBe(2);
    expect(document.cells[0]?.sourceRange.endLine).toBe(4);
  });

  test("recognizes HTML cells as first-class notebook cells", () => {
    const source = [
      ':::cell{#card lang="html"}',
      "```html",
      "<strong>${selectedName}</strong>",
      "```",
      ":::",
    ].join("\n");

    const document = parseNotebookDocument(source, {
      sourcePath: "Scratch.notebook.md",
    });

    expect(document.cells[0]?.lang).toBe("html");
    expect(document.cells[0]?.source).toBe("<strong>${selectedName}</strong>");
    expect(document.cells[0]?.sourceRange.startLine).toBe(3);
    expect(document.cells[0]?.sourceRange.endLine).toBe(3);
  });

  test("infers HTML cells from fenced source", () => {
    const source = [
      ":::cell{#card}",
      "```html",
      "<span>Ready</span>",
      "```",
      ":::",
    ].join("\n");

    const document = parseNotebookDocument(source, {
      sourcePath: "Scratch.notebook.md",
    });

    expect(document.cells[0]?.lang).toBe("html");
    expect(document.cells[0]?.source).toBe("<span>Ready</span>");
  });

  test("normalizes persisted collapse attributes", () => {
    const source = [
      ':::cell{#summary lang="md" folded outputFolded}',
      "## Matching Notes",
      ":::",
    ].join("\n");

    const document = parseNotebookDocument(source, {
      sourcePath: "Scratch.notebook.md",
    });

    expect(document.cells[0]?.attributes.folded).toBe(true);
    expect(document.cells[0]?.attributes.outputFolded).toBe(true);
  });

  test("falls back to global autorun when notebook frontmatter omits it", () => {
    const source = [
      "---",
      "notebook:",
      "  version: 1",
      "---",
      "",
      ':::cell{#summary lang="md"}',
      "Hello",
      ":::",
    ].join("\n");

    const document = parseNotebookDocument(source, {
      sourcePath: "Scratch.notebook.md",
    });

    expect(document.frontmatter).toEqual({
      version: 1,
      mode: "lazy",
      mounts: {},
    });
  });
});
