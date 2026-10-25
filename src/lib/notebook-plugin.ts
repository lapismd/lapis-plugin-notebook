import { Plugin, type App, type PluginManifest } from "@lapis-notes/api";

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
 * First-party external Notebook plugin.
 *
 * Stage 0 skeleton: the plugin loads through the public host lifecycle and
 * owns its runtime id. Document registration, cell rendering, execution,
 * persistence, and panel views land in the staged port governed by
 * `spec/src/plugins/notebook/`.
 */
export class NotebookPlugin extends Plugin {
  constructor(app: App, pluginManifest: PluginManifest = MANIFEST) {
    super(app, pluginManifest);
  }

  onload(): void {
    // Intentionally empty in Stage 0. Later stages register the
    // `.notebook.md` editor view, commands, settings, status-bar context
    // keys, and the notebook runtime per LN-NB-002.
  }
}

export default NotebookPlugin;
