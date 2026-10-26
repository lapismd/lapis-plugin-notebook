import { type Menu, type TFile, type WorkspaceLeaf } from "@lapis-notes/api";
import { MarkdownView } from "@lapis-notes/markdown";
import type {
  NotebookExecutionRunState,
  NotebookOutputStateSummary,
} from "./runtime/notebook-session";

export const NotebookViewType = "notebook";
const NOTEBOOK_VIEW_MENU_SECTION = "view";

const NOTEBOOK_HEADER_ACTION_TITLES = new Set([
  "Run notebook now",
  "Run stale notebook cells",
  "Clear all notebook outputs",
]);

type NotebookViewCallbacks = {
  hasNotebookOutputs: (file: TFile) => Promise<boolean>;
  getNotebookExecutionState: (file: TFile) => NotebookExecutionRunState;
  getAutoRunStaleOnCellChange: (file: TFile) => boolean;
  setAutoRunStaleOnCellChange: (file: TFile, enabled: boolean) => Promise<void>;
  runNotebook: () => Promise<void>;
  runStaleNotebookCells: () => Promise<void>;
  clearNotebookOutputs: () => Promise<void>;
  openPackages: () => Promise<void>;
  openDependencies: () => Promise<void>;
  openSources: () => Promise<void>;
};

export class NotebookView extends MarkdownView {
  private hasOutputs = false;
  private executionState: NotebookExecutionRunState = {
    state: "idle",
    scheduledCellIds: [],
    completedCellIds: [],
    phases: [],
  };

  constructor(
    leaf: WorkspaceLeaf | undefined,
    private readonly callbacks: NotebookViewCallbacks,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return NotebookViewType;
  }

  async onLoadFile(file: TFile): Promise<void> {
    await super.onLoadFile(file);
    this.executionState = this.callbacks.getNotebookExecutionState(file);
    await this.refreshNotebookActions();
  }

  load(): void {
    super.load();
    this.containerEl.classList.add("notebook-view");
    this.rebuildNotebookHeaderActions();
  }

  unload(): void {
    this.containerEl.classList.remove("notebook-view");
    super.unload();
  }

  onPaneMenu(menu: Menu, source: "more-options" | "tab-header" | string): void {
    super.onPaneMenu(menu, source);
    const currentFile = this.file;
    if (
      currentFile &&
      typeof this.callbacks.getAutoRunStaleOnCellChange === "function" &&
      typeof this.callbacks.setAutoRunStaleOnCellChange === "function"
    ) {
      menu.addItem((item) => {
        item
          .setSection(NOTEBOOK_VIEW_MENU_SECTION)
          .setTitle("Auto-run on cell changes")
          .setChecked(this.callbacks.getAutoRunStaleOnCellChange(currentFile))
          .onClick(() => {
            const nextEnabled =
              !this.callbacks.getAutoRunStaleOnCellChange(currentFile);
            item.setChecked(nextEnabled);
            void this.callbacks.setAutoRunStaleOnCellChange(
              currentFile,
              nextEnabled,
            );
          });
      });
    }
    menu.addItem((item) => {
      item
        .setSection(NOTEBOOK_VIEW_MENU_SECTION)
        .setTitle("Notebook packages")
        .setIcon("package")
        .onClick(() => {
          void this.callbacks.openPackages();
        });
    });
    menu.addItem((item) => {
      item
        .setSection(NOTEBOOK_VIEW_MENU_SECTION)
        .setTitle("Notebook dependencies")
        .setIcon("workflow")
        .onClick(() => {
          void this.callbacks.openDependencies();
        });
    });
    menu.addItem((item) => {
      item
        .setSection(NOTEBOOK_VIEW_MENU_SECTION)
        .setTitle("Notebook sources")
        .setIcon("database")
        .onClick(() => {
          void this.callbacks.openSources();
        });
    });
  }

  setExecutionState(state: NotebookExecutionRunState): void {
    this.executionState = state;
    this.rebuildNotebookHeaderActions();
  }

  setOutputState(state: NotebookOutputStateSummary): void {
    this.hasOutputs = state.kind !== "none" && state.cellCount > 0;
    this.rebuildNotebookHeaderActions();
  }

  async refreshNotebookActions(): Promise<void> {
    this.hasOutputs = this.file
      ? await this.callbacks.hasNotebookOutputs(this.file)
      : false;

    if (this.file) {
      this.executionState = this.callbacks.getNotebookExecutionState(this.file);
    }

    this.rebuildNotebookHeaderActions();
  }

  private rebuildNotebookHeaderActions(): void {
    this.removeNotebookHeaderActions();
    const running = this.executionState.state === "running";
    this.addAction(
      "lapis-notebook-run-all",
      "Run notebook now",
      () => {
        void this.callbacks.runNotebook();
      },
      { disabled: running },
    );
    this.addAction(
      "rotate-cw",
      "Run stale notebook cells",
      () => {
        void this.callbacks.runStaleNotebookCells();
      },
      { disabled: running },
    );
    this.addAction(
      "trash-2",
      "Clear all notebook outputs",
      () => {
        void this.callbacks.clearNotebookOutputs();
      },
      { disabled: running || !this.hasOutputs },
    );
  }

  private removeNotebookHeaderActions(): void {
    this.actions = this.actions.filter(
      (action: { title: string }) =>
        !NOTEBOOK_HEADER_ACTION_TITLES.has(action.title),
    );
  }
}
