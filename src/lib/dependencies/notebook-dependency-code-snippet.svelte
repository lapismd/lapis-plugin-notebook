<script lang="ts">
  import { javascript } from "@codemirror/lang-javascript";
  import { markdown } from "@codemirror/lang-markdown";
  import { sql } from "@codemirror/lang-sql";
  import { syntaxHighlighting } from "@codemirror/language";
  import { EditorState, type Extension } from "@codemirror/state";
  import { EditorView } from "@codemirror/view";
  // Mira scopes its CodeMirror token colors to cm-* classes; its public
  // class highlighter produces them (the standard lezer one emits tok-*).
  import { miraClassHighlighter as classHighlighter } from "@lapismd/mira/codemirror";
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
      // Mira scopes its CodeMirror token colors under .mira-code-editor;
      // opt the read-only snippet into the same scope.
      EditorView.editorAttributes.of({ class: "mira-code-editor" }),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({
        tabindex: "-1",
        spellcheck: "false",
        // Read-only CodeMirror renders role=textbox; name it for axe
        // (aria-input-field-name) since no visible <label> is associated.
        "aria-label": `${lang} cell source (read-only)`,
      }),
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
