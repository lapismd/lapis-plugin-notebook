import { execFileSync } from "node:child_process";
import { createHash, createPublicKey } from "node:crypto";
import { mkdir, readFile, writeFile, copyFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  packageOfficialPlugin,
  signReleaseManifest,
  buildSignedPluginBundle,
} from "./vendor/lapis-plugins/scripts/plugin-release.mjs";
import { assertStaticReleaseKey } from "./vendor/lapis-plugins/scripts/lib/static-release-trust.mjs";
import { verifyPluginBundle } from "./vendor/lapis-plugins/scripts/lib/verify-plugin-release.mjs";
import { publishRegistryRelease } from "./registry-publish.mjs";

const json = async (file) => JSON.parse(await readFile(file, "utf8"));
export const sha256 = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

export async function prepareRegistryRelease({ root, inputDir, sourceCommit }) {
  const pkg = await json(join(root, "package.json"));
  const manifest = await json(join(root, "manifest.json"));
  const repository = pkg.repository.url.match(
    /^git\+https:\/\/github.com\/([\w.-]+\/[\w.-]+)\.git$/,
  )?.[1];
  if (
    !repository ||
    pkg.private ||
    pkg.version !== manifest.version ||
    manifest.distribution !== "first-party-external" ||
    !/^\d+\.\d+\.\d+$/.test(pkg.version) ||
    !/^[a-f0-9]{40}$/.test(sourceCommit)
  )
    throw Error("Registry package, manifest or source identity mismatch");
  await json(join(root, "registry.json"));
  const runtime = manifest.lapis?.runtime?.entries?.workspace;
  if (runtime?.path !== "main.mjs" || runtime.format !== "esm")
    throw Error("Installable runtime must declare main.mjs as ESM");
  const directory = join(root, ".release/registry");
  const builtManifest = await json(join(inputDir, "manifest.json"));
  if (JSON.stringify(builtManifest) !== JSON.stringify(manifest))
    throw Error("Built runtime manifest differs from source");
  // Notebook's existing bundle names its stylesheet app.css. Keep that asset
  // and supply the registry's standard stylesheet entry from the same bytes.
  if (manifest.id === "lapis-notebook")
    await copyFile(join(inputDir, "app.css"), join(inputDir, "styles.css"));
  const packaged = await packageOfficialPlugin({
    pluginId: manifest.id,
    version: pkg.version,
    inputDir,
    outDir: directory,
    packageName: pkg.name,
    commit: sourceCommit,
  });
  const request = {
    repository,
    packageName: pkg.name,
    pluginId: manifest.id,
    version: pkg.version,
    releaseTag:
      manifest.id === "tasks"
        ? `${pkg.name}@${pkg.version}`
        : `v${pkg.version}`,
    assetName: `${manifest.id}-${pkg.version}.lapis-plugin`,
    sourceCommit,
    releaseDirectory: basename(packaged.releaseDir),
  };
  await mkdir(directory, { recursive: true });
  await writeFile(
    join(directory, "request.json"),
    JSON.stringify(request, null, 2) + "\n",
  );
  return request;
}

export async function signRegistryRelease({
  root,
  privateKeyFile,
  keyId,
  production = true,
}) {
  const directory = join(root, ".release/registry");
  const request = await json(join(directory, "request.json"));
  const privateKey = await readFile(privateKeyFile, "utf8");
  if (production) assertStaticReleaseKey(keyId, privateKey);
  if (basename(request.releaseDirectory) !== request.releaseDirectory)
    throw Error("Unsafe release directory");
  const releaseDir = join(directory, request.releaseDirectory);
  const signed = await signReleaseManifest({
    input: join(releaseDir, "release.json"),
    out: join(releaseDir, "release.signed.json"),
    keyId,
    privateKeyFile,
  });
  if (
    signed.signed.source.commit !== request.sourceCommit ||
    signed.signed.source.package !== request.packageName ||
    signed.signed.pluginId !== request.pluginId ||
    signed.signed.version !== request.version
  )
    throw Error("Signing request differs from prepared release");
  const options = {
    pluginId: request.pluginId,
    version: request.version,
    releaseDir,
    signedReleasePath: join(releaseDir, "release.signed.json"),
    out: join(directory, request.assetName),
  };
  const { bundlePath } = await buildSignedPluginBundle(options);
  const reproduction = join(directory, "reproduction.zip");
  await buildSignedPluginBundle({ ...options, out: reproduction });
  const bytes = await readFile(bundlePath);
  if (!bytes.equals(await readFile(reproduction)))
    throw Error("Archive is not deterministic");
  verifyPluginBundle({
    bundleBytes: bytes,
    publicKey: createPublicKey(privateKey),
  });
  await writeFile(
    `${bundlePath}.sha256`,
    `${sha256(bytes)}  ${request.assetName}\n`,
  );
  return request;
}

async function main() {
  const root = process.cwd();
  const [command, input = "dist"] = process.argv.slice(2);
  if (command === "prepare") {
    const sourceCommit = execFileSync(
      "jj",
      [
        "--ignore-working-copy",
        "log",
        "-r",
        "@",
        "--no-graph",
        "-T",
        "commit_id",
      ],
      { encoding: "utf8" },
    ).trim();
    return prepareRegistryRelease({
      root,
      inputDir: resolve(input),
      sourceCommit,
    });
  }
  const dryRun = process.env.REGISTRY_DRY_RUN === "true";
  if (!dryRun && process.env.LAPIS_PUBLICATION_APPROVED !== "true")
    throw Error(
      "Registry publication requires the approved registry-production environment",
    );
  if (command === "sign" && dryRun)
    throw Error("Dry runs cannot sign archives");
  if (command === "sign")
    return signRegistryRelease({
      root,
      privateKeyFile: process.env.LAPIS_PLUGIN_RELEASE_PRIVATE_KEY_FILE,
      keyId: process.env.LAPIS_PLUGIN_RELEASE_KEY_ID,
    });
  if (command === "publish")
    return publishRegistryRelease({
      root,
      token: process.env.GH_TOKEN,
      registryToken: process.env.REGISTRY_GITHUB_TOKEN,
      dryRun,
    });
  throw Error(`Unknown registry command: ${command}`);
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
