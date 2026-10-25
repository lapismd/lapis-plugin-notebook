export const NOTEBOOK_DUCKDB_ASSET_PATHS = {
  mvp: {
    mainModule: "duckdb/duckdb-mvp.wasm",
    mainWorker: "duckdb/duckdb-browser-mvp.worker.js",
  },
  eh: {
    mainModule: "duckdb/duckdb-eh.wasm",
    mainWorker: "duckdb/duckdb-browser-eh.worker.js",
  },
} as const;
