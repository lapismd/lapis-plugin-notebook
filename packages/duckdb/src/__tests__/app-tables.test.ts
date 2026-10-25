import { describe, expect, test, vi } from "vitest";
import {
  NOTEBOOK_APP_TABLE_COLUMNS,
  registerNotebookAppTablesSnapshot,
  type NotebookAppTableRegistrar,
} from "..";

describe("notebook app table registration", () => {
  test("registers Lapis app tables with stable file names, schemas, and columns", async () => {
    const registerJsonTable =
      vi.fn<NotebookAppTableRegistrar["registerJsonTable"]>();
    const service = {
      registerJsonTable,
    } satisfies NotebookAppTableRegistrar;

    await registerNotebookAppTablesSnapshot(service, {
      notes: [{ path: "Note.md", frontmatter: { title: "Note" } }],
      links: [{ sourcePath: "Note.md", resolvedTargetPath: "Other.md" }],
      searchDocuments: [{ path: "Note.md", content: "Hello" }],
    });

    expect(registerJsonTable).toHaveBeenCalledTimes(3);
    expect(registerJsonTable).toHaveBeenNthCalledWith(
      1,
      "__lapis_notes.json",
      "lapis",
      "notes",
      [{ path: "Note.md", frontmatter: { title: "Note" } }],
      NOTEBOOK_APP_TABLE_COLUMNS.notes,
    );
    expect(registerJsonTable).toHaveBeenNthCalledWith(
      2,
      "__lapis_links.json",
      "lapis",
      "links",
      [{ sourcePath: "Note.md", resolvedTargetPath: "Other.md" }],
      NOTEBOOK_APP_TABLE_COLUMNS.links,
    );
    expect(registerJsonTable).toHaveBeenNthCalledWith(
      3,
      "__lapis_search_documents.json",
      "lapis",
      "search_documents",
      [{ path: "Note.md", content: "Hello" }],
      NOTEBOOK_APP_TABLE_COLUMNS.searchDocuments,
    );
  });
});
