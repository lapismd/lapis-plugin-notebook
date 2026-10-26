import { describe, expect, test } from "vitest";
import { parseNotebookDocument } from "../../parse/parse-notebook-document";
import { NotebookSession } from "../../runtime/notebook-session";
import { buildNotebookDependencySnapshot } from "../notebook-dependencies-data";

function createNotebook(source: string) {
  return parseNotebookDocument(source, {
    sourcePath: "Notebook.notebook.md",
    frontmatter: { version: 1, mode: "lazy" },
  });
}

function createFile() {
  return {
    path: "Notebook.notebook.md",
    basename: "Notebook.notebook.md",
  };
}

describe("notebook dependencies data", () => {
  test("builds direct edges, transitive relationships, and variable mapping", () => {
    const document = createNotebook(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'const selectedFolder = "Projects";',
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
        "Folder: {{selectedFolder}}",
        ":::",
        "",
        ':::cell{#report lang="ts"}',
        "```ts",
        "const rowCount = query.length;",
        "lapis.markdown(`Rows: ${rowCount}`);",
        "```",
        ":::",
      ].join("\n"),
    );
    const session = new NotebookSession(document);

    const snapshot = buildNotebookDependencySnapshot({
      file: createFile(),
      document,
      graph: session.graph,
      getCellState: (cellId) => session.getCellState(cellId),
    });

    expect(snapshot.edges).toEqual([
      {
        id: "load->query",
        source: "load",
        target: "query",
        variables: ["selectedFolder"],
      },
      {
        id: "load->summary",
        source: "load",
        target: "summary",
        variables: ["selectedFolder"],
      },
      {
        id: "query->report",
        source: "query",
        target: "report",
        variables: ["query"],
      },
    ]);

    expect(snapshot.cells).toEqual([
      expect.objectContaining({
        id: "load",
        declaredVariables: ["selectedFolder"],
        referencedVariables: [],
        parents: [],
        children: ["query", "summary"],
        ancestors: [],
        descendants: ["query", "summary", "report"],
        hasUpstream: false,
        hasDownstream: true,
        isReferenceable: true,
      }),
      expect.objectContaining({
        id: "query",
        declaredVariables: [],
        referencedVariables: ["selectedFolder"],
        parents: ["load"],
        children: ["report"],
        ancestors: ["load"],
        descendants: ["report"],
      }),
      expect.objectContaining({
        id: "summary",
        declaredVariables: [],
        referencedVariables: ["selectedFolder"],
        parents: ["load"],
        children: [],
        ancestors: ["load"],
        descendants: [],
      }),
      expect.objectContaining({
        id: "report",
        declaredVariables: ["rowCount"],
        referencedVariables: ["query"],
        parents: ["query"],
        children: [],
        ancestors: ["load", "query"],
        descendants: [],
      }),
    ]);
  });

  test("marks duplicate definitions, cycles, and runtime state", () => {
    const document = createNotebook(
      [
        ':::cell{#a lang="ts"}',
        "```ts",
        "const shared = 1;",
        "```",
        ":::",
        "",
        ':::cell{#b lang="ts"}',
        "```ts",
        "const shared = 2;",
        "```",
        ":::",
        "",
        ':::cell{#c lang="md"}',
        "{{d}}",
        ":::",
        "",
        ':::cell{#d lang="md"}',
        "{{c}}",
        ":::",
      ].join("\n"),
    );
    const session = new NotebookSession(document);
    session.setCellError("d", "Cycle hit during render");

    const snapshot = buildNotebookDependencySnapshot({
      file: createFile(),
      document,
      graph: session.graph,
      getCellState: (cellId) => session.getCellState(cellId),
    });

    expect(snapshot.duplicateDefinitions).toEqual([
      { name: "shared", cellIds: ["a", "b"] },
    ]);
    expect(snapshot.cycles).toEqual([{ cellIds: ["c", "d"] }]);
    expect(snapshot.cells.find((cell) => cell.id === "a")).toEqual(
      expect.objectContaining({
        hasDuplicateDefinitions: true,
        isIsolatedDefinition: true,
      }),
    );
    expect(snapshot.cells.find((cell) => cell.id === "d")).toEqual(
      expect.objectContaining({
        state: "error",
        error: "Cycle hit during render",
        isCycleMember: true,
      }),
    );
  });

  test("treats markdown-like unconnected cells as non-referenceable", () => {
    const document = createNotebook(
      [':::cell{#notes lang="md"}', "This is prose only.", ":::"].join("\n"),
    );
    const session = new NotebookSession(document);

    const snapshot = buildNotebookDependencySnapshot({
      file: createFile(),
      document,
      graph: session.graph,
      getCellState: (cellId) => session.getCellState(cellId),
    });

    expect(snapshot.cells).toEqual([
      expect.objectContaining({
        id: "notes",
        declaredVariables: [],
        referencedVariables: [],
        hasUpstream: false,
        hasDownstream: false,
        isReferenceable: false,
        isIsolatedDefinition: false,
      }),
    ]);
  });
});
