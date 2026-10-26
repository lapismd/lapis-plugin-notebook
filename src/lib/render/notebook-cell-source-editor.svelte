<script lang="ts">
  import { javascript } from "@codemirror/lang-javascript";
  import { markdown } from "@codemirror/lang-markdown";
  import { sql } from "@codemirror/lang-sql";
  import { EditorState, type Extension } from "@codemirror/state";
  import { EditorView, lineNumbers } from "@codemirror/view";
  import type { App } from "@lapis-notes/api";
  import { editorConfig, markupEditor } from "@lapis-notes/api/editor/core";
  // Side-effect import: the api editor module owns editor.css, which styles
  // the `cm-editor-source` host surface this cell editor renders into. It is
  // otherwise only loaded by source-mode markdown views.
  import "@lapis-notes/api/editor";
  import {
    languageServiceDocumentContext,
    languageServiceExtensions,
  } from "@lapis-notes/api/editor/language-service";
  import {
    buildNotebookTypeScriptVirtualDocument,
    mapNotebookCellPositionToVirtual,
    mapVirtualRangeToNotebookCell,
  } from "@lapis-notes/notebook-core/language-service";
  import type { NotebookCellLanguage } from "../model/notebook-cell";
  import { parseNotebookDocument } from "../parse/parse-notebook-document";
  import { replaceNotebookCellSource } from "./notebook-cell-source";

  type Props = {
    app: App;
    value: string;
    lang: NotebookCellLanguage;
    startLine: number;
    sourcePath: string;
    cellId: string;
    getDocumentSource?: () => string;
    onCommit?: (value: string) => boolean | Promise<boolean>;
  };

  let {
    app,
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

    // The cell editor is a Lapis markup-editor surface: the host factory
    // supplies the Mira base extensions, theme, keymaps, live configuration
    // compartments, and `cm-editor-source` styling (the same wrapping the
    // CSV/source-editor plugins use). Notebook-owned layers add the cell
    // language, the absolute-document line-number gutter, the TypeScript
    // virtual-document projection, and the inline-editor identity classes.
    return [
      markupEditor(
        {
          language: lang === "html" ? "markdown" : lang,
          app,
        },
        resolveLanguageExtension(lang),
        EditorView.editorAttributes.of({
          class: "mod-inline mod-notebook-cell-inline-editor",
        }),
        ...languageService,
      ),
      lineNumbers({
        formatNumber: (lineNumber) => `${startLine + lineNumber - 1}`,
      }),
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

    // The notebook gutter shows absolute document lines; suppress the
    // configuration-driven relative gutter for this view only.
    editorConfig.update(
      editorView,
      "editor.display.showLineNumbers",
      false,
      app,
    );

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
