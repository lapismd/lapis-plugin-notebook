import {
  Notice,
  Plugin,
  type App,
  type PluginManifest,
  type TFile,
} from "@lapis-notes/api";

import { createDemoNotebooks } from "./commands/create-demo-notebooks";
import { NotebookCellSuggest } from "./commands/notebook-cell-suggest";
import {
  isMarkdownFile,
  isNotebookFile,
  toNotebookFilePath,
} from "./notebook-file";
import {
  mergeNotebookSettings,
  patchNotebookSettings,
  type NotebookPluginSettings,
  type NotebookPluginSettingsPatch,
} from "./notebook-settings";
import { NotebookSettingsTab } from "./notebook-settings-tab";
import { NotebookView, NotebookViewType } from "./notebook-view";
import type { NotebookCellLanguage } from "./templates/cells";

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

/**
 * First-party external Notebook plugin (staged port of the legacy
 * `@lapis-notes/notebook` plugin).
 *
 * Stage 2 registers the document surface: the `.notebook.md` file-type
 * association and editor view, the slash-menu cell suggest, the settings
 * tab, and the authoring commands that do not require the execution
 * runtime. Run/clear commands, status-bar context keys, cell rendering,
 * panels, and the runtime controller land with later stages per
 * `spec/src/plugins/notebook/`.
 */
export class NotebookPlugin extends Plugin {
  private settings: NotebookPluginSettings = mergeNotebookSettings(null);

  constructor(app: App, pluginManifest: PluginManifest = MANIFEST) {
    super(app, pluginManifest);
  }

  async onload(): Promise<void> {
    await this.initializeSettings();
    this.app.metadataTypeManager.setType("notebook.autorun", "checkbox");

    this.registerView(
      NotebookViewType,
      (leaf) => new NotebookView(leaf),
      { kind: "file" },
    );
    this.registerEditorView({
      id: NotebookViewType,
      label: "Notebook",
      filenamePatterns: ["*.notebook.md"],
      priority: "default",
    });
    this.registerExtensions(["notebook.md"], NotebookViewType);
    this.registerEditorSuggest(new NotebookCellSuggest(this.app), "markdown");
    this.addSettingTab(new NotebookSettingsTab(this.app, this));

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
      callback: () => this.runCommand(() => createDemoNotebooks(this.app)),
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

  getSettings(): NotebookPluginSettings {
    return mergeNotebookSettings(this.settings);
  }

  async updateSettings(patch: NotebookPluginSettingsPatch): Promise<void> {
    // Stage 4 re-adds the legacy autorun timer reconciliation here when the
    // runtime controller owns stale-cell timers.
    this.settings = patchNotebookSettings(this.settings, patch);
    const snapshot = this.getSettings();
    await this.saveData(snapshot);
  }

  private async initializeSettings(): Promise<void> {
    const storedData = await this.loadData();
    this.settings = mergeNotebookSettings(storedData);
    await this.saveData(this.settings);
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
}

export default NotebookPlugin;
