<script lang="ts">
  import { javascript } from "@codemirror/lang-javascript";
  import { markdown } from "@codemirror/lang-markdown";
  import { sql } from "@codemirror/lang-sql";
  import { syntaxHighlighting } from "@codemirror/language";
  import { EditorState, type Extension } from "@codemirror/state";
  import { EditorView } from "@codemirror/view";
  // Standard lezer classHighlighter replaces the API-internal copy (same cm-*
  // tag classes), matching the cell source editor adaptation.
  import { classHighlighter } from "@lezer/highlight";
  import type { NotebookCellLanguage } from "../model/notebook-cell";

  let {
    source,
    lang,
    class: className = "",
  }: {
    source: string;
    lang: NotebookCellLanguage;
    class?: string;
  } = $props();

  let surface = $state<HTMLDivElement | null>(null);
  let editorView = $state<EditorView | null>(null);

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
    return [
      syntaxHighlighting(classHighlighter),
      resolveLanguageExtension(lang),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ tabindex: "-1", spellcheck: "false" }),
      EditorView.editorAttributes.of({
        class: "mod-cm6 mod-inline mod-notebook-dependency-snippet",
      }),
    ];
  }

  $effect(() => {
    if (!surface) {
      return;
    }

    const nextEditor = new EditorView({
      parent: surface,
      state: EditorState.create({
        doc: source,
        extensions: createExtensions(),
      }),
    });

    editorView = nextEditor;

    return () => {
      if (editorView === nextEditor) {
        editorView = null;
      }
      nextEditor.destroy();
    };
  });
</script>

<div
  bind:this={surface}
  class={`notebook-dependency-snippet ${className}`.trim()}
></div>
