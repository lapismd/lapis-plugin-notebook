import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const DUCKDB_ASSETS = [
  "duckdb-mvp.wasm",
  "duckdb-eh.wasm",
  "duckdb-browser-mvp.worker.js",
  "duckdb-browser-eh.worker.js",
];

function resolveDuckDbDist() {
  const probe = path.join(
    root,
    "node_modules/@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm",
  );
  if (!statSync(probe, { throwIfNoEntry: false })) {
    throw new Error(`Missing DuckDB-WASM assets at ${probe}`);
  }
  return path.dirname(probe);
}

const build = spawnSync(
  process.execPath,
  [
    path.join(root, "node_modules/vite/bin/vite.js"),
    "build",
    "--config",
    "vite.bundle.config.ts",
  ],
  { cwd: root, stdio: "inherit" },
);
if (build.status !== 0) process.exit(build.status ?? 1);

const duckdbDist = resolveDuckDbDist();
const duckdbTarget = path.join(root, "dist/duckdb");
mkdirSync(duckdbTarget, { recursive: true });
for (const asset of DUCKDB_ASSETS) {
  copyFileSync(path.join(duckdbDist, asset), path.join(duckdbTarget, asset));
}
copyFileSync(path.join(root, "manifest.json"), path.join(root, "dist/manifest.json"));

const emitted = readdirSync(path.join(root, "dist")).sort();
console.log(`Plugin bundle written to dist/ (${emitted.length} top-level entries).`);
