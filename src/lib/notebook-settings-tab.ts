import { PluginSettingTab, Setting, type App } from "@lapis-notes/api";
import type { NotebookPlugin } from "./notebook-plugin";
import type { NotebookPluginSettingsPatch } from "./notebook-settings";

export class NotebookSettingsTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly notebookPlugin: NotebookPlugin,
  ) {
    super(app, notebookPlugin);
  }

  display(): void {
    const { containerEl } = this;
    const settings = this.notebookPlugin.getSettings();
    containerEl.empty();

    new Setting(containerEl)
      .setName("Auto-run stale cells on cell changes")
      .setDesc(
        "Automatically rerun the notebook's stale cells after a notebook cell source change marks them stale.",
      )
      .addToggle((toggle) => {
        toggle
          .setValue(settings.execution.autoRunStaleOnCellChange)
          .onChange((value) => {
            void this.updateSettings({
              execution: { autoRunStaleOnCellChange: value },
            });
          });
      });

    new Setting(containerEl)
      .setName("Open sources panel with notebook")
      .setDesc(
        "Automatically open the notebook sources and data panel when a notebook file becomes active.",
      )
      .addToggle((toggle) => {
        toggle
          .setValue(settings.panels.autoOpenSourcesOnNotebookOpen)
          .onChange((value) => {
            void this.updateSettings({
              panels: { autoOpenSourcesOnNotebookOpen: value },
            });
          });
      });

    new Setting(containerEl)
      .setName("Open dependencies panel with notebook")
      .setDesc(
        "Automatically open the notebook dependencies panel when a notebook file becomes active.",
      )
      .addToggle((toggle) => {
        toggle
          .setValue(settings.panels.autoOpenDependenciesOnNotebookOpen)
          .onChange((value) => {
            void this.updateSettings({
              panels: { autoOpenDependenciesOnNotebookOpen: value },
            });
          });
      });

    new Setting(containerEl)
      .setName("Default dependency view")
      .setDesc(
        "Choose which dependency tab opens by default in the notebook dependencies panel.",
      )
      .addDropdown((dropdown) => {
        dropdown
          .addOption("minimap", "Minimap")
          .addOption("graph", "Graph")
          .setValue(settings.dependencyView.defaultTab)
          .onChange((value) => {
            void this.updateSettings({
              dependencyView: { defaultTab: value as "minimap" | "graph" },
            });
          });
      });

    new Setting(containerEl)
      .setName("Default graph layout")
      .setDesc(
        "Choose whether the dependency graph defaults to a vertical or horizontal tree layout.",
      )
      .addDropdown((dropdown) => {
        dropdown
          .addOption("vertical", "Vertical tree")
          .addOption("horizontal", "Horizontal tree")
          .setValue(settings.dependencyView.graphOrientation)
          .onChange((value) => {
            void this.updateSettings({
              dependencyView: {
                graphOrientation: value as "vertical" | "horizontal",
              },
            });
          });
      });

    new Setting(containerEl)
      .setName("Dependency graph wheel zoom")
      .setDesc(
        "Adjust how quickly the notebook dependency graph zooms in and out when using the mouse wheel.",
      )
      .addSlider((slider) => {
        slider
          .setDynamicTooltip()
          .setLimits(0.25, 2, 0.05)
          .setValue(settings.dependencyView.wheelZoomSensitivity)
          .onChange((value) => {
            void this.updateSettings({
              dependencyView: { wheelZoomSensitivity: Number(value) },
            });
          });
      });

    // Stage 3 re-adds the legacy "Runtime packages" and "Runtime dependency
    // status" rows with their Open-packages buttons once the Packages side
    // view (openNotebookPackages) and the dependency-registry validation UI
    // port with the render/runtime stages.
  }

  private async updateSettings(
    patch: NotebookPluginSettingsPatch,
  ): Promise<void> {
    await this.notebookPlugin.updateSettings(patch);
    this.display();
  }
}
