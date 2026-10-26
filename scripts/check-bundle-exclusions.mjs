import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// LN-NB-004 / LN-NB-006 publication audit: the built plugin bundle MUST NOT
// reference forbidden private surfaces, MUST inline the private support
// packages, MUST keep the host-shared modules external, and MUST ship the
// engine assets and runtime manifest entry.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

const findings = [];

function bundleFiles() {
  const files = [];
  const walk = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(?:m?js|css)$/.test(entry.name)) files.push(full);
    }
  };
  walk(dist);
  return files;
}

if (!existsSync(path.join(dist, "main.mjs"))) {
  findings.push("dist/main.mjs is missing (run pnpm build:bundle)");
} else {
  const files = bundleFiles();
  const forbidden = ["@stevejuma/ui", "@lapis-server/", "workspace:*"];
  const inlinedMarkers = [".notebook.md", "notebook-dataframe"];
  const externalMarkers = ['"@lapis-notes/api"', '"svelte"'];
  let sawInlined = false;
  let sawExternal = false;
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    for (const marker of forbidden) {
      if (source.includes(marker)) {
        findings.push(`${path.relative(root, file)} references ${marker}`);
      }
    }
    if (inlinedMarkers.some((marker) => source.includes(marker))) {
      sawInlined = true;
    }
    if (externalMarkers.every((marker) => source.includes(marker))) {
      sawExternal = true;
    }
  }
  if (!sawInlined) {
    findings.push("bundle does not appear to inline the notebook sources");
  }
  if (!sawExternal) {
    findings.push("bundle does not keep @lapis-notes/api and svelte external");
  }

  for (const asset of [
    "duckdb/duckdb-mvp.wasm",
    "duckdb/duckdb-eh.wasm",
    "duckdb/duckdb-browser-mvp.worker.js",
    "duckdb/duckdb-browser-eh.worker.js",
    "manifest.json",
    "app.css",
  ]) {
    const full = path.join(dist, asset);
    if (!statSync(full, { throwIfNoEntry: false })) {
      findings.push(`dist/${asset} is missing`);
    }
  }

  const manifestPath = path.join(dist, "manifest.json");
  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const entry = manifest?.lapis?.runtime?.entries?.workspace;
    if (entry?.path !== "main.mjs" || entry?.format !== "esm") {
      findings.push("dist manifest lacks the workspace runtime entry");
    }
    if (!Array.isArray(entry?.sharedDependencies) || entry.sharedDependencies.length === 0) {
      findings.push("dist manifest lacks sharedDependencies");
    }
    const permissions = manifest?.lapis?.permissions ?? [];
    if (!permissions.includes("network.connect")) {
      findings.push("dist manifest must declare network.connect (LN-NB-008)");
    }
  }
}

if (findings.length) {
  console.error("Bundle exclusion audit failed:");
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}
console.log("Bundle exclusion audit passed.");
