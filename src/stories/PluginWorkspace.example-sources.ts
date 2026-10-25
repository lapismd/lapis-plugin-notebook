export const PluginWorkspaceExample = `<script lang="ts">
  import { onMount } from "svelte";
  import { App, installApplicationCompatibility, MemoryAppDatabase, MemoryVaultAdapter } from "@lapis-notes/api";
  import { FileExplorerPlugin } from "@lapis-notes/file-explorer";
  import { NotebookPlugin } from "@lapis-notes/lapis-plugin-notebook";
  import { MarkdownPlugin } from "@lapis-notes/markdown";
  import { SearchPlugin } from "@lapis-notes/search";
  import { WorkspaceShell } from "@lapis-notes/workspace";

  const layout = {
    main: { id: "main", type: "split", direction: "vertical", sizes: [100],
      children: [{ id: "notebook-tabs", type: "tabs", currentTab: 0, children: [
        { id: "note-welcome", type: "leaf",
          state: { type: "markdown", state: { file: "welcome.md" }, title: "welcome" } },
      ] }],
    },
    left: { id: "left", type: "split", direction: "vertical", sizes: [100],
      children: [{ id: "left-tabs", type: "tabs", currentTab: 0, children: [
        { id: "files", type: "leaf", state: { type: "file-explorer", state: {}, title: "Files" } },
      ] }], width: "16rem" },
    right: { id: "right", type: "split", direction: "vertical", sizes: [100],
      children: [{ id: "right-tabs", type: "tabs", currentTab: 0, children: [
        { id: "search", type: "leaf", state: { type: "search", state: {}, title: "Search" } },
      ] }], width: "0px" },
    bottom: { id: "bottom", type: "tabs", currentTab: 0, children: [], height: "0px" },
    floating: [], active: "note-welcome",
  };
  const app = new App({
    version: "1.0.0",
    configPath: ".lapis/app.json",
    adapter: new MemoryVaultAdapter({
      ".lapis/app.json": "{}",
      ".lapis/workspace.json": JSON.stringify(layout),
      "welcome.md": welcomeMarkdown,
      "Getting Started.notebook.md": gettingStartedNotebook,
    }),
    appDatabase: new MemoryAppDatabase("notebook-story"),
    markdownRenderer: async () => {},
  });
  const disposeApplicationCompatibility = installApplicationCompatibility(app);
  app.plugins.registerCorePlugins([
    { plugin: MarkdownPlugin, required: false, enabledByDefault: true },
    { plugin: FileExplorerPlugin, required: false, enabledByDefault: true },
    { plugin: SearchPlugin, required: false, enabledByDefault: true },
    { plugin: NotebookPlugin, required: false, enabledByDefault: true,
      distribution: "first-party-external" },
  ]);

  let ready = false;
  onMount(() => void (async () => {
    await app.vault.load();
    await app.configuration.load();
    await app.plugins.loadPlugins({ communityPlugins: "disabled", optionalCorePlugins: "configured" });
    await app.metadataCache.load();
    await app.workspace.loadLayout();
    ready = true;
    return disposeApplicationCompatibility;
  })());
</script>

{#if ready}
  <WorkspaceShell {app} displayMode="desktop" workspaceLabel="Notebook" />
{/if}`;
