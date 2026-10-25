import { describe, expect, test, vi } from "vitest";

vi.mock("@lapis-notes/api", () => ({
  EditorSuggest: class {
    context: unknown = null;
  },
  Notice: class {},
}));

import {
  NotebookCellSuggest,
  type NotebookCellSuggestion,
} from "../notebook-cell-suggest";

function createSuggest(): NotebookCellSuggest {
  return new NotebookCellSuggest({} as any);
}

function createNotebookFile(path = "Notes/Demo.notebook.md") {
  return { path } as any;
}

describe("NotebookCellSuggest", () => {
  test("only triggers slash cell suggestions in notebook files", () => {
    const suggest = createSuggest();
    const editor = {
      getLine: vi.fn(() => "/sq"),
    } as any;

    expect(
      suggest.onTrigger({ line: 0, ch: 3 }, editor, createNotebookFile()),
    ).toEqual({
      start: { line: 0, ch: 0 },
      end: { line: 0, ch: 3 },
      query: "sq",
    });
    expect(
      suggest.onTrigger(
        { line: 0, ch: 3 },
        editor,
        createNotebookFile("Notes/Demo.md"),
      ),
    ).toBeNull();
  });

  test("filters suggestions by slash aliases", () => {
    const suggest = createSuggest();
    const suggestions = suggest.getSuggestions({
      query: "du",
      file: null,
    } as any);

    expect(suggestions.map((item) => item.language)).toEqual(["sql"]);
  });

  test("inserts the selected canonical cell template", () => {
    const suggest = createSuggest();
    const editor = {
      replaceRange: vi.fn(),
    } as any;
    suggest.context = {
      editor,
      file: createNotebookFile(),
      start: { line: 2, ch: 0 },
      end: { line: 2, ch: 6 },
      query: "input",
    } as any;

    suggest.selectSuggestion({ language: "input" } as NotebookCellSuggestion);

    expect(editor.replaceRange).toHaveBeenCalledWith(
      expect.stringContaining('lang="ts"'),
      { line: 2, ch: 0 },
      { line: 2, ch: 6 },
      "notebook-cell-suggest",
    );
    expect(editor.replaceRange.mock.calls[0][0]).toContain(
      "const gain = view(Inputs.range",
    );
  });
});
