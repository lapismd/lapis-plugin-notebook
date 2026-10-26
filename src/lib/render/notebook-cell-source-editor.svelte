<script lang="ts">
  import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
  import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
  import { javascript } from "@codemirror/lang-javascript";
  import { markdown } from "@codemirror/lang-markdown";
  import { sql } from "@codemirror/lang-sql";
  import {
    bracketMatching,
    indentOnInput,
    syntaxHighlighting,
  } from "@codemirror/language";
  import { EditorState, type Extension } from "@codemirror/state";
  import { highlightSelectionMatches } from "@codemirror/search";
  import {
    drawSelection,
    EditorView,
    highlightActiveLine,
    highlightActiveLineGutter,
    highlightSpecialChars,
    keymap,
    lineNumbers,
  } from "@codemirror/view";
  import {
    languageServiceDocumentContext,
    languageServiceExtensions,
  } from "@lapis-notes/api/editor/language-service";
  // The legacy api/editor/extensions/class-highlighter copy is internal in the
  // current API; the standard lezer classHighlighter produces the same cm-*
  // tag classes the notebook editor theme styles.
  import { classHighlighter } from "@lezer/highlight";
  import {
    buildNotebookTypeScriptVirtualDocument,
    mapNotebookCellPositionToVirtual,
    mapVirtualRangeToNotebookCell,
  } from "@lapis-notes/notebook-core/language-service";
  import type { NotebookCellLanguage } from "../model/notebook-cell";
  import { parseNotebookDocument } from "../parse/parse-notebook-document";
  import { replaceNotebookCellSource } from "./notebook-cell-source";

  type Props = {
    value: string;
    lang: NotebookCellLanguage;
    startLine: number;
    sourcePath: string;
    cellId: string;
    getDocumentSource?: () => string;
    onCommit?: (value: string) => boolean | Promise<boolean>;
  };

  let {
    value,
    lang,
    startLine,
    sourcePath,
    cellId,
    getDocumentSource,
    onCommit,
  }: Props = $props();

  let surface = $state<HTMLDivElement | null>(null);
  let editorView = $state<EditorView | null>(null);
  let committing = $state(false);

  function resolveLanguageExtension(language: NotebookCellLanguage): Extension {
    switch (language) {
      case "js":
        return javascript();
      case "md":
      case "html":
        return markdown();
      case "sql":
        return sql();
      case "ts":
      default:
        return javascript({ typescript: true });
    }
  }

  function createExtensions(): Extension[] {
    const languageService =
      lang === "ts"
        ? [
            languageServiceDocumentContext.of({
              document: () => {
                const projection = buildProjection();
                return {
                  uri: projection.uri,
                  languageId: projection.languageId,
                  version: projection.version,
                  text: projection.text,
                };
              },
              toVirtualPosition: (position) =>
                mapNotebookCellPositionToVirtual(
                  buildProjection(),
                  cellId,
                  position,
                ),
              fromVirtualRange: (range) => {
                const mapped = mapVirtualRangeToNotebookCell(
                  buildProjection(),
                  range,
                );
                if (!mapped || mapped.cellId !== cellId) {
                  return null;
                }
                return {
                  start: {
                    line: mapped.start.line,
                    character: mapped.start.character,
                  },
                  end: {
                    line: mapped.end.line,
                    character: mapped.end.character,
                  },
                };
              },
            }),
            languageServiceExtensions({ languageId: "typescript" }),
          ]
        : [];
    return [
      lineNumbers({
        formatNumber: (lineNumber) => `${startLine + lineNumber - 1}`,
      }),
      highlightActiveLineGutter(),
      highlightSpecialChars(),
      history(),
      drawSelection(),
      indentOnInput(),
      syntaxHighlighting(classHighlighter),
      bracketMatching(),
      closeBrackets(),
      highlightActiveLine(),
      highlightSelectionMatches(),
      resolveLanguageExtension(lang),
      EditorView.lineWrapping,
      EditorView.editorAttributes.of({
        class: "mod-cm6 mod-inline mod-notebook-cell-inline-editor",
      }),
      ...languageService,
      keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...historyKeymap]),
    ];
  }

  function resolveDocumentSource(currentCellSource: string): string {
    const activeSource = getDocumentSource?.() ?? "";
    if (!activeSource) {
      return `:::cell{#${cellId} lang="ts"}\n${currentCellSource}\n:::`;
    }
    const document = parseNotebookDocument(activeSource, { sourcePath });
    const activeCell = document.cells.find((cell) => cell.id === cellId);
    if (!activeCell) {
      return activeSource;
    }
    return replaceNotebookCellSource(
      activeSource,
      activeCell,
      currentCellSource,
    );
  }

  function buildProjection() {
    const currentCellSource = editorView?.state.doc.toString() ?? value;
    const document = parseNotebookDocument(
      resolveDocumentSource(currentCellSource),
      { sourcePath },
    );
    return buildNotebookTypeScriptVirtualDocument(
      document,
      editorView?.state.doc.length ?? value.length,
    );
  }
  function mountEditor(node: HTMLDivElement) {
    editorView = new EditorView({
      parent: node,
      state: EditorState.create({
        doc: value,
        extensions: createExtensions(),
      }),
    });

    queueMicrotask(() => {
      editorView?.focus();
    });

    return {
      destroy() {
        editorView?.destroy();
        editorView = null;
      },
    };
  }

  async function commit(): Promise<void> {
    if (committing) {
      return;
    }

    committing = true;
    const nextValue = editorView?.state.doc.toString() ?? value;
    const committed = await (onCommit?.(nextValue) ?? true);
    committing = false;

    if (!committed) {
      editorView?.focus();
    }
  }

  function handleFocusOut(event: FocusEvent): void {
    const nextTarget = event.relatedTarget;
    if (nextTarget instanceof Node && surface?.contains(nextTarget)) {
      return;
    }

    void commit();
  }
</script>

<div
  bind:this={surface}
  class="notebook-cell__editor"
  onfocusout={handleFocusOut}
>
  <div
    use:mountEditor
    class="notebook-cell__editor-cm"
  ></div>
</div>
