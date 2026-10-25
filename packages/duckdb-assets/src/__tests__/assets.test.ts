import { describe, expect, test } from "vitest";
import { getNotebookDuckDbBundles, NOTEBOOK_DUCKDB_ASSET_PATHS } from "..";

describe("notebook DuckDB assets", () => {
  test("returns mvp and eh bundle URL mappings from a resolver", async () => {
    const bundles = await getNotebookDuckDbBundles((relativePath) => {
      return `https://assets.example.test/plugins/lapis-notebook/${relativePath}`;
    });

    expect(bundles.mvp.mainModule).toBe(
      `https://assets.example.test/plugins/lapis-notebook/${NOTEBOOK_DUCKDB_ASSET_PATHS.mvp.mainModule}`,
    );
    expect(bundles.mvp.mainWorker).toContain("duckdb-browser-mvp.worker.js");
    expect(bundles.eh.mainModule).toContain("duckdb-eh.wasm");
    expect(bundles.eh.mainWorker).toContain("duckdb-browser-eh.worker.js");
  });

  test("defaults to plugin-relative paths when no resolver is provided", async () => {
    const bundles = await getNotebookDuckDbBundles();

    expect(bundles.mvp.mainModule).toBe(
      NOTEBOOK_DUCKDB_ASSET_PATHS.mvp.mainModule,
    );
    expect(bundles.mvp.mainWorker).toBe(
      NOTEBOOK_DUCKDB_ASSET_PATHS.mvp.mainWorker,
    );
  });
});
