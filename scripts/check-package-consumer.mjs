import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { checkNpmPackage } from "./check-npm-package.mjs";
import { publicConsumerEntry } from "./package-consumer-entry.mjs";
import { consumerArchiveConfiguration } from "./consumer-archives.mjs";
import { productionBuildArguments } from "./package-consumer-build.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2).filter((arg) => arg !== "--");
if (args.some((arg) => arg !== "--already-built"))
  throw Error("Use --already-built or no arguments");
function run(command, argv, cwd, capture = false) {
  const result = spawnSync(command, argv, {
    cwd,
    encoding: "utf8",
    stdio: capture ? "pipe" : "inherit",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0)
    throw Error(
      `${command} failed (${result.status})\n${result.stdout ?? ""}\n${result.stderr ?? ""}`,
    );
  return result.stdout;
}
if (!args.includes("--already-built")) run("pnpm", ["build"], root);
checkNpmPackage(root);
const pkg = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
const manifest = JSON.parse(
  await readFile(join(root, "dist/manifest.json"), "utf8"),
);
if (manifest.version !== pkg.version)
  throw Error("Built manifest version does not match package metadata");
const directory = await mkdtemp(join(tmpdir(), "notebook-npm-consumer-"));
let passed = false;
try {
  const [packed] = JSON.parse(
    run(
      "npm",
      ["pack", "--ignore-scripts", "--json", "--pack-destination", directory],
      root,
      true,
    ),
  );
  const tarball = join(directory, packed.filename);
  const versions = {};
  for (const name of [
    "svelte",
    "vite",
    "typescript",
    "@types/node",
    "@sveltejs/vite-plugin-svelte",
  ])
    versions[name] = JSON.parse(
      await readFile(join(root, "node_modules", name, "package.json"), "utf8"),
    ).version;
  const candidate = await consumerArchiveConfiguration(directory);
  await writeFile(
    join(directory, "package.json"),
    JSON.stringify(
      {
        private: true,
        type: "module",
        dependencies: {
          ...pkg.peerDependencies,
          svelte: versions.svelte,
          ...candidate?.dependencies,
          [pkg.name]: tarball,
        },
        ...(candidate ? { pnpm: candidate.pnpm } : {}),
        devDependencies: versions,
      },
      null,
      2,
    ),
  );
  run(
    candidate ? "pnpm" : "npm",
    ["install", "--ignore-scripts", "--registry=https://registry.npmjs.org"],
    directory,
  );
  const installed = JSON.parse(
    await readFile(
      join(directory, "node_modules", pkg.name, "package.json"),
      "utf8",
    ),
  );
  const installedSvelte = JSON.parse(
    await readFile(join(directory, "node_modules/svelte/package.json"), "utf8"),
  );
  if (installedSvelte.version !== versions.svelte)
    throw Error("Packed host must use the exact compiler runtime version");
  if (installed.version !== pkg.version)
    throw Error("Clean consumer installed a different package version");
  await writeFile(
    join(directory, "index.html"),
    '<!doctype html><html><head><link rel="icon" href="data:,"></head><body><output id="result"></output><div id="app"></div><script type="module" src="/bootstrap.ts"></script></body></html>',
  );
  await writeFile(
    join(directory, "entry.ts"),
    publicConsumerEntry(
      pkg.name,
      manifest.lapis.runtime.entries.workspace.sharedDependencies,
    ),
  );
  await writeFile(
    join(directory, "Consumer.svelte"),
    `<script lang="ts">
import { onMount } from "svelte";
import { verifyPublicConsumer } from "./entry";
let { onReady }: { onReady: () => void } = $props();
onMount(() => {
  void verifyPublicConsumer().then(onReady).catch((error) => {
    queueMicrotask(() => { throw error; });
  });
});
</script>`,
  );
  await writeFile(
    join(directory, "bootstrap.ts"),
    `import { mount, unmount } from "svelte";
import Consumer from "./Consumer.svelte";
const component = mount(Consumer, { target: document.querySelector("#app")!, props: {
  onReady: () => { void unmount(component); }
} });`,
  );
  await writeFile(
    join(directory, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        module: "esnext",
        moduleResolution: "bundler",
        target: "esnext",
        lib: ["ESNext", "DOM", "DOM.Iterable"],
        strict: true,
        skipLibCheck: true,
        noEmit: true,
      },
      include: ["entry.ts"],
    }),
  );
  run(
    process.execPath,
    [join(directory, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.json"],
    directory,
  );
  await writeFile(
    join(directory, "vite.config.mjs"),
    `
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { tursoBundleBuildPlugin, rendererHostModulePlugin } from "@lapis-notes/api/build/vite";
export default { plugins: [rendererHostModulePlugin({ mode: "host", svelteVersion: ${JSON.stringify(versions.svelte)} }), svelte(), tursoBundleBuildPlugin()], resolve: { dedupe: ["svelte", "@lapis-notes/api", "@codemirror/state", "@codemirror/view"] }, esbuild: { target: "esnext" }, optimizeDeps: { esbuildOptions: { target: "esnext" } }, build: { target: "esnext", minify: false } };
`,
  );
  const vite = join(directory, "node_modules/vite/bin/vite.js");
  for (const mode of ["development", "production"]) {
    if (mode === "production")
      run(process.execPath, productionBuildArguments(vite), directory);
    const reservation = createServer();
    await new Promise((accept) => reservation.listen(0, "127.0.0.1", accept));
    const port = reservation.address().port;
    await new Promise((accept) => reservation.close(accept));
    const server = spawn(
      process.execPath,
      [
        vite,
        ...(mode === "production" ? ["preview"] : []),
        "--host",
        "127.0.0.1",
        "--port",
        String(port),
        "--strictPort",
      ],
      { cwd: directory, detached: true, stdio: ["ignore", "pipe", "pipe"] },
    );
    let output = "";
    const ready = new Promise((accept, reject) => {
      const timer = setTimeout(
        () => reject(Error(`Consumer server did not start\n${output}`)),
        60_000,
      );
      const read = (chunk) => {
        output += chunk;
        if (
          output
            .replace(/\u001b\[[0-9;]*m/gu, "")
            .includes(`http://127.0.0.1:${port}/`)
        ) {
          clearTimeout(timer);
          accept();
        }
      };
      server.stdout.on("data", read);
      server.stderr.on("data", read);
      server.once("exit", (code) => {
        clearTimeout(timer);
        reject(Error(`Consumer server exited ${code}\n${output}`));
      });
    });
    let browser;
    const errors = [];
    try {
      await ready;
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      page.on("pageerror", (error) =>
        errors.push(error.stack ?? error.message),
      );
      page.on("console", (message) => {
        if (message.type() === "error" || message.type() === "warning")
          errors.push(message.text());
      });
      await page.goto(`http://127.0.0.1:${port}/`);
      await page
        .getByText("Notebook package ready", { exact: true })
        .waitFor({ timeout: 90_000 });
    } catch (error) {
      throw Error(
        `${mode} consumer failed: ${error.message}\n${errors.join("\n")}\n${output}`,
        { cause: error },
      );
    } finally {
      await browser?.close();
      if (server.exitCode === null) {
        const stopped = new Promise((accept) => server.once("exit", accept));
        process.kill(-server.pid, "SIGTERM");
        await stopped;
      }
    }
    if (errors.length)
      throw Error(`${mode} consumer diagnostics:\n${errors.join("\n")}`);
    console.log(`Cold ${mode} public npm consumer passed.`);
  }
  console.log(
    JSON.stringify({
      package: `${pkg.name}@${pkg.version}`,
      sha256: createHash("sha256")
        .update(await readFile(tarball))
        .digest("hex"),
      typecheck: "passed",
      browserConsumers: 2,
      candidateArchives: candidate?.receipts ?? [],
    }),
  );
  passed = true;
} finally {
  if (passed) await rm(directory, { recursive: true, force: true });
  else console.error(`Retained failed package consumer: ${directory}`);
}
