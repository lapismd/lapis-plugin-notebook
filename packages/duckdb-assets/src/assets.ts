import { NOTEBOOK_DUCKDB_ASSET_PATHS } from "./paths";

export { NOTEBOOK_DUCKDB_ASSET_PATHS } from "./paths";

export interface NotebookDuckDbAssetBundle {
  mainModule: string;
  mainWorker: string;
}

export interface NotebookDuckDbAssetBundles {
  mvp: NotebookDuckDbAssetBundle;
  eh: NotebookDuckDbAssetBundle;
}

export type NotebookDuckDbAssetUrlResolver = (
  relativePath: string,
) => string | Promise<string>;

async function resolveBundlePaths(
  resolveAssetUrl: NotebookDuckDbAssetUrlResolver,
): Promise<NotebookDuckDbAssetBundles> {
  const [mvpModule, mvpWorker, ehModule, ehWorker] = await Promise.all([
    resolveAssetUrl(NOTEBOOK_DUCKDB_ASSET_PATHS.mvp.mainModule),
    resolveAssetUrl(NOTEBOOK_DUCKDB_ASSET_PATHS.mvp.mainWorker),
    resolveAssetUrl(NOTEBOOK_DUCKDB_ASSET_PATHS.eh.mainModule),
    resolveAssetUrl(NOTEBOOK_DUCKDB_ASSET_PATHS.eh.mainWorker),
  ]);

  return {
    mvp: {
      mainModule: mvpModule,
      mainWorker: mvpWorker,
    },
    eh: {
      mainModule: ehModule,
      mainWorker: ehWorker,
    },
  };
}

export async function getNotebookDuckDbBundles(
  resolveAssetUrl?: NotebookDuckDbAssetUrlResolver,
): Promise<NotebookDuckDbAssetBundles> {
  return resolveBundlePaths(
    resolveAssetUrl ?? ((relativePath) => relativePath),
  );
}
