import {
  EditorSuggest,
  type App,
  type Editor,
  type EditorPosition,
  type EditorSuggestContext,
  type TFile,
} from "@lapis-notes/api";
import { isNotebookFile } from "../notebook-file";
import {
  buildCellTemplate,
  labelForCellLanguage,
  type NotebookCellLanguage,
} from "../templates/cells";

export interface NotebookCellSuggestion {
  language: NotebookCellLanguage;
  label: string;
  hint: string;
  aliases: readonly string[];
}

export const NOTEBOOK_CELL_SUGGESTIONS: readonly NotebookCellSuggestion[] = [
  {
    language: "ts",
    label: "Notebook code cell",
    hint: "/code",
    aliases: ["code", "ts", "typescript", "javascript", "js"],
  },
  {
    language: "sql",
    label: "Notebook SQL cell",
    hint: "/sql",
    aliases: ["sql", "query", "duckdb"],
  },
  {
    language: "input",
    label: "Notebook input cell",
    hint: "/input",
    aliases: ["input", "control"],
  },
  {
    language: "md",
    label: "Notebook markdown cell",
    hint: "/markdown",
    aliases: ["markdown", "md", "text"],
  },
  {
    language: "html",
    label: "Notebook HTML cell",
    hint: "/html",
    aliases: ["html"],
  },
];

export class NotebookCellSuggest extends EditorSuggest<NotebookCellSuggestion> {
  constructor(app: App) {
    super(app);
  }

  onTrigger(cursor: EditorPosition, editor: Editor, file: TFile | null) {
    if (!isNotebookFile(file)) {
      return null;
    }

    const linePrefix = editor.getLine(cursor.line).slice(0, cursor.ch);
    const match = /^\s*\/([A-Za-z-]*)$/u.exec(linePrefix);
    if (!match) {
      return null;
    }

    return {
      start: { line: cursor.line, ch: 0 },
      end: cursor,
      query: match[1].toLowerCase(),
    };
  }

  getSuggestions(context: EditorSuggestContext): NotebookCellSuggestion[] {
    const query = context.query.trim().toLowerCase();
    if (!query) {
      return [...NOTEBOOK_CELL_SUGGESTIONS];
    }

    return NOTEBOOK_CELL_SUGGESTIONS.filter(
      (suggestion) =>
        suggestion.aliases.some((alias) => alias.startsWith(query)) ||
        suggestion.label.toLowerCase().includes(query),
    );
  }

  renderSuggestion(suggestion: NotebookCellSuggestion, el: HTMLElement): void {
    const label = document.createElement("span");
    label.textContent = suggestion.label;
    el.append(label);

    const hint = document.createElement("span");
    hint.className = "suggestion-flair";
    hint.textContent = suggestion.hint;
    el.append(hint);
  }

  selectSuggestion(suggestion: NotebookCellSuggestion): void {
    const context = this.context;
    if (!context) {
      return;
    }

    const template = buildCellTemplate(suggestion.language);
    context.editor.replaceRange(
      `${template}\n`,
      context.start,
      context.end,
      "notebook-cell-suggest",
    );
  }
}
