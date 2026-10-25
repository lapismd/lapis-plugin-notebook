import type { NotebookDuckDbAssetUrlResolver } from "@lapis-notes/notebook-duckdb-assets";
import type { NotebookDuckDbServiceOptions } from "./duckdb/notebook-duckdb-service";

export const NOTEBOOK_PLUGIN_ID = "lapis-notebook";

interface NotebookPluginRuntimeHost {
  plugins: {
    getPluginFolder(): string;
    pluginAssetServer?: {
      getPluginAssetUrl(request: {
        pluginId: string;
        pluginPath: string;
        relativePath: string;
        version: string;
      }): Promise<string> | string;
    };
  };
}

interface NotebookPluginRuntimeContext {
  manifest: { id: string; version: string };
  basePath: string;
}

function joinPluginPath(...parts: string[]): string {
  return parts.join("/").replace(/\/{2,}/g, "/");
}

export function createNotebookDuckDbServiceOptions(
  app: NotebookPluginRuntimeHost,
  plugin: NotebookPluginRuntimeContext,
): NotebookDuckDbServiceOptions {
  const pluginPath =
    plugin.basePath ||
    joinPluginPath(app.plugins.getPluginFolder(), plugin.manifest.id);

  return {
    resolveAssetUrl: createNotebookPluginAssetUrlResolver(app, {
      pluginId: plugin.manifest.id,
      pluginPath,
      version: plugin.manifest.version,
    }),
  };
}

export function createNotebookPluginAssetUrlResolver(
  app: NotebookPluginRuntimeHost,
  request: {
    pluginId: string;
    pluginPath: string;
    version: string;
  },
): NotebookDuckDbAssetUrlResolver {
  return async (relativePath) => {
    const assetServer = app.plugins.pluginAssetServer;
    if (assetServer) {
      return assetServer.getPluginAssetUrl({
        pluginId: request.pluginId,
        pluginPath: request.pluginPath,
        relativePath,
        version: request.version,
      });
    }

    return new URL(
      relativePath,
      `${normalizePluginBaseUrl(request.pluginPath)}/`,
    ).href;
  };
}

function normalizePluginBaseUrl(pluginPath: string): string {
  if (/^[a-z]+:\/\//i.test(pluginPath)) {
    return pluginPath.endsWith("/") ? pluginPath : `${pluginPath}/`;
  }
  return pluginPath.startsWith("/")
    ? pluginPath
    : `/${pluginPath.replace(/^\/+/, "")}/`;
}
