import { ItemView, type Menu, type WorkspaceLeaf } from "@lapis-notes/api";
import type { NotebookPlugin } from "../notebook-plugin";
import {
  mountLocalComponent,
  type LocalMountComponent,
} from "../mount-local-component.svelte";
import type { NotebookDependencySnapshot } from "./notebook-dependencies-data";
import NotebookDependenciesPanel from "./notebook-dependencies-panel.svelte";

export const NotebookDependenciesViewType = "notebook-dependencies";

export interface NotebookDependenciesRefreshableView {
  refreshView(): Promise<void>;
}

export class NotebookDependenciesView
  extends ItemView
  implements NotebookDependenciesRefreshableView
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
    return NotebookDependenciesViewType;
  }

  getDisplayText(): string {
    return "Dependencies";
  }

  getIcon(): string {
    return "workflow";
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

    this.overlay = mountLocalComponent(NotebookDependenciesPanel, {
      target: this.contentEl,
      props: {
        snapshot: null as NotebookDependencySnapshot | null,
        loading: true,
        settings: this.plugin.getSettings(),
        onNavigateToCell: (cellId: string) => {
          const snapshot = this.overlay?.props
            .snapshot as NotebookDependencySnapshot | null;
          if (!snapshot) {
            return;
          }
          return this.plugin.revealNotebookCell(snapshot.sourcePath, cellId);
        },
        onUpdateSettings: (patch: unknown) => {
          return this.plugin.updateSettings(patch as never);
        },
      },
    });

    this.unregisterView = this.plugin.registerNotebookDependenciesView(this);
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
    this.overlay.props.settings = this.plugin.getSettings();
    try {
      this.overlay.props.snapshot = await this.plugin.getNotebookDependencySnapshot();
    } catch (error) {
      // Degrade instead of rejecting: refreshView is invoked with void from
      // workspace lifecycle events, and probing can fail on hosts without
      // resolvable engine assets or network access.
      console.warn("[notebook.panel] refresh failed", error);
      this.overlay.props.snapshot = null;
    } finally {
      this.overlay.props.loading = false;
    }
  }

  onPaneMenu(menu: Menu): void {
    menu.addItem((item) => {
      item
        .setTitle("Refresh notebook dependencies")
        .setIcon("refresh-cw")
        .onClick(() => {
          void this.refreshView();
        });
    });
  }
}
