import {
  addIcon,
  FileView,
  Notice,
  Plugin,
  removeIcon,
  type App,
  type PluginManifest,
  type MarkdownPostProcessorContext,
  type ScopedContextKey,
  type View,
  type WorkspaceLeaf,
  TFile,
  MarkdownRenderChild,
} from "@lapis-notes/api";
import { mount, unmount } from "svelte";

const logger = {
  debug: (...a: any[]) => console.debug("[notebook.plugin]", ...a),
  info: (...a: any[]) => console.log("[notebook.plugin]", ...a),
  warn: (...a: any[]) => console.warn("[notebook.plugin]", ...a),
  error: (...a: any[]) => console.error("[notebook.plugin]", ...a),
};

class NotebookCellDirectiveRenderChild extends MarkdownRenderChild {
  constructor(
    containerEl: HTMLElement,
    private readonly component: ReturnType<typeof mount>,
  ) {
    super(containerEl);
  }

  override onunload(): void {
    void unmount(this.component);
  }
}

export const NOTEBOOK_PLUGIN_ID = "lapis-notebook";

const MANIFEST: PluginManifest = {
  id: NOTEBOOK_PLUGIN_ID,
  name: "Notebook",
  version: "0.1.0",
  minAppVersion: "0.0.1",
  description:
    "Executable .notebook.md notebooks with reactive cells and rich outputs.",
  author: "Lapis Notes",
};
import type { NotebookCellLanguage } from "./commands/append-cell-template";
import { NotebookCellSuggest } from "./commands/notebook-cell-suggest";
import {
  buildNotebookDependencySnapshot,
  type NotebookDependencySnapshot,
} from "./dependencies/notebook-dependencies-data";
import {
  NotebookDependenciesView,
  NotebookDependenciesViewType,
  type NotebookDependenciesRefreshableView,
} from "./dependencies/notebook-dependencies-view";
import {
  buildNotebookInspectorSnapshot,
  type NotebookInspectorSnapshot,
  type NotebookInspectorTablePreview,
} from "./inspector/notebook-inspector-data";
import {
  NotebookInspectorView,
  NotebookInspectorViewType,
  type NotebookInspectorRefreshableView,
} from "./inspector/notebook-inspector-view";
import {
  buildNotebookPackagesSnapshot,
  type NotebookPackagesSnapshot,
} from "./packages/notebook-packages-data";
import {
  fetchNotebookPackageManifest,
  resolveNotebookIndirectImports,
  searchNotebookPackages,
  type NotebookPackageSearchResult,
} from "./packages/notebook-package-registry";
import {
  NotebookPackagesView,
  NotebookPackagesViewType,
  type NotebookPackagesRefreshableView,
} from "./packages/notebook-packages-view";
import { isMarkdownFile, isNotebookFile } from "./notebook-file";
import { toNotebookFilePath } from "./notebook-path";
import type { NotebookDocument } from "./model/notebook-document";
import { parseNotebookDocument } from "./parse/parse-notebook-document";
import { NotebookView, NotebookViewType } from "./notebook-view";
import {
  describeNotebookOutputStatus,
  describeNotebookRuntimeStatus,
} from "./runtime/notebook-runtime-status";
import type { NotebookSession } from "./runtime/notebook-session";
import type { NotebookExecutionOptions } from "./runtime/notebook-worker";
import { analyzeNotebookRuntimeFeatures } from "./runtime/analysis/analyze-runtime-features";
import { collectStaleDescendants } from "./runtime/notebook-graph";
import {
  clearNotebookDomOutputsForSource,
  subscribeNotebookInputChanges,
} from "./runtime/notebook-dom-registry";
import NotebookMarkdownCell from "./render/notebook-markdown-cell.svelte";
import {
  NotebookRenderService,
  registerNotebookRenderService,
  unregisterNotebookRenderService,
} from "./render/notebook-render-service";
import { NotebookRuntimeController } from "./runtime";
import { NotebookRuntimeRegistry } from "./runtime/notebook-runtime-registry";
import {
  mergeNotebookSettings,
  patchNotebookSettings,
  type NotebookPluginSettings,
  type NotebookPluginSettingsPatch,
} from "./notebook-settings";
import { NotebookSettingsTab } from "./notebook-settings-tab";
import {
  DEFAULT_NOTEBOOK_FRONTMATTER,
  normalizeNotebookFrontmatter,
  resolveNotebookAutoRunPreference,
} from "./model/notebook-frontmatter";
import {
  deleteNotebookPersistedState,
  isNotebookCellStateReusable,
  loadNotebookPersistedState,
} from "./runtime/notebook-output-store";
import { incrementNotebookCellExecutionRevisions } from "./runtime/notebook-execution-signal.svelte";
import type { NotebookDuckDbCatalog } from "@lapis-notes/notebook-duckdb";
import {
  hasUnsupportedNotebookWorkerRuntimeDependency,
  type NotebookWorkerRuntimePolicyInput,
} from "@lapis-notes/notebook-worker";
import {
  validateNotebookDependencyRegistry,
  type NotebookUserDependencyDescriptor,
} from "@lapis-notes/notebook-stdlib";

type NotebookRuntime = {
  executeDocument: (
    document: NotebookDocument,
    session: NotebookSession,
    options?: NotebookExecutionOptions,
  ) => Promise<unknown>;
  inspectDuckDbCatalog?: (
    document: NotebookDocument,
  ) => Promise<NotebookDuckDbCatalog | null>;
  inspectDuckDbTablePreview?: (
    document: NotebookDocument,
    schemaName: string,
    tableName: string,
    limit?: number,
  ) => Promise<{ columns: string[]; rows: Record<string, unknown>[] } | null>;
  terminate: () => Promise<void>;
};

const RUN_ALL_NOTEBOOK_ICON_ID = "lapis-notebook-run-all";
const AUTO_RUN_STALE_NOTEBOOK_DELAY_MS = 250;
const NOTEBOOK_STATUS_ACTIVE_WHEN = "plugin.notebook.activeNotebook";
const NOTEBOOK_STATUS_RUNNING_WHEN =
  "plugin.notebook.activeNotebook && plugin.notebook.running";
const NOTEBOOK_STATUS_SAFE_MODE_WHEN =
  "plugin.notebook.activeNotebook && plugin.notebook.executionDisabled";
const NOTEBOOK_STATUS_OUTPUT_WHEN =
  "plugin.notebook.activeNotebook && plugin.notebook.hasOutputStatus";
const NOTEBOOK_STATUS_CAN_RUN_WHEN =
  "plugin.notebook.activeNotebook && !plugin.notebook.running && !plugin.notebook.executionDisabled";
const NOTEBOOK_STATUS_CAN_CLEAR_WHEN =
  "plugin.notebook.activeNotebook && !plugin.notebook.running && plugin.notebook.hasOutputs";
