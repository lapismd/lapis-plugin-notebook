import { ItemView, type Menu, type WorkspaceLeaf } from "@lapis-notes/api";
import type { NotebookUserDependencyDescriptor } from "@lapis-notes/notebook-stdlib";
import type { NotebookPlugin } from "../notebook-plugin";
import {
  mountLocalComponent,
  type LocalMountComponent,
} from "../mount-local-component.svelte";
import type { NotebookPackageSearchResult } from "./notebook-package-registry";
import type { NotebookPackagesSnapshot } from "./notebook-packages-data";
import NotebookPackagesPanel from "./notebook-packages-panel.svelte";

export const NotebookPackagesViewType = "notebook-packages";

export interface NotebookPackagesRefreshableView {
  refreshView(): Promise<void>;
}

export class NotebookPackagesView
  extends ItemView
  implements NotebookPackagesRefreshableView
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
    return NotebookPackagesViewType;
  }

  getDisplayText(): string {
    return "Packages";
  }

  getIcon(): string {
    return "package";
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

    this.overlay = mountLocalComponent(NotebookPackagesPanel, {
      target: this.contentEl,
      props: {
        snapshot: null as NotebookPackagesSnapshot | null,
        loading: true,
        onInstallPackage: (
          dependency: NotebookUserDependencyDescriptor,
          onProgress?: (message: string) => void,
        ) => {
          return this.plugin.installNotebookPackage(dependency, onProgress);
        },
        onUpdatePackage: (
          entryIndex: number,
          dependency: NotebookUserDependencyDescriptor,
          onProgress?: (message: string) => void,
        ) => {
          return this.plugin.updateNotebookPackage(
            entryIndex,
            dependency,
            onProgress,
          );
        },
        onSearchPackages: (
          query: string,
        ): Promise<NotebookPackageSearchResult[]> => {
          return this.plugin.searchNotebookPackages(query);
        },
        onUninstallPackage: (entryIndex: number) => {
          return this.plugin.uninstallNotebookPackage(entryIndex);
        },
      },
    });

    this.unregisterView = this.plugin.registerNotebookPackagesView(this);
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
      this.overlay.props.snapshot = await this.plugin.getNotebookPackagesSnapshot();
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
        .setTitle("Refresh notebook packages")
        .setIcon("refresh-cw")
        .onClick(() => {
          void this.refreshView();
        });
    });
  }
}
