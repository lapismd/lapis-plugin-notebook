import { type WorkspaceLeaf } from "@lapis-notes/api";
import { MarkdownView } from "@lapis-notes/markdown";

export const NotebookViewType = "notebook";

/**
 * Stage 2 notebook surface: subclasses the published Markdown view so
 * `.notebook.md` documents open with the standard source, live-preview, and
 * reading modes exactly like the legacy plugin. Cell chrome, header actions,
 * pane menus, and execution wiring arrive with the render and runtime stages
 * per `spec/src/plugins/notebook/runtime.md`.
 */
export class NotebookView extends MarkdownView {
  constructor(leaf?: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string {
    return NotebookViewType;
  }

  load(): void {
    super.load();
    this.containerEl.classList.add("notebook-view");
  }
}
