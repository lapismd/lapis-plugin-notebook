/** Exercise the packed runtime through public host APIs, including teardown. */
export function publicConsumerEntry(packageName, sharedDependencies) {
  return `
import NotebookPlugin, { parseNotebookDocument, buildCellTemplate } from ${JSON.stringify(packageName)};
import { App, Plugin, MemoryAppDatabase, MemoryVaultAdapter, installApplicationCompatibility } from "@lapis-notes/api";
import { pluginHostModuleRegistry, isPluginHostModuleSpecifier } from "@lapis-notes/api/plugin-host-modules";
import ${JSON.stringify(packageName + "/styles.css")};

const parsed = parseNotebookDocument(buildCellTemplate("ts", "answer"), { sourcePath: "Packed.notebook.md" });
const count: number = parsed.cells.length;
const source: string = parsed.cells[0]!.source;
if (!(NotebookPlugin.prototype instanceof Plugin) || count !== 1 || parsed.cells[0]!.id !== "answer" || !source.includes("Hello from Lapis notebooks")) throw Error("Public package contract failed");

const catalog: Record<string, { public: boolean; platforms: readonly string[] }> = pluginHostModuleRegistry;
for (const id of ${JSON.stringify(sharedDependencies)}) {
  for (const platform of ["web", "electron-renderer"]) {
    if (!isPluginHostModuleSpecifier(id) || !catalog[id]?.platforms.includes(platform))
      throw Error("Undeclared host module for " + platform + ": " + id);
  }
}

export async function verifyPublicConsumer() {
const app = new App({
  version: "0.0.1",
  configPath: ".lapis/app.json",
  adapter: new MemoryVaultAdapter({ ".lapis/app.json": "{}" }, { name: "Packed Notebook", vaultId: "packed-notebook" }),
  appDatabase: new MemoryAppDatabase("packed-notebook"),
  markdownRenderer: async () => {},
});
const releaseCompatibility = installApplicationCompatibility(app);
try {
  app.plugins.registerStaticPlugins([{ plugin: NotebookPlugin, required: false, enabledByDefault: true, distribution: "first-party-external" }]);
  await app.vault.load();
  await app.configuration.load();
  await app.plugins.loadPlugins({ communityPlugins: "disabled", optionalCorePlugins: "configured" });
  if (!app.plugins.isPluginEnabled("lapis-notebook") || !(app.plugins.plugins.get("lapis-notebook") instanceof NotebookPlugin))
    throw Error("Packed Notebook did not load through the public host");
  if (!app.commands.getCommand("lapis-notebook:run-active-notebook"))
    throw Error("Packed Notebook did not register its execution command");
} finally {
  for (const plugin of [...app.plugins.corePlugins].reverse()) await plugin.disable();
  await app.workspace.disposeWorkspaceHost();
  await app.appDatabase.close();
  releaseCompatibility();
}
if (app.commands.getCommand("lapis-notebook:run-active-notebook"))
  throw Error("Packed Notebook retained commands after teardown");
document.querySelector("#result")!.textContent = "Notebook package ready";
}
`;
}
