import { describe, expect, it } from "vitest";
import {
  buildNotebookTypeScriptVirtualDocument,
  mapNotebookCellPositionToVirtual,
  mapVirtualRangeToNotebookCell,
} from "../language-service";
import type { NotebookDocument } from "../model";

describe("notebook language-service projection", () => {
  it("projects only TypeScript cells into one virtual document", () => {
    const document = createDocument();

    const virtualDocument = buildNotebookTypeScriptVirtualDocument(document, 7);

    expect(virtualDocument.languageId).toBe("typescript");
    expect(virtualDocument.version).toBe(7);
    expect(virtualDocument.text).toContain("const shared = 1;");
    expect(virtualDocument.text).toContain("console.log(shared);");
    expect(virtualDocument.text).not.toContain("select * from notes");
    expect(virtualDocument.segments.map((segment) => segment.cellId)).toEqual([
      "first",
      "third",
    ]);
  });

  it("maps cell positions to virtual positions and diagnostics back to cells", () => {
    const virtualDocument =
      buildNotebookTypeScriptVirtualDocument(createDocument());
    const virtualPosition = mapNotebookCellPositionToVirtual(
      virtualDocument,
      "third",
      { line: 0, character: 12 },
    );

    expect(virtualPosition).not.toBeNull();
    const mappedRange = mapVirtualRangeToNotebookCell(virtualDocument, {
      start: virtualPosition!,
      end: { line: virtualPosition!.line, character: 18 },
    });

    expect(mappedRange).toEqual({
      cellId: "third",
      start: { cellId: "third", line: 0, character: 12 },
      end: { cellId: "third", line: 0, character: 18 },
    });
  });
});

function createDocument(): NotebookDocument {
  return {
    enabled: true,
    sourcePath: "Example.notebook.md",
    frontmatter: null,
    source: "",
    blocks: [],
    cells: [
      {
        id: "first",
        lang: "ts",
        source: "const shared = 1;",
        range: { startOffset: 0, endOffset: 20, startLine: 1, endLine: 3 },
        sourceRange: {
          startOffset: 10,
          endOffset: 27,
          startLine: 2,
          endLine: 2,
        },
        attributes: { id: "first", lang: "ts" },
      },
      {
        id: "second",
        lang: "sql",
        source: "select * from notes",
        range: { startOffset: 21, endOffset: 42, startLine: 4, endLine: 6 },
        sourceRange: {
          startOffset: 31,
          endOffset: 50,
          startLine: 5,
          endLine: 5,
        },
        attributes: { id: "second", lang: "sql" },
      },
      {
        id: "third",
        lang: "ts",
        source: "console.log(shared);",
        range: { startOffset: 43, endOffset: 68, startLine: 7, endLine: 9 },
        sourceRange: {
          startOffset: 53,
          endOffset: 73,
          startLine: 8,
          endLine: 8,
        },
        attributes: { id: "third", lang: "ts" },
      },
    ],
  };
}