const NOTEBOOK_STATUS_RUNTIME_ITEM_ID = "plugin-notebook:runtime";
const NOTEBOOK_STATUS_OUTPUT_ITEM_ID = "plugin-notebook:output";
const NOTEBOOK_STATUS_EXECUTION_ITEM_ID = "plugin-notebook:execution";
const NOTEBOOK_STATUS_SAFE_MODE_ITEM_ID = "plugin-notebook:safe-mode";
const NOTEBOOK_STATUS_RUN_ITEM_ID = "plugin-notebook:run";
const NOTEBOOK_STATUS_RERUN_ITEM_ID = "plugin-notebook:rerun-stale";
const NOTEBOOK_STATUS_CLEAR_ITEM_ID = "plugin-notebook:clear";
const RUN_ALL_NOTEBOOK_ICON = `
<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg" fill="currentColor">
  <path d="M3.43934 13.5569C3.72064 13.8382 4.10218 13.9962 4.5 13.9962C4.75753 13.9943 5.01038 13.9272 5.235 13.8012L13.235 9.30123C13.4661 9.17048 13.6583 8.98073 13.7921 8.75136C13.9258 8.522 13.9963 8.26125 13.9963 7.99573C13.9963 7.73022 13.9258 7.46946 13.7921 7.2401C13.6583 7.01074 13.4661 6.82099 13.235 6.69023L5.225 2.18423C4.99595 2.06392 4.73997 2.00411 4.48133 2.01047C4.22269 2.01682 3.96996 2.08914 3.7471 2.22055C3.52423 2.35196 3.33863 2.53812 3.20789 2.76137C3.07714 2.98462 3.00558 3.23757 3 3.49623V12.4962C3 12.8941 3.15804 13.2756 3.43934 13.5569ZM4.14645 3.14268C4.24021 3.04891 4.36739 2.99623 4.5 2.99623C4.58579 2.99723 4.66999 3.01957 4.745 3.06123L12.745 7.56123C12.8219 7.60484 12.886 7.66808 12.9305 7.7445C12.975 7.82092 12.9985 7.90779 12.9985 7.99623C12.9985 8.08468 12.975 8.17154 12.9305 8.24796C12.886 8.32438 12.8219 8.38762 12.745 8.43123L4.755 12.9252C4.67964 12.9729 4.59272 12.9993 4.50355 13.0014C4.41438 13.0035 4.32631 12.9814 4.24876 12.9373C4.17121 12.8932 4.10709 12.8289 4.06328 12.7512C4.01946 12.6735 3.99759 12.5854 4 12.4962V3.49623C4 3.36362 4.05268 3.23645 4.14645 3.14268ZM10.76 11.8362L11.98 11.1562C11.992 11.2391 11.9987 11.3226 12 11.4062C11.9997 11.6721 11.9293 11.9333 11.7958 12.1632C11.6624 12.3932 11.4707 12.584 11.24 12.7162L6.16 15.5762C5.64826 15.8471 5.07898 15.9911 4.5 15.9962C4.19188 15.9987 3.88513 15.9548 3.59 15.8662C2.98312 15.7119 2.43205 15.3895 2 14.9362C1.35803 14.2865 0.99862 13.4096 1 12.4962V6.90624C1.00252 6.59959 1.10003 6.30126 1.27912 6.05233C1.45821 5.80339 1.71006 5.6161 2 5.51624V12.4962C2.00429 12.9285 2.12001 13.3523 2.33598 13.7268C2.55195 14.1013 2.86087 14.4137 3.23287 14.6339C3.60487 14.8541 4.02738 14.9746 4.45957 14.9837C4.89175 14.9929 5.319 14.8904 5.7 14.6862L10.75 11.8462C10.7527 11.8462 10.7552 11.8452 10.7571 11.8433C10.759 11.8414 10.76 11.8389 10.76 11.8362Z"/>
</svg>
`;

export class NotebookPlugin extends Plugin {
  private readonly runtimeController = new NotebookRuntimeController();
  private readonly inspectorViews = new Set<NotebookInspectorRefreshableView>();
  private readonly dependenciesViews =
    new Set<NotebookDependenciesRefreshableView>();
  private readonly packagesViews = new Set<NotebookPackagesRefreshableView>();
  private readonly executionPromises = new Map<string, Promise<void>>();
  private readonly inputRerunTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  private readonly staleAutoRunTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  private readonly queuedInputReruns = new Map<string, Set<string>>();
  private readonly runningExecutions = new Map<string, boolean>();
  private readonly runtimes: NotebookRuntimeRegistry<NotebookRuntime>;
  private readonly renderService: NotebookRenderService;
  private readonly activeNotebookContextKey: ScopedContextKey;
  private readonly runningNotebookContextKey: ScopedContextKey;
  private readonly executionDisabledContextKey: ScopedContextKey;
  private readonly hasNotebookOutputsContextKey: ScopedContextKey;
  private readonly hasNotebookOutputStatusContextKey: ScopedContextKey;
  private notebookStatusSyncToken = 0;
  private settings: NotebookPluginSettings = mergeNotebookSettings(null);

  constructor(
    app: App,
    manifest: PluginManifest = MANIFEST,
  ) {
    super(app, manifest);
    this.activeNotebookContextKey = this.registerContextKey(
      "activeNotebook",
      false,
    );
    this.runningNotebookContextKey = this.registerContextKey("running", false);
    this.executionDisabledContextKey = this.registerContextKey(
      "executionDisabled",
      false,
    );
    this.hasNotebookOutputsContextKey = this.registerContextKey(
      "hasOutputs",
      false,
    );
    this.hasNotebookOutputStatusContextKey = this.registerContextKey(
      "hasOutputStatus",
      false,
    );
    this.runtimes = new NotebookRuntimeRegistry(() =>
      this.createNotebookRuntime(),
    );
    this.renderService = new NotebookRenderService(
      app,
      this.runtimeController,
      (document, session, options) =>
        this.executeNotebookDocument(document, session, options),
      this.executionPromises,
      (sourcePath) => this.refreshNotebookActionsForPath(sourcePath),
      (sourcePath) => this.cancelNotebookExecution(sourcePath),
    );
  }

  private async createNotebookRuntime(): Promise<NotebookRuntime> {
    const { NotebookWorkerClient } = await import(
      "./runtime/notebook-worker-client"
    );
    const { createNotebookDuckDbServiceOptions } = await import(
      "./runtime/notebook-plugin-runtime-assets"
    );
    // The legacy Electron native-DuckDB sidecar is out of scope; the worker
    // client's duckdbProvider seam stays open for a future native service.
    return new NotebookWorkerClient(this.app, {
      duckdbServiceOptions: createNotebookDuckDbServiceOptions(this.app, this),
      pluginId: this.manifest.id,
      pluginPath: this.basePath,
      pluginVersion: this.manifest.version,
    });
  }

