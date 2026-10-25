import {
  App,
  installApplicationCompatibility,
  MemoryAppDatabase,
  MemoryVaultAdapter,
  registerDefaultDailyDocumentProvider,
} from "@lapis-notes/api";
import { FileExplorerPlugin } from "@lapis-notes/file-explorer";
import { MarkdownPlugin } from "@lapis-notes/markdown";
import { SearchPlugin } from "@lapis-notes/search";

import { NotebookPlugin, NOTEBOOK_PLUGIN_ID } from "../lib";
import {
  NOTEBOOK_FIXTURE_PATHS,
  notebookWorkspaceMarkdownFixtures,
} from "./notebook-fixtures";

function leaf(
  id: string,
  title: string,
  icon: string,
  type: string,
  state: Record<string, unknown> = {},
) {
  return {
    id,
    type: "leaf",
    state: { type, state, icon, title },
  };
}

function workspaceLayout() {
  return {
    main: {
      id: "main",
      type: "split",
      direction: "vertical",
      sizes: [100],
      children: [
        {
          id: "notebook-tabs",
          type: "tabs",
          stacked: false,
          currentTab: 0,
          children: [
            leaf("note-welcome", "welcome", "file-text", "markdown", {
              file: NOTEBOOK_FIXTURE_PATHS.welcome,
            }),
          ],
        },
      ],
    },
    left: {
      id: "left",
      type: "split",
      direction: "vertical",
      sizes: [100],
      children: [
        {
          id: "left-tabs",
          type: "tabs",
          stacked: false,
          currentTab: 0,
          children: [
            leaf("file-explorer", "Files", "folder-closed", "file-explorer"),
          ],
        },
      ],
      width: "16rem",
    },
    right: {
      id: "right",
      type: "split",
      direction: "vertical",
      sizes: [100],
      children: [
        {
          id: "right-tabs",
          type: "tabs",
          stacked: false,
          currentTab: 0,
          children: [leaf("search", "Search", "search", "search")],
        },
      ],
      width: "0px",
    },
    bottom: {
      id: "bottom",
      type: "tabs",
      currentTab: 0,
      children: [],
      height: "0px",
    },
    floating: [],
    active: "note-welcome",
  };
}

export function createPluginWorkspaceSeed(): Record<string, string> {
  return {
    ".lapis/app.json": JSON.stringify(
      {
        "editor.defaultViewForNewTabs": "editing",
        "editor.alwaysFocusNewTabs": true,
        "appearence.interface.showTabTitleBar": true,
        "workspace.fileExplorer.autoRevealCurrentFile": true,
      },
      null,
      2,
    ),
    ".lapis/workspace.json": JSON.stringify(workspaceLayout(), null, 2),
    ...Object.fromEntries(
      notebookWorkspaceMarkdownFixtures().map((fixture) => [
        fixture.path,
        fixture.raw,
      ]),
    ),
  };
}

export async function bootPluginWorkspaceDemo(): Promise<{
  app: App;
  dispose: () => Promise<void>;
}> {
  const app = new App({
    version: "0.0.1-story",
    configPath: ".lapis/app.json",
    adapter: new MemoryVaultAdapter(createPluginWorkspaceSeed(), {
      name: "Notebook Plugin Workspace",
      vaultId: "notebook-plugin-workspace",
      clock: 1_700_000_000_000,
    }),
    appDatabase: new MemoryAppDatabase("notebook-plugin-workspace"),
    workspaceShell: { application: { name: "Lapis Notes" } },
    markdownRenderer: async () => {},
  });
  const disposeApplicationCompatibility = installApplicationCompatibility(app);
  const dailyDocumentProvider = registerDefaultDailyDocumentProvider(app);

  app.plugins.registerCorePlugins([
    {
      plugin: MarkdownPlugin,
      required: false,
      enabledByDefault: true,
    },
    {
      plugin: FileExplorerPlugin,
      required: false,
      enabledByDefault: true,
    },
    { plugin: SearchPlugin, required: false, enabledByDefault: true },
    {
      plugin: NotebookPlugin,
      required: false,
      enabledByDefault: true,
      distribution: "first-party-external",
    },
  ]);

  await app.vault.load();
  await app.configuration.load();
  await app.plugins.loadPlugins({
    communityPlugins: "disabled",
    optionalCorePlugins: "configured",
  });
  const notebookPlugin = app.plugins.plugins.get(NOTEBOOK_PLUGIN_ID);
  if (!(notebookPlugin instanceof NotebookPlugin)) {
    throw new Error(
      "The Notebook workspace fixture could not resolve NotebookPlugin.",
    );
  }
  const stopWatchingMetadata = app.metadataTypeManager.trackChanges();
  await app.metadataCache.load();
  const searchPlugin = app.plugins.plugins.get("search");
  if (searchPlugin instanceof SearchPlugin) {
    await searchPlugin.refreshIndex("notebook-plugin-workspace");
  }
  await app.workspace.loadLayout();

  return {
    app,
    dispose: async () => {
      stopWatchingMetadata();
      for (const plugin of [...app.plugins.corePlugins].reverse()) {
        await plugin.disable().catch(() => undefined);
      }
      await app.workspace.disposeWorkspaceHost();
      await app.appDatabase.close();
      dailyDocumentProvider.dispose();
      disposeApplicationCompatibility();
    },
  };
}
