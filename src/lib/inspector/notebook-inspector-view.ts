import { ItemView, type Menu, type WorkspaceLeaf } from "@lapis-notes/api";
import type { NotebookPlugin } from "../notebook-plugin";
import {
  mountLocalComponent,
  type LocalMountComponent,
} from "../mount-local-component.svelte";
import type {
  NotebookInspectorSnapshot,
  NotebookInspectorTable,
} from "./notebook-inspector-data";
import NotebookInspectorPanel from "./notebook-inspector-panel.svelte";

export const NotebookInspectorViewType = "notebook-session";

export interface NotebookInspectorRefreshableView {
  refreshView(): Promise<void>;
}

export class NotebookInspectorView
  extends ItemView
  implements NotebookInspectorRefreshableView
{
  private overlay: LocalMountComponent<Record<string, unknown>> | null = null;
  private unregisterView: (() => void) | null = null;

  constructor(
    leaf: WorkspaceLeaf | undefined,
    private readonly plugin: NotebookPlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return NotebookInspectorViewType;
  }

  getDisplayText(): string {
    return "Variables";
  }

  getIcon(): string {
    return "variable";
  }

  protected onOpen(): Promise<void> {
    return Promise.resolve();
  }

  protected onClose(): Promise<void> {
    return Promise.resolve();
  }

  onload(): void {
    this.contentEl.empty();
    this.contentEl.style.display = "flex";
    this.contentEl.style.flexDirection = "column";
    this.contentEl.style.height = "100%";
    this.contentEl.style.minHeight = "0";
    this.contentEl.style.padding = "0";
    this.contentEl.style.backgroundColor = getComputedStyle(
      document.body,
    ).backgroundColor;

    this.overlay = mountLocalComponent(NotebookInspectorPanel, {
      target: this.contentEl,
      props: {
        snapshot: null as NotebookInspectorSnapshot | null,
        loading: true,
        onNavigateToCell: (cellId: string) => {
          const snapshot = this.overlay?.props
            .snapshot as NotebookInspectorSnapshot | null;
          if (!snapshot) {
            return;
          }
          return this.plugin.revealNotebookCell(snapshot.sourcePath, cellId);
        },
        onLoadTablePreview: (table: NotebookInspectorTable) => {
          const snapshot = this.overlay?.props
            .snapshot as NotebookInspectorSnapshot | null;
          if (!snapshot) {
            return Promise.resolve(null);
          }
          return this.plugin.loadNotebookInspectorTablePreview(
            snapshot.sourcePath,
            table.schema,
            table.name,
            table.rowCount,
          );
        },
      },
    });

    this.unregisterView = this.plugin.registerNotebookInspectorView(this);
    void this.refreshView();
  }

  onunload(): void {
    this.unregisterView?.();
    this.unregisterView = null;
    this.overlay?.destroy();
    this.overlay = null;
  }

  async refreshView(): Promise<void> {
    if (!this.overlay) {
      return;
    }

    this.overlay.props.loading = true;
    try {
      this.overlay.props.snapshot = await this.plugin.getNotebookInspectorSnapshot();
    } catch (error) {
      // Degrade instead of rejecting: refreshView is invoked with void from
      // workspace lifecycle events, and DuckDB/registry probing can fail on
      // hosts without resolvable engine assets or network access.
      console.warn("[notebook.panel] refresh failed", error);
      this.overlay.props.snapshot = null;
    } finally {
      this.overlay.props.loading = false;
    }
  }

  onPaneMenu(menu: Menu): void {
    menu.addItem((item) => {
      item
        .setTitle("Refresh notebook session")
        .setIcon("refresh-cw")
        .onClick(() => {
          void this.refreshView();
        });
    });
  }
}