  async onload(): Promise<void> {
    await this.initializeSettings();

    addIcon(RUN_ALL_NOTEBOOK_ICON_ID, RUN_ALL_NOTEBOOK_ICON);
    this.app.metadataTypeManager.setType("notebook.autorun", "checkbox");
    registerNotebookRenderService(this.renderService);
    this.registerNotebookStatusBarItems();
    this.registerEvent(
      this.runtimeController.on("changed", (sourcePath, reason) => {
        if (reason === "execution") {
          this.maybeIncrementExecutionRevision(sourcePath);
        } else if (this.isAutoRunStaleOnCellChangeEnabledForPath(sourcePath)) {
          this.scheduleStaleNotebookAutoRun(sourcePath);
        }
        this.updateNotebookExecutionForPath(sourcePath);
        void this.syncNotebookStatusBar();
        void this.refreshNotebookInspectorViews();
        void this.refreshNotebookDependenciesViews();
      }),
    );
    this.register(
      subscribeNotebookInputChanges((event) => {
        void this.scheduleNotebookInputRerun(event);
      }),
    );
    this.addSettingTab(new NotebookSettingsTab(this.app, this));
    this.registerView(
      NotebookViewType,
      (leaf) =>
        new NotebookView(leaf, {
          hasNotebookOutputs: (file) =>
            this.loadNotebookDocument(file, file.path).then((document) =>
              this.hasNotebookOutputs(file, document),
            ),
          getNotebookExecutionState: (file) =>
            this.runtimeController.getExecutionState(file.path),
          getAutoRunStaleOnCellChange: (file) =>
            this.isAutoRunStaleOnCellChangeEnabled(file),
          setAutoRunStaleOnCellChange: (file, enabled) =>
            this.setNotebookAutoRunStaleOnCellChange(file, enabled),
          runNotebook: () => this.runActiveNotebookCommand(),
          runStaleNotebookCells: () => this.runStaleNotebookCellsCommand(),
          clearNotebookOutputs: () => this.clearActiveNotebookOutputsCommand(),
          openPackages: () => this.openNotebookPackages(true),
          openDependencies: () => this.openNotebookDependencies(true),
          openSources: () => this.openNotebookInspector(true),
        }) as unknown as View,
      { kind: "file" },
    );
    this.registerView(
      NotebookInspectorViewType,
      (leaf) => new NotebookInspectorView(leaf, this) as unknown as View,
      {
        kind: "command",
        command: {
          id: "open-notebook-session-view",
          name: "Open notebook variables and data sources",
          callback: () =>
            this.runCommand(() => this.openNotebookInspector(true)),
        },
      },
    );
    this.registerView(
      NotebookDependenciesViewType,
      (leaf) => new NotebookDependenciesView(leaf, this) as unknown as View,
      {
        kind: "command",
        command: {
          id: "open-notebook-dependencies-view",
          name: "Open notebook dependencies",
          callback: () =>
            this.runCommand(() => this.openNotebookDependencies(true)),
        },
      },
    );
    this.registerView(
      NotebookPackagesViewType,
      (leaf) => new NotebookPackagesView(leaf, this) as unknown as View,
      {
        kind: "command",
        command: {
          id: "open-notebook-packages-view",
          name: "Open notebook packages",
          callback: () =>
            this.runCommand(() => this.openNotebookPackages(true)),
        },
      },
    );
    this.registerEditorView({
      id: NotebookViewType,
      label: "Notebook",
      filenamePatterns: ["*.notebook.md"],
      priority: "default",
    });
    this.registerExtensions(["notebook.md"], NotebookViewType);
    this.registerEditorSuggest(new NotebookCellSuggest(this.app), "markdown");
    this.registerNotebookCellMarkdownPostProcessor();

    this.app.workspace.onLayoutReady(() => {
      void this.refreshOpenNotebookViews();
      void this.syncNotebookStatusBar();
      void this.refreshNotebookInspectorViews();
      void this.refreshNotebookDependenciesViews();
      void this.refreshNotebookPackagesViews();
    });

    this.registerEvent(
      this.app.workspace.on("file-open", (file) => {
        void this.syncNotebookStatusBar();
        void this.handleNotebookFileOpen(file as TFile | null | undefined);
      }),
    );
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", () => {
        void this.syncNotebookStatusBar();
        void this.refreshNotebookInspectorViews();
        void this.refreshNotebookDependenciesViews();
        void this.refreshNotebookPackagesViews();
      }),
    );

    this.addCommand({
      id: "enable-notebook-for-active-note",
      name: "Convert active note to notebook file",
      callback: () =>
        this.runCommand(async () => {
          const file = this.app.workspace.getActiveFile() as TFile | null;
          if (!file) {
            new Notice("Open a markdown note first");
            return;
          }

          if (isNotebookFile(file)) {
            new Notice("Active note is already a notebook file");
            return;
          }

          if (!isMarkdownFile(file)) {
            new Notice("Open a markdown note first");
            return;
          }

          const markdownFile: TFile = file;
          const newPath = toNotebookFilePath(markdownFile.path);
          if (newPath === markdownFile.path) {
            new Notice("Active note is already a notebook file");
            return;
          }

          await this.app.fileManager.renameFile(markdownFile, newPath);
          new Notice(`Converted note to ${newPath.split("/").pop()}`);
        }),
    });

    this.addCommand({
      id: "create-demo-notebooks",
      name: "Create demo notebook folder",
      callback: () =>
        this.runCommand(async () => {
          const { createDemoNotebooks } = await import(
            "./commands/create-demo-notebooks"
          );
          await createDemoNotebooks(this.app);
        }),
    });

    this.addCommand({
      id: "run-active-notebook",
      name: "Run notebook now",
      callback: () => this.runCommand(() => this.runActiveNotebookCommand()),
    });

    this.addCommand({
      id: "run-current-notebook-cell",
      name: "Run current notebook cell",
      callback: () =>
        this.runCommand(() => this.runCurrentNotebookCellCommand()),
    });

    this.addCommand({
      id: "run-stale-notebook-cells",
      name: "Run stale notebook cells",
      callback: () =>
        this.runCommand(() => this.runStaleNotebookCellsCommand()),
    });

    this.addCommand({
      id: "clear-active-notebook-outputs",
      name: "Clear notebook outputs",
      callback: () =>
        this.runCommand(() => this.clearActiveNotebookOutputsCommand()),
    });

    this.addCommand({
      id: "insert-notebook-code-cell",
      name: "Insert notebook code cell",
      callback: () => this.runCommand(() => this.insertCell("ts")),
    });

    this.addCommand({
      id: "insert-notebook-input-cell",
      name: "Insert notebook input cell",
      callback: () => this.runCommand(() => this.insertCell("input")),
    });

    this.addCommand({
      id: "insert-notebook-sql-cell",
      name: "Insert notebook SQL cell",
      callback: () => this.runCommand(() => this.insertCell("sql")),
    });

    this.addCommand({
      id: "insert-notebook-markdown-cell",
      name: "Insert notebook markdown cell",
      callback: () => this.runCommand(() => this.insertCell("md")),
    });
  }

  private registerNotebookCellMarkdownPostProcessor(): void {
    this.registerMarkdownPostProcessor((el, ctx) => {
      this.renderNotebookCellDirective(el, ctx);
    }, -100);
  }

  private renderNotebookCellDirective(
    el: HTMLElement,
    ctx: MarkdownPostProcessorContext,
  ): void {
    if (!el.matches('[data-directive="cell"]')) {
      return;
    }
    if (el.dataset.notebookCellMounted === "true") {
      return;
    }

    const cellId = el.getAttribute("id") ?? "";
    if (!cellId || !ctx.sourcePath) {
      return;
    }

    // The cell directive's `lang` attribute names the cell language, not the
    // human language of rendered content. Mira hoists directive attributes
    // onto the host element, where `lang` collides with the global HTML
    // attribute (axe valid-lang); preserve it as data before mounting.
    const cellLang = el.getAttribute("lang");
    if (cellLang) {
      el.dataset.notebookCellLang = cellLang;
      el.removeAttribute("lang");
    }

    el.dataset.notebookCellMounted = "true";
    const className = el.getAttribute("class") ?? "";
    el.replaceChildren();
    const component = mount(NotebookMarkdownCell, {
      target: el,
      props: {
        app: this.app,
        tagName: "div",
        sourcePath: ctx.sourcePath,
        id: cellId,
        class: className,
      },
    });

    ctx.addChild(new NotebookCellDirectiveRenderChild(el, component));
  }

  onunload(): void {
    unregisterNotebookRenderService(this.renderService);
    removeIcon(RUN_ALL_NOTEBOOK_ICON_ID);
    this.inputRerunTimers.forEach((timer) => clearTimeout(timer));
    this.inputRerunTimers.clear();
    this.staleAutoRunTimers.forEach((timer) => clearTimeout(timer));
    this.staleAutoRunTimers.clear();
    this.queuedInputReruns.clear();
    void this.runtimes.terminateAll().catch(() => undefined);
  }

  private async runCommand(task: () => Promise<unknown>): Promise<void> {
    await task().catch((error) => {
      console.error("Notebook command failed", error);
      new Notice(
        error instanceof Error ? error.message : "Notebook command failed",
      );
    });
  }

  private async insertCell(language: NotebookCellLanguage): Promise<void> {
    const { appendCellTemplate } = await import(
      "./commands/append-cell-template"
    );
    await appendCellTemplate(this.app, language);
  }

  private getRuntime(sourcePath?: string | null): Promise<NotebookRuntime> {
    return this.runtimes.get(sourcePath);
  }

  private getExistingRuntime(
    sourcePath?: string | null,
  ): Promise<NotebookRuntime> | null {
    return this.runtimes.peek(sourcePath);
  }

  getSettings(): NotebookPluginSettings {
    return mergeNotebookSettings(this.settings);
  }

  async updateSettings(patch: NotebookPluginSettingsPatch): Promise<void> {
    const autoRunEnabledBefore =
      this.settings.execution.autoRunStaleOnCellChange;
    this.settings = patchNotebookSettings(this.settings, patch);
    const snapshot = this.getSettings();
    await this.saveData(snapshot);
    await this.refreshNotebookDependenciesViews();
    await this.refreshNotebookPackagesViews();
    if (autoRunEnabledBefore && !snapshot.execution.autoRunStaleOnCellChange) {
      for (const [sourcePath, timer] of this.staleAutoRunTimers.entries()) {
        if (this.isAutoRunStaleOnCellChangeEnabledForPath(sourcePath)) {
          continue;
        }

        clearTimeout(timer);
        this.staleAutoRunTimers.delete(sourcePath);
      }
    }
  }

  private getNotebookFrontmatter(file: TFile | null | undefined) {
    if (!(file instanceof TFile)) {
      return null;
    }

    return normalizeNotebookFrontmatter(
      this.app.metadataCache.getFileCache(file)?.frontmatter?.notebook,
    );
  }

  private isAutoRunStaleOnCellChangeEnabled(
    file: TFile | null | undefined,
  ): boolean {
    return resolveNotebookAutoRunPreference(
      this.getNotebookFrontmatter(file),
      this.settings.execution.autoRunStaleOnCellChange,
    );
  }

  private isAutoRunStaleOnCellChangeEnabledForPath(
    sourcePath: string,
  ): boolean {
    return this.isAutoRunStaleOnCellChangeEnabled(
      this.app.vault.getFileByPath(sourcePath),
    );
  }

  private async setNotebookAutoRunStaleOnCellChange(
    file: TFile,
    enabled: boolean,
  ): Promise<void> {
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      const current = frontmatter.notebook;
      if (current && typeof current === "object" && !Array.isArray(current)) {
        frontmatter.notebook = {
          ...DEFAULT_NOTEBOOK_FRONTMATTER,
          ...current,
          autorun: enabled,
        };
        return;
      }

      frontmatter.notebook = {
        ...DEFAULT_NOTEBOOK_FRONTMATTER,
        autorun: enabled,
      };
    });

    if (!enabled) {
      const timer = this.staleAutoRunTimers.get(file.path);
      if (timer) {
        clearTimeout(timer);
        this.staleAutoRunTimers.delete(file.path);
      }
    }
  }

  async revealNotebookCell(sourcePath: string, cellId: string): Promise<void> {
    const contextFile = this.app.vault.getFileByPath(sourcePath);
    if (!(contextFile instanceof TFile)) {
      return;
    }

    const context = {
      file: contextFile,
      document: await this.loadNotebookDocument(contextFile, sourcePath),
    };
    const targetCell = context.document.cells.find(
      (cell) => cell.id === cellId,
    );
    if (!targetCell) {
      return;
    }

    const leaf = await this.ensureNotebookLeafForPath(context.file);
    await this.app.workspace.revealLeaf(leaf);

    const view = leaf.view as unknown as NotebookView & {
      getState?: () => Record<string, unknown>;
      editor?: { setCursor: (position: { line: number; ch: number }) => void };
    };
    const cellElement = await this.waitForNotebookCellElement(
      view.containerEl,
      cellId,
    );
    if (cellElement) {
      cellElement.scrollIntoView({ block: "center", behavior: "smooth" });
      pulseNotebookCell(cellElement);
      return;
    }

    view.editor?.setCursor({
      line: Math.max(targetCell.sourceRange.startLine - 1, 0),
      ch: 0,
    });
  }

  private async executeNotebookDocument(
    document: NotebookDocument,
    session: NotebookSession,
    options?: NotebookExecutionOptions,
  ): Promise<unknown> {
    const safeModeApp = this.app as App & {
      safeMode?: { disableNotebookExecution?: boolean };
    };
    if (
      this.app.contextKeys?.get("safeMode.notebookExecutionDisabled") ===
        true ||
      safeModeApp.safeMode?.disableNotebookExecution === true
    ) {
      throw new Error(
        "Notebook execution is disabled while Safe Mode is active",
      );
    }

    const sourcePath = document.sourcePath ?? "Untitled notebook";
    const cellCount = options?.cellIds?.length ?? document.cells.length;
    return this.app.notifications.withProgress(
      {
        title: "Running notebook",
        message: sourcePath,
        source: "Notebook",
        location: "notification",
        cancellable: true,
        persistOnError: true,
      },
      async (progress) => {
        const abortRuntime = () => {
          this.runningExecutions.set(sourcePath, false);
          void this.runtimes.terminate(sourcePath).catch(() => undefined);
        };
        progress.signal.addEventListener("abort", abortRuntime, {
          once: true,
        });
        try {
          progress.report({
            current: 0,
            total: cellCount,
            message: sourcePath,
          });
          const runtime = await this.getRuntime(sourcePath);
          progress.throwIfCancellationRequested();
          const result = await runtime.executeDocument(
            document,
            session,
            this.withRuntimeDependencies(options),
          );
          progress.report({
            current: cellCount,
            total: cellCount,
            message: sourcePath,
          });
          return result;
        } finally {
          progress.signal.removeEventListener("abort", abortRuntime);
        }
      },
    );
  }

  private async cancelNotebookExecution(sourcePath: string): Promise<void> {
    if (!this.executionPromises.has(sourcePath)) {
      return;
    }

    logger.warn("cancelNotebookExecution", { sourcePath });
    this.runningExecutions.set(sourcePath, false);
    const runtimePromise = this.getExistingRuntime(sourcePath);
    if (!runtimePromise) {
      return;
    }

    await this.runtimes.terminate(sourcePath);
  }

  private findAnyNotebookFile(): TFile | null {
    for (const leaf of this.app.workspace.getLeavesOfType(NotebookViewType)) {
      const file = this.getNotebookFile(leaf);
      if (file) {
        return file;
      }
    }
    return null;
  }

  private getNotebookFile(
    leaf: { view?: unknown } | null | undefined,
  ): TFile | null {
    const view = leaf?.view;
    if (view instanceof FileView) {
      const file = view.file;
      if (isNotebookFile(file)) {
        return file;
      }
    }

    return null;
  }

  private async runActiveNotebookCommand(): Promise<void> {
    const { runActiveNotebook } = await import(
      "./commands/run-active-notebook"
    );
    const file = await runActiveNotebook(
      this.app,
      this.runtimeController,
      this.createDeferredRuntime(),
    );
    if (!file) {
      return;
    }

    await this.refreshNotebookViews(file.path);
  }

  private async runCurrentNotebookCellCommand(): Promise<void> {
    const { runCurrentNotebookCell } = await import(
      "./commands/run-active-notebook"
    );
    const file = await runCurrentNotebookCell(
      this.app,
      this.runtimeController,
      this.createDeferredRuntime(),
    );
    if (!file) {
      return;
    }

    await this.refreshNotebookViews(file.path);
  }

  private async runStaleNotebookCellsCommand(): Promise<void> {
    const { runStaleNotebookCells } = await import(
      "./commands/run-active-notebook"
    );
    const file = await runStaleNotebookCells(
      this.app,
      this.runtimeController,
      this.createDeferredRuntime(),
    );
    if (!file) {
      return;
    }

    await this.refreshNotebookViews(file.path);
  }

  private async clearActiveNotebookOutputsCommand(): Promise<void> {
    const file = this.getNotebookFile(this.app.workspace.activeLeaf);
    if (!file) {
      throw new Error(
        "Notebook output clearing is only available for notebook notes",
      );
    }

    const document = await this.loadNotebookDocument(file, file.path);
    if (!document.enabled) {
      throw new Error(
        "Open a notebook note before clearing outputs for this note",
      );
    }

    this.runtimeController.clearOutputs(file.path);
    clearNotebookDomOutputsForSource(file.path);
    await deleteNotebookPersistedState(this.app, file.path);
    await this.refreshNotebookViews(file.path);
    new Notice("Cleared all notebook outputs");
  }

  private createDeferredRuntime(): Pick<NotebookRuntime, "executeDocument"> {
    return {
      executeDocument: async (document, session, options) => {
        return this.executeNotebookDocument(document, session, options);
      },
    };
  }

  private withRuntimeDependencies(
    options: NotebookExecutionOptions = {},
  ): NotebookExecutionOptions {
    const validation = validateNotebookDependencyRegistry(
      this.settings.runtimeDependencies,
    );
    // Flagged core gap: the new API keeps its plugin dependency resolver
    // private and no host injects the legacy notebook version-map key, so
    // bare imports resolving from host-provided packages stay inert until a
    // generic host contract lands. Remote ESM descriptors are unaffected.
    const localPackageVersions: unknown = undefined;
    return {
      ...options,
      localPackageVersions:
        localPackageVersions &&
        typeof localPackageVersions === "object" &&
        !Array.isArray(localPackageVersions)
          ? (localPackageVersions as Record<string, string>)
          : options.localPackageVersions,
      runtimeDependencies: validation.ok ? validation.dependencies : [],
    };
  }

  private getNotebookRuntimePolicyInput(
    document: NotebookDocument,
    options: NotebookExecutionOptions = this.withRuntimeDependencies(),
  ): NotebookWorkerRuntimePolicyInput {
    const features = analyzeNotebookRuntimeFeatures(document);
    return {
      workerAvailable: typeof Worker !== "undefined",
      usesDuckDb: features.usesDuckDb,
      requiresDom: features.requiresDom,
      requiresLiveDom: features.requiresLiveDom,
      hasRuntimeDependencyLoader: Boolean(options.runtimeDependencyLoader),
      hasUnsupportedRuntimeDependency:
        hasUnsupportedNotebookWorkerRuntimeDependency(
          options.runtimeDependencies,
        ),
      hasHostOnlyProvider: Boolean(
        options.compileProvider || options.fileReaderProvider,
      ),
    };
  }

  private async hasNotebookOutputs(
    file: TFile,
    document: NotebookDocument,
  ): Promise<boolean> {
    if (this.runtimeController.hasOutputs(document)) {
      return true;
    }

    const persistedState = await loadNotebookPersistedState(
      this.app,
      file.path,
    );
    if (!persistedState) {
      return false;
    }

    return document.cells.some((cell) => {
      const state = persistedState.cells[cell.id];
      return (
        isNotebookCellStateReusable(persistedState, file, cell) &&
        ((state?.outputs?.length ?? 0) > 0 || Boolean(state?.error))
      );
    });
  }

  private async refreshOpenNotebookViews(): Promise<void> {
    for (const leaf of this.app.workspace.getLeavesOfType(NotebookViewType)) {
      const view = leaf.view as unknown as NotebookView;
      await view.refreshNotebookActions();
    }
  }

  private async handleNotebookFileOpen(
    file: TFile | null | undefined,
  ): Promise<void> {
    if (!file || !isNotebookFile(file)) {
      await this.refreshNotebookInspectorViews();
      await this.refreshNotebookDependenciesViews();
      await this.refreshNotebookPackagesViews();
      return;
    }

    if (this.settings.panels.autoOpenSourcesOnNotebookOpen) {
      await this.openNotebookInspector(false);
    }
    if (this.settings.panels.autoOpenDependenciesOnNotebookOpen) {
      await this.openNotebookDependencies(false);
    }
    await this.refreshNotebookInspectorViews();
    await this.refreshNotebookDependenciesViews();
    await this.refreshNotebookPackagesViews();
  }

  private async initializeSettings(): Promise<void> {
    const storedData = await this.loadData();
    this.settings = mergeNotebookSettings(storedData);
    await this.saveData(this.settings);
  }

  private async refreshNotebookActionsForPath(
    sourcePath: string,
  ): Promise<void> {
    for (const leaf of this.app.workspace.getLeavesOfType(NotebookViewType)) {
      const view = leaf.view as unknown as NotebookView & { file?: TFile };
      if (view.file?.path !== sourcePath) {
        continue;
      }

      await view.refreshNotebookActions();
    }

    await this.syncNotebookStatusBar();
  }

  private maybeIncrementExecutionRevision(sourcePath: string): void {
    const executionState = this.runtimeController.getExecutionState(sourcePath);
    const isRunning = executionState.state === "running";
    const wasRunning = this.runningExecutions.get(sourcePath) ?? false;
    this.runningExecutions.set(sourcePath, isRunning);

    if (isRunning && !wasRunning) {
      const cellIds = [
        ...executionState.scheduledCellIds,
        ...(executionState.runningCellId ? [executionState.runningCellId] : []),
      ];
      incrementNotebookCellExecutionRevisions(sourcePath, cellIds);
    }
  }

  private updateNotebookExecutionForPath(sourcePath: string): void {
    const snapshot = this.runtimeController.getSnapshot(sourcePath);
    for (const leaf of this.app.workspace.getLeavesOfType(NotebookViewType)) {
      const view = leaf.view as unknown as NotebookView & { file?: TFile };
      if (view.file?.path !== sourcePath) {
        continue;
      }

      view.setExecutionState(snapshot.executionState);
      view.setOutputState(snapshot.outputState);
    }
  }

  private registerNotebookStatusBarItems(): void {
    this.register(
      this.app.statusBar.registerItem({
        id: NOTEBOOK_STATUS_SAFE_MODE_ITEM_ID,
        text: "Safe Mode",
        alignment: "left",
        priority: 90,
        when: NOTEBOOK_STATUS_SAFE_MODE_WHEN,
        tooltip: "Notebook execution is disabled in Safe Mode.",
      }),
    );
    this.register(
      this.app.statusBar.registerItem({
        id: NOTEBOOK_STATUS_RUNTIME_ITEM_ID,
        text: "Notebook runtime",
        alignment: "left",
        priority: 100,
        when: NOTEBOOK_STATUS_ACTIVE_WHEN,
      }),
    );
    this.register(
      this.app.statusBar.registerItem({
        id: NOTEBOOK_STATUS_OUTPUT_ITEM_ID,
        text: "Notebook outputs",
        alignment: "left",
        priority: 110,
        when: NOTEBOOK_STATUS_OUTPUT_WHEN,
      }),
    );
    this.register(
      this.app.statusBar.registerItem({
        id: NOTEBOOK_STATUS_EXECUTION_ITEM_ID,
        text: "Running notebook",
        alignment: "left",
        priority: 120,
        when: NOTEBOOK_STATUS_RUNNING_WHEN,
      }),
    );
    this.register(
      this.app.statusBar.registerItem({
        id: NOTEBOOK_STATUS_RUN_ITEM_ID,
        icon: RUN_ALL_NOTEBOOK_ICON_ID,
        alignment: "right",
        priority: 90,
        when: NOTEBOOK_STATUS_CAN_RUN_WHEN,
        command: "notebook:run-active-notebook",
        tooltip: "Run notebook now",
      }),
    );
    this.register(
      this.app.statusBar.registerItem({
        id: NOTEBOOK_STATUS_RERUN_ITEM_ID,
        icon: "rotate-cw",
        alignment: "right",
        priority: 100,
        when: NOTEBOOK_STATUS_CAN_RUN_WHEN,
        command: "notebook:run-stale-notebook-cells",
        tooltip: "Run stale notebook cells",
      }),
    );
    this.register(
      this.app.statusBar.registerItem({
        id: NOTEBOOK_STATUS_CLEAR_ITEM_ID,
        icon: "trash-2",
        alignment: "right",
        priority: 110,
        when: NOTEBOOK_STATUS_CAN_CLEAR_WHEN,
        command: "notebook:clear-active-notebook-outputs",
        tooltip: "Clear all notebook outputs",
      }),
    );
  }

  private async syncNotebookStatusBar(): Promise<void> {
    const syncToken = ++this.notebookStatusSyncToken;
    const file = this.getNotebookFile(this.app.workspace.activeLeaf);

    if (!file) {
      this.activeNotebookContextKey.set(false);
      this.runningNotebookContextKey.set(false);
      this.executionDisabledContextKey.set(false);
      this.hasNotebookOutputsContextKey.set(false);
      this.hasNotebookOutputStatusContextKey.set(false);
      return;
    }

    const executionState = this.runtimeController.getExecutionState(file.path);
    const snapshot = this.runtimeController.getSnapshot(file.path);
    const document = await this.loadNotebookDocument(file, file.path);
    const outputStatus = describeNotebookOutputStatus(snapshot.outputState);
    const viewStatus = {
      runtime: describeNotebookRuntimeStatus(
        this.getNotebookRuntimePolicyInput(document),
      ),
      executionDisabled:
        this.app.contextKeys?.get("safeMode.notebookExecutionDisabled") ===
        true,
    };
    const hasOutputs = await this.hasNotebookOutputs(file, document);

    if (syncToken !== this.notebookStatusSyncToken) {
      return;
    }

    this.activeNotebookContextKey.set(true);
    this.runningNotebookContextKey.set(executionState.state === "running");
    this.executionDisabledContextKey.set(viewStatus.executionDisabled);
    this.hasNotebookOutputsContextKey.set(hasOutputs);
    this.hasNotebookOutputStatusContextKey.set(Boolean(outputStatus));

    this.app.statusBar.upsertItem({
      id: NOTEBOOK_STATUS_RUNTIME_ITEM_ID,
      text: viewStatus.runtime.label,
      tooltip: viewStatus.runtime.detail,
    });

    this.app.statusBar.upsertItem({
      id: NOTEBOOK_STATUS_EXECUTION_ITEM_ID,
      text: executionState.statusMessage ?? "Running notebook",
      tooltip:
        executionState.statusMessage ?? "Notebook execution is in progress.",
    });

    this.app.statusBar.upsertItem({
      id: NOTEBOOK_STATUS_OUTPUT_ITEM_ID,
      text: outputStatus?.label ?? "Notebook outputs",
      tooltip: outputStatus?.detail,
    });
  }

  private async refreshNotebookViews(sourcePath: string): Promise<void> {
    for (const leaf of this.app.workspace.getLeavesOfType(NotebookViewType)) {
      const view = leaf.view as unknown as NotebookView & {
        file?: TFile;
        getState?: () => Record<string, unknown>;
        setState?: (state: Record<string, unknown>) => Promise<void>;
      };
      const file = view.file;
      const state = view.getState?.();
      if (!file || file.path !== sourcePath || !state || !view.setState) {
        continue;
      }

      if (state.mode === "preview") {
        await view.setState({ ...state, mode: "source" });
        await view.setState({ ...view.getState?.(), mode: "preview" });
        await view.refreshNotebookActions();
        continue;
      }

      if (state.mode === "live-preview") {
        await view.setState({ ...state, mode: "preview" });
        await view.setState({ ...view.getState?.(), mode: "live-preview" });
        await view.refreshNotebookActions();
        continue;
      }

      await view.refreshNotebookActions();
    }
  }

  private async scheduleNotebookInputRerun(event: {
    sourcePath?: string;
    cellId: string;
    name: string;
    value: unknown;
  }): Promise<void> {
    if (!event.sourcePath) {
      return;
    }

    const dependentCellIds = this.runtimeController.updateInputValue(
      event.sourcePath,
      event.cellId,
      event.name,
      event.value,
    );
    if (dependentCellIds.length === 0) {
      return;
    }

    const queued =
      this.queuedInputReruns.get(event.sourcePath) ?? new Set<string>();
    dependentCellIds.forEach((cellId) => queued.add(cellId));
    this.queuedInputReruns.set(event.sourcePath, queued);

    const existingTimer = this.inputRerunTimers.get(event.sourcePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.inputRerunTimers.delete(event.sourcePath!);
      void this.flushNotebookInputRerun(event.sourcePath!);
    }, 150);
    this.inputRerunTimers.set(event.sourcePath, timer);
  }

  private async flushNotebookInputRerun(sourcePath: string): Promise<void> {
    const queued = this.queuedInputReruns.get(sourcePath);
    if (!queued || queued.size === 0) {
      return;
    }

    if (this.executionPromises.has(sourcePath)) {
      setTimeout(() => void this.flushNotebookInputRerun(sourcePath), 150);
      return;
    }

    this.queuedInputReruns.delete(sourcePath);
    try {
      await this.renderService.runCells(sourcePath, Array.from(queued), {
        skipDependencyClosure: true,
      });
    } catch (error) {
      logger.warn("input-triggered notebook rerun failed", {
        sourcePath,
        error,
      });
    }
  }

  private scheduleStaleNotebookAutoRun(sourcePath: string): void {
    if (!this.isAutoRunStaleOnCellChangeEnabledForPath(sourcePath)) {
      return;
    }

    const existingTimer = this.staleAutoRunTimers.get(sourcePath);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    const timer = setTimeout(() => {
      this.staleAutoRunTimers.delete(sourcePath);
      void this.flushStaleNotebookAutoRun(sourcePath);
    }, AUTO_RUN_STALE_NOTEBOOK_DELAY_MS);
    this.staleAutoRunTimers.set(sourcePath, timer);
  }

  private async flushStaleNotebookAutoRun(sourcePath: string): Promise<void> {
    if (!this.isAutoRunStaleOnCellChangeEnabledForPath(sourcePath)) {
      return;
    }

    if (this.executionPromises.has(sourcePath)) {
      this.scheduleStaleNotebookAutoRun(sourcePath);
      return;
    }

    try {
      const staleCellIds = await this.renderService.runStaleCells(sourcePath);
      if (staleCellIds.length === 0) {
        return;
      }

      await this.refreshNotebookViews(sourcePath);
    } catch (error) {
      logger.warn("auto-run stale notebook cells failed", {
        sourcePath,
        error,
      });
    }
  }

  private async loadNotebookDocument(
    file: TFile,
    sourcePath: string,
  ): Promise<NotebookDocument> {
    return this.renderService.loadNotebookDocument(file, sourcePath);
  }

  private findNotebookLeafForPath(sourcePath: string): WorkspaceLeaf | null {
    for (const leaf of this.app.workspace.getLeavesOfType(NotebookViewType)) {
      const view = leaf.view as unknown as NotebookView & { file?: TFile };
      if (view.file?.path === sourcePath) {
        return leaf;
      }
    }

    return null;
  }

  private async ensureNotebookLeafForPath(file: TFile): Promise<WorkspaceLeaf> {
    const existing = this.findNotebookLeafForPath(file.path);
    if (existing) {
      return existing;
    }

    const leaf = this.app.workspace.getLeaf(true);
    await leaf.openFile(file);
    return leaf;
  }

  private async waitForNotebookCellElement(
    container: HTMLElement,
    cellId: string,
    attempts: number = 6,
  ): Promise<HTMLElement | null> {
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const element = container.querySelector<HTMLElement>(
        `[data-notebook-cell="${escapeNotebookCellSelector(cellId)}"]`,
      );
      if (element) {
        return element;
      }
      await nextAnimationFrame();
    }

    return null;
  }

  registerNotebookInspectorView(
    view: NotebookInspectorRefreshableView,
  ): () => void {
    this.inspectorViews.add(view);
    // Views can mount before or after the workspace layout events settle
    // (layout restore ordering is host-dependent), so seed the panel on
    // registration and again once the layout is ready; later workspace
    // events keep it current.
    void view.refreshView();
    this.app.workspace.onLayoutReady(() => {
      if (this.inspectorViews.has(view)) {
        void view.refreshView();
      }
    });
    return () => {
      this.inspectorViews.delete(view);
    };
  }

  registerNotebookDependenciesView(
    view: NotebookDependenciesRefreshableView,
  ): () => void {
    this.dependenciesViews.add(view);
    // Views can mount before or after the workspace layout events settle
    // (layout restore ordering is host-dependent), so seed the panel on
    // registration and again once the layout is ready; later workspace
    // events keep it current.
    void view.refreshView();
    this.app.workspace.onLayoutReady(() => {
      if (this.dependenciesViews.has(view)) {
        void view.refreshView();
      }
    });
    return () => {
      this.dependenciesViews.delete(view);
    };
  }

  registerNotebookPackagesView(
    view: NotebookPackagesRefreshableView,
  ): () => void {
    this.packagesViews.add(view);
    // Views can mount before or after the workspace layout events settle
    // (layout restore ordering is host-dependent), so seed the panel on
    // registration and again once the layout is ready; later workspace
    // events keep it current.
    void view.refreshView();
    this.app.workspace.onLayoutReady(() => {
      if (this.packagesViews.has(view)) {
        void view.refreshView();
      }
    });
    return () => {
      this.packagesViews.delete(view);
    };
  }

  async installNotebookPackage(
    dependency: {
      packageName: string;
      version: string;
      globalName?: string;
    },
    onProgress?: (message: string) => void,
  ): Promise<void> {
    await this.saveNotebookRuntimeDependencies(
      [...this.settings.runtimeDependencies, dependency],
      dependency,
      onProgress,
    );
  }

  async searchNotebookPackages(
    query: string,
  ): Promise<NotebookPackageSearchResult[]> {
    return searchNotebookPackages(query);
  }

  async uninstallNotebookPackage(entryIndex: number): Promise<void> {
    if (
      entryIndex < 0 ||
      entryIndex >= this.settings.runtimeDependencies.length
    ) {
      return;
    }

    await this.updateSettings({
      runtimeDependencies: this.settings.runtimeDependencies.filter(
        (_, index) => index !== entryIndex,
      ),
    });
  }

  async updateNotebookPackage(
    entryIndex: number,
    dependency: {
      packageName: string;
      version: string;
      globalName?: string;
    },
    onProgress?: (message: string) => void,
  ): Promise<void> {
    if (
      entryIndex < 0 ||
      entryIndex >= this.settings.runtimeDependencies.length
    ) {
      return;
    }

    const runtimeDependencies = [...this.settings.runtimeDependencies];
    runtimeDependencies[entryIndex] = dependency;

    await this.saveNotebookRuntimeDependencies(
      runtimeDependencies,
      dependency,
      onProgress,
    );
  }

  private async saveNotebookRuntimeDependencies(
    runtimeDependencies: NotebookUserDependencyDescriptor[],
    dependency: {
      packageName: string;
      version: string;
      globalName?: string;
    },
    onProgress?: (message: string) => void,
  ): Promise<void> {
    onProgress?.("Validating package descriptor...");
    const validation = validateNotebookDependencyRegistry(runtimeDependencies);
    if (!validation.ok) {
      throw new Error(
        validation.issues
          .map((issue) => `Entry ${issue.index + 1}: ${issue.message}`)
          .join(" "),
      );
    }

    onProgress?.("Checking package metadata...");
    await fetchNotebookPackageManifest(
      dependency.packageName,
      dependency.version,
    );

    onProgress?.("Saving package...");
    await this.updateSettings({ runtimeDependencies });
  }

  async getNotebookInspectorSnapshot(): Promise<NotebookInspectorSnapshot | null> {
    const context = await this.loadActiveNotebookInspectorContext();
    if (!context) {
      return null;
    }

    const runtimeSnapshot = this.runtimeController.getOrCreateGraphSnapshot(
      context.document,
    );
    const duckDbCatalog = await this.inspectDuckDbCatalog(context.document);

    return buildNotebookInspectorSnapshot({
      file: context.file,
      document: context.document,
      graph: runtimeSnapshot.graph,
      duckDbCatalog,
    });
  }

  async getNotebookDependencySnapshot(): Promise<NotebookDependencySnapshot | null> {
    const context = await this.loadActiveNotebookInspectorContext();
    if (!context) {
      return null;
    }

    const runtimeSnapshot = this.runtimeController.getOrCreateGraphSnapshot(
      context.document,
    );

    return buildNotebookDependencySnapshot({
      file: context.file,
      document: context.document,
      graph: runtimeSnapshot.graph,
      getCellState: (cellId) => runtimeSnapshot.getCellState(cellId),
    });
  }

  async getNotebookPackagesSnapshot(): Promise<NotebookPackagesSnapshot | null> {
    const context = await this.loadActiveNotebookInspectorContext();
    if (!context) {
      return buildNotebookPackagesSnapshot({
        file: {
          path: "GlobalPackages.notebook.md",
          basename: "Global Packages",
        },
        document: parseNotebookDocument("", {
          sourcePath: "GlobalPackages.notebook.md",
        }),
        runtimeDependencies: this.settings.runtimeDependencies,
        hasActiveNotebook: false,
      });
    }

    const baseSnapshot = buildNotebookPackagesSnapshot({
      file: context.file,
      document: context.document,
      runtimeDependencies: this.settings.runtimeDependencies,
    });

    const directImports = baseSnapshot.directImports
      .filter((entry) => entry.status === "configured")
      .map((entry) => this.settings.runtimeDependencies[entry.entryIndex ?? -1])
      .filter(
        (entry): entry is (typeof this.settings.runtimeDependencies)[number] =>
          Boolean(entry),
      );

    if (directImports.length === 0) {
      return {
        ...baseSnapshot,
        indirectImportsStatus: {
          kind: "unavailable",
          message:
            "Direct imports from this notebook will populate transitive packages here.",
        },
      };
    }

    const resolved = await resolveNotebookIndirectImports(directImports);

    return buildNotebookPackagesSnapshot({
      file: context.file,
      document: context.document,
      runtimeDependencies: this.settings.runtimeDependencies,
      indirectImports: resolved.imports,
      indirectImportsStatus:
        resolved.errors.length > 0
          ? {
              kind: "error",
              message: resolved.errors.join(" "),
            }
          : {
              kind: "ready",
              message:
                resolved.imports.length === 0
                  ? "No transitive package dependencies were declared by the current direct imports."
                  : `Loaded transitive dependencies for ${directImports.length} direct import${directImports.length === 1 ? "" : "s"}.`,
            },
    });
  }

  async openNotebookPackages(reveal = true): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(NotebookPackagesViewType);
    if (leaves.length > 0) {
      if (reveal) {
        for (const leaf of leaves) {
          await this.app.workspace.revealLeaf(leaf);
        }
      }
      return;
    }

    const leaf = this.app.workspace.ensureSideLeaf(
      NotebookPackagesViewType,
      "right",
    );
    await leaf.setViewState(
      { type: NotebookPackagesViewType },
      { history: true },
    );
    if (reveal) {
      await this.app.workspace.revealLeaf(leaf);
    }
  }

  async loadNotebookInspectorTablePreview(
    sourcePath: string,
    schemaName: string,
    tableName: string,
    rowCount: number | null,
  ): Promise<NotebookInspectorTablePreview | null> {
    const context = await this.loadNotebookInspectorContextByPath(sourcePath);
    const runtimePromise = this.getExistingRuntime(sourcePath);
    if (!context || !runtimePromise) {
      return null;
    }

    const runtime = await runtimePromise.catch(() => null);
    const preview = await runtime?.inspectDuckDbTablePreview?.(
      context.document,
      schemaName,
      tableName,
      5,
    );
    if (!preview) {
      return null;
    }

    return {
      columns: preview.columns,
      rows: preview.rows.map((row) =>
        preview.columns.map((column) => row[column]),
      ),
      truncated:
        rowCount !== null &&
        rowCount !== undefined &&
        rowCount > preview.rows.length,
    };
  }

  private async refreshNotebookInspectorViews(): Promise<void> {
    await Promise.all(
      Array.from(this.inspectorViews, (view) => view.refreshView()),
    );
  }

  private async refreshNotebookDependenciesViews(): Promise<void> {
    await Promise.all(
      Array.from(this.dependenciesViews, (view) => view.refreshView()),
    );
  }

  private async refreshNotebookPackagesViews(): Promise<void> {
    await Promise.all(
      Array.from(this.packagesViews, (view) => view.refreshView()),
    );
  }

  private async openNotebookInspector(reveal: boolean): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(
      NotebookInspectorViewType,
    );
    if (leaves.length > 0) {
      if (reveal) {
        for (const leaf of leaves) {
          await this.app.workspace.revealLeaf(leaf);
        }
      }
      return;
    }

    const leaf = this.app.workspace.ensureSideLeaf(
      NotebookInspectorViewType,
      "right",
    );
    await leaf.setViewState(
      { type: NotebookInspectorViewType },
      { history: true },
    );
    if (reveal) {
      await this.app.workspace.revealLeaf(leaf);
    }
  }

  private async openNotebookDependencies(reveal: boolean): Promise<void> {
    const leaves = this.app.workspace.getLeavesOfType(
      NotebookDependenciesViewType,
    );
    if (leaves.length > 0) {
      if (reveal) {
        for (const leaf of leaves) {
          await this.app.workspace.revealLeaf(leaf);
        }
      }
      return;
    }

    const leaf = this.app.workspace.ensureSideLeaf(
      NotebookDependenciesViewType,
      "left",
    );
    await leaf.setViewState(
      { type: NotebookDependenciesViewType },
      { history: true },
    );
    if (reveal) {
      await this.app.workspace.revealLeaf(leaf);
    }
  }

  private async loadNotebookInspectorContextByPath(
    sourcePath: string,
  ): Promise<{
    file: TFile;
    document: NotebookDocument;
  } | null> {
    const file = this.app.vault.getFileByPath(sourcePath);
    if (!(file instanceof TFile)) {
      return null;
    }

    const cachedSource = await this.app.vault.cachedRead(file);
    const openLeaf = this.findNotebookLeafForPath(sourcePath);
    const openView = openLeaf?.view as
      | {
          file?: TFile;
          editor?: { getValue: () => string };
        }
      | undefined;
    const source =
      openView?.file?.path === sourcePath
        ? (openView.editor?.getValue() ?? cachedSource)
        : cachedSource;
    const document = parseNotebookDocument(source, {
      sourcePath,
      frontmatter:
        this.app.metadataCache.getFileCache(file)?.frontmatter?.notebook,
    });

    return document.enabled ? { file, document } : null;
  }

  private async loadActiveNotebookInspectorContext(): Promise<{
    file: TFile;
    document: NotebookDocument;
  } | null> {
    // Panel context resolves the active notebook leaf, falling back to any
    // open notebook when a panel itself holds the active leaf (panel views
    // are main-area tabs in the current workspace, unlike the legacy
    // sidebars where the document leaf kept active status).
    const file =
      this.getNotebookFile(this.app.workspace.activeLeaf) ??
      this.findAnyNotebookFile();
    if (!file) {
      return null;
    }

    return this.loadNotebookInspectorContextByPath(file.path);
  }

  private async inspectDuckDbCatalog(
    document: NotebookDocument,
  ): Promise<NotebookDuckDbCatalog | null> {
    const runtimePromise = this.getExistingRuntime(document.sourcePath);
    if (!runtimePromise) {
      return null;
    }

    const runtime = await runtimePromise.catch(() => null);
    if (!runtime?.inspectDuckDbCatalog) {
      return null;
    }

    return runtime.inspectDuckDbCatalog(document);
  }
}

export default NotebookPlugin;

function escapeNotebookCellSelector(value: string): string {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }

  return value.replaceAll('"', '\\"');
}

function pulseNotebookCell(element: HTMLElement): void {
  element.animate(
    [
      {
        boxShadow: "0 0 0 0 rgba(180, 120, 16, 0)",
        backgroundColor: "transparent",
      },
      {
        boxShadow: "0 0 0 3px rgba(180, 120, 16, 0.18)",
        backgroundColor: "rgba(180, 120, 16, 0.08)",
      },
      {
        boxShadow: "0 0 0 0 rgba(180, 120, 16, 0)",
        backgroundColor: "transparent",
      },
    ],
    { duration: 900, easing: "ease-out" },
  );
}

function nextAnimationFrame(): Promise<void> {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

