import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { rollup } from "rollup";
import { dts } from "rollup-plugin-dts";
import { checkNpmPackage } from "./check-npm-package.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0) throw Error(`${command} failed (${result.status})`);
}
run("pnpm", [
  "exec",
  "svelte-package",
  "--tsconfig",
  "tsconfig.pack.json",
  "--output",
  ".local/npm-types",
]);
run(process.execPath, ["scripts/build-plugin-bundle.mjs"]);
const declarations = await rollup({
  input: join(root, ".local/npm-types/index.d.ts"),
  plugins: [dts({ tsconfig: join(root, "tsconfig.pack.json") })],
  external: (id) =>
    !id.startsWith(".") &&
    !id.startsWith("/") &&
    !id.startsWith("@lapis-notes/notebook-") &&
    !id.startsWith("$lib"),
  onwarn(warning, warn) {
    if (warning.code === "UNRESOLVED_IMPORT") throw Error(warning.message);
    warn(warning);
  },
});
try {
  await declarations.write({
    file: join(root, "dist/index.d.ts"),
    format: "es",
  });
} finally {
  await declarations.close();
}
writeFileSync(join(root, "dist/styles.css"), '@import "./app.css";\n');
run(process.execPath, ["scripts/check-bundle-exclusions.mjs"]);
checkNpmPackage(root);
run("pnpm", ["exec", "publint"]);
