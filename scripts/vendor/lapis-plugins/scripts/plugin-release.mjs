#!/usr/bin/env node
import {
  createHash,
  createPrivateKey,
  generateKeyPairSync,
  sign as cryptoSign,
  verify as cryptoVerify,
} from "node:crypto";
import { once } from "node:events";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { finished } from "node:stream/promises";
import { Zip, ZipDeflate, ZipPassThrough } from "fflate";

import { formatByteSize } from "./release-utils.mjs";
import {
  runtimeEntryFilesFromManifest,
  validateRuntimeEntryFileReferences,
} from "./plugin-release-file-graph.mjs";

const textEncoder = new TextEncoder();
const pluginBundleMtime = new Date(1980, 0, 1, 0, 0, 0);
const pluginBundleCompressionLevel = 6;

export async function packageOfficialPlugin(options) {
  const pluginId = required(options.pluginId, "pluginId");
  const version = required(options.version, "version");
  const inputDir = path.resolve(
    required(options.inputDir ?? options.input, "inputDir")
  );
  const outDir = path.resolve(
    required(options.outDir ?? options.out, "outDir")
  );
  const packageName = options.packageName;
  const commit = options.commit;
  const log = typeof options.log === "function" ? options.log : () => {};

  const manifestPath = path.join(inputDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`Missing required file: ${manifestPath}`);
  }

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.id !== pluginId) {
    throw new Error(
      `Manifest id mismatch: expected ${pluginId}, got ${manifest.id}`
    );
  }
  if (manifest.version !== version) {
    throw new Error(
      `Manifest version mismatch: expected ${version}, got ${manifest.version}`
    );
  }
  const runtimeMetadata = releaseRuntimeMetadataFromManifest(
    manifest,
    inputDir
  );
  const runtimeEntryFiles = runtimeEntryFilesFromManifest(manifest);
  assertOfficialEsmRuntime(manifest, pluginId);
  if (runtimeEntryFiles.length === 0) {
    throw new Error(
      `Missing runtime entry for ${pluginId}: official plugin manifests must declare lapis.runtime.entries with an ESM workspace entry`
    );
  }

  const releaseDir = path.join(outDir, `${pluginId}-${version}`);
  const filesDir = path.join(releaseDir, "files");
  await rm(releaseDir, { force: true, recursive: true });
  await mkdir(filesDir, { recursive: true });

  const sourceFiles = await listFiles(inputDir);
  await validateRuntimeEntryFileReferences({
    rootDir: inputDir,
    entryFiles: runtimeEntryFiles,
    files: sourceFiles,
  });
  const releaseFiles = [];
  log(`Copying and hashing ${sourceFiles.length} release file(s)...`);
  for (let index = 0; index < sourceFiles.length; index += 1) {
    const relativePath = sourceFiles[index];
    assertReleasePath(relativePath);
    const sourcePath = path.join(inputDir, relativePath);
    const target = path.join(filesDir, relativePath);
    const metadata = await copyFileAndHash(sourcePath, target);
    log(
      `  [${index + 1}/${sourceFiles.length}] ${relativePath} (${formatByteSize(
        metadata.size
      )})`
    );
    releaseFiles.push({
      path: relativePath,
      sha256: metadata.sha256,
      size: metadata.size,
    });
  }

  const normalizedFiles = releaseFiles.sort((a, b) =>
    a.path.localeCompare(b.path)
  );

  const releaseManifest = {
    schemaVersion: 1,
    type: "lapis.plugin.release",
    pluginId,
    version,
    channel: "official",
    source: {
      ...(packageName ? { package: packageName } : {}),
      ...(commit ? { commit } : {}),
    },
    compatibility: {
      minAppVersion: manifest.minAppVersion ?? "0.0.0",
      platforms: manifest.isDesktopOnly ? ["desktop"] : ["web", "desktop"],
      ...(manifest.isDesktopOnly ? { desktopOnly: true } : {}),
    },
    ...(runtimeMetadata ? { runtime: runtimeMetadata } : {}),
    files: normalizedFiles,
  };
  if (Object.keys(releaseManifest.source).length === 0) {
    delete releaseManifest.source;
  }

  const releasePath = path.join(releaseDir, "release.json");
  await writeFile(releasePath, `${canonicalJson(releaseManifest)}\n`);

  return { releaseDir, releasePath, releaseManifest };
}

const runtimeEntryFields = [
  "workspace",
  "electronRenderer",
  "electronSidecar",
  "desktop",
  "trustedDesktop",
];

function assertOfficialEsmRuntime(manifest, pluginId) {
  const entries = manifest?.lapis?.runtime?.entries;
  if (!isPlainObject(entries)) {
    throw new Error(
      `Official plugin ${pluginId} must declare lapis.runtime.entries with an ESM workspace entry`
    );
  }
  const workspaceEntry = entries.workspace;
  if (!isPlainObject(workspaceEntry)) {
    throw new Error(
      `Official plugin ${pluginId} must declare lapis.runtime.entries.workspace`
    );
  }
  if (workspaceEntry.format !== "esm") {
    throw new Error(
      `Official plugin ${pluginId} workspace runtime entry must use format "esm"`
    );
  }
  for (const field of runtimeEntryFields) {
    const entry = entries[field];
    if (!isPlainObject(entry)) {
      continue;
    }
    if (entry.format === "commonjs") {
      throw new Error(
        `Official plugin ${pluginId} runtime entry ${field} must be ESM-only; CommonJS is reserved for legacy Obsidian-compatible plugins`
      );
    }
    if (entry.fallbackPath !== undefined) {
      throw new Error(
        `Official plugin ${pluginId} runtime entry ${field} must not declare fallbackPath; official external plugins are ESM-only`
      );
    }
  }
}

function releaseRuntimeMetadataFromManifest(manifest, inputDir) {
  const runtime = manifest?.lapis?.runtime;
  if (!isPlainObject(runtime)) {
    return undefined;
  }

  const metadata = {};
  const entries = normalizeRuntimeEntries(runtime.entries, inputDir);
  if (entries) {
    metadata.entries = entries;
  }
  const sharedDependencies = normalizeRuntimeSharedDependencies(
    runtime.sharedDependencies
  );
  if (sharedDependencies) {
    metadata.sharedDependencies = sharedDependencies;
  }
  const compatibilityOverrides = normalizeRuntimeCompatibilityOverrides(
    runtime.compatibilityOverrides
  );
  if (compatibilityOverrides) {
    metadata.compatibilityOverrides = compatibilityOverrides;
  }
  return Object.keys(metadata).length ? metadata : undefined;
}

function normalizeRuntimeEntries(entries, inputDir) {
  if (!isPlainObject(entries)) {
    return undefined;
  }

  const normalized = {};
  for (const field of runtimeEntryFields) {
    const entry = entries[field];
    if (entry === undefined) {
      continue;
    }
    if (!isPlainObject(entry)) {
      throw new Error(`Invalid lapis.runtime.entries.${field}`);
    }
    normalized[field] = normalizeRuntimeEntry(entry, field, inputDir);
  }
  return Object.keys(normalized).length ? normalized : undefined;
}

function normalizeRuntimeEntry(entry, field, inputDir) {
  if (!isValidRuntimePath(entry.path)) {
    throw new Error(`Invalid lapis.runtime.entries.${field}.path`);
  }
  if (!["esm", "commonjs", "node-esm"].includes(entry.format)) {
    throw new Error(`Invalid lapis.runtime.entries.${field}.format`);
  }
  if (!runtimePathMatchesFormat(entry.path, entry.format)) {
    throw new Error(
      `lapis.runtime.entries.${field}.path ${entry.path} does not match format ${entry.format}`
    );
  }
  assertRuntimeFileExists(inputDir, entry.path, field);

  const normalized = {
    path: entry.path,
    format: entry.format,
  };
  if (entry.fallbackPath !== undefined) {
    if (!isValidRuntimePath(entry.fallbackPath)) {
      throw new Error(`Invalid lapis.runtime.entries.${field}.fallbackPath`);
    }
    if (!commonJsRuntimePath(entry.fallbackPath)) {
      throw new Error(
        `lapis.runtime.entries.${field}.fallbackPath ${entry.fallbackPath} must be a CommonJS .js or .cjs file`
      );
    }
    assertRuntimeFileExists(inputDir, entry.fallbackPath, field);
    normalized.fallbackPath = entry.fallbackPath;
  }
  if (entry.sharedDependencies !== undefined) {
    if (!isStringArray(entry.sharedDependencies)) {
      throw new Error(
        `Invalid lapis.runtime.entries.${field}.sharedDependencies`
      );
    }
    normalized.sharedDependencies = uniqueStrings(entry.sharedDependencies);
  }
  if (entry.requiresReloadOnUpdate !== undefined) {
    if (typeof entry.requiresReloadOnUpdate !== "boolean") {
      throw new Error(
        `Invalid lapis.runtime.entries.${field}.requiresReloadOnUpdate`
      );
    }
    normalized.requiresReloadOnUpdate = entry.requiresReloadOnUpdate;
  }
  return normalized;
}

function normalizeRuntimeSharedDependencies(sharedDependencies) {
  if (!isPlainObject(sharedDependencies)) {
    return undefined;
  }

  const normalized = {};
  for (const field of runtimeEntryFields) {
    const dependencies = sharedDependencies[field];
    if (dependencies === undefined) {
      continue;
    }
    if (!isStringArray(dependencies)) {
      throw new Error(`Invalid lapis.runtime.sharedDependencies.${field}`);
    }
    normalized[field] = uniqueStrings(dependencies);
  }
  return Object.keys(normalized).length ? normalized : undefined;
}

function normalizeRuntimeCompatibilityOverrides(overrides) {
  if (!isPlainObject(overrides)) {
    return undefined;
  }
  const deprecatedHostModules = normalizeRuntimeSharedDependencies(
    overrides.deprecatedHostModules
  );
  return deprecatedHostModules ? { deprecatedHostModules } : undefined;
}

function assertRuntimeFileExists(inputDir, relativePath, field) {
  const absolutePath = path.join(inputDir, relativePath);
  if (!existsSync(absolutePath)) {
    throw new Error(
      `lapis.runtime.entries.${field} references missing file: ${relativePath}`
    );
  }
}

function isValidRuntimePath(value) {
  if (typeof value !== "string" || !value.trim()) {
    return false;
  }
  return (
    !value.startsWith("/") &&
    !value.split("/").includes("..") &&
    /\.(?:[cm]?js)$/.test(value)
  );
}

function runtimePathMatchesFormat(runtimePath, format) {
  return format === "commonjs"
    ? commonJsRuntimePath(runtimePath)
    : esmRuntimePath(runtimePath);
}

function esmRuntimePath(runtimePath) {
  return /\.(?:mjs|es\.js)$/.test(runtimePath);
}

function commonJsRuntimePath(runtimePath) {
  return (
    /\.cjs$/.test(runtimePath) ||
    (/\.js$/.test(runtimePath) && !/\.es\.js$/.test(runtimePath))
  );
}

function isStringArray(value) {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function uniqueStrings(value) {
  return [...new Set(value)];
}

function isPlainObject(value) {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export async function signReleaseManifest(options) {
  const input = path.resolve(required(options.input, "input"));
  const out = path.resolve(required(options.out, "out"));
  const keyId = required(options.keyId, "keyId");
  const privateKeyFile = path.resolve(
    required(options.privateKeyFile, "privateKeyFile")
  );
  const signed = JSON.parse(await readFile(input, "utf8"));
  const privateKey = createPrivateKey(await readFile(privateKeyFile, "utf8"));
  const payload = textEncoder.encode(canonicalJson(signed));
  const signature = cryptoSign(null, payload, privateKey).toString("base64");
  const envelope = {
    signed,
    signatures: [{ keyId, alg: "ed25519", sig: signature }],
  };
  await mkdir(path.dirname(out), { recursive: true });
  await writeFile(out, `${canonicalJson(envelope)}\n`);
  return envelope;
}

export async function buildSignedPluginBundle(options) {
  const pluginId = required(options.pluginId, "pluginId");
  const version = required(options.version, "version");
  const releaseDir = path.resolve(required(options.releaseDir, "releaseDir"));
  const signedReleasePath = path.resolve(
    required(options.signedReleasePath, "signedReleasePath")
  );
  const out = path.resolve(
    options.out ?? path.join(releaseDir, `${pluginId}-${version}.lapis-plugin`)
  );
  const filesDir = path.join(releaseDir, "files");
  const log = typeof options.log === "function" ? options.log : () => {};

  if (!existsSync(signedReleasePath)) {
    throw new Error(`Missing signed release manifest: ${signedReleasePath}`);
  }
  if (!existsSync(filesDir)) {
    throw new Error(`Missing release files directory: ${filesDir}`);
  }

  const entries = [
    {
      path: "release.signed.json",
      sourcePath: signedReleasePath,
      stored: true,
    },
  ];

  for (const relativePath of await listFiles(filesDir)) {
    assertReleasePath(relativePath);
    const sourcePath = path.join(filesDir, relativePath);
    entries.push({
      path: relativePath,
      sourcePath,
      stored: false,
    });
  }

  log(`Building signed .lapis-plugin bundle from ${entries.length} file(s)...`);
  await writePluginBundleZip(entries, out);
  const bundle = {
    path: path.basename(out),
    ...(await hashFile(out)),
  };
  log(`Wrote ${bundle.path} (${formatByteSize(bundle.size)}).`);
  return { bundlePath: out, bundle };
}

/**
 * Build the deterministic payload authenticated by the Nostr release manifest.
 * The archive deliberately contains no embedded signature or trust metadata:
 * publisher authorization and curator approval are carried by the portable
 * Nostr proof that names this archive's exact SHA-256 and size.
 */
export async function buildPluginPayload(options) {
  const pluginId = required(options.pluginId, "pluginId");
  const version = required(options.version, "version");
  const releaseDir = path.resolve(required(options.releaseDir, "releaseDir"));
  const out = path.resolve(
    options.out ?? path.join(releaseDir, `${pluginId}-${version}.payload.zip`)
  );
  const filesDir = path.join(releaseDir, "files");
  const log = typeof options.log === "function" ? options.log : () => {};

  if (!existsSync(filesDir)) {
    throw new Error(`Missing release files directory: ${filesDir}`);
  }

  const entries = [];
  for (const relativePath of await listFiles(filesDir)) {
    assertReleasePath(relativePath);
    entries.push({
      path: relativePath,
      sourcePath: path.join(filesDir, relativePath),
      stored: false,
    });
  }
  if (entries.length === 0) {
    throw new Error(`Plugin payload has no files: ${filesDir}`);
  }

  log(
    `Building Nostr-authenticated plugin payload from ${entries.length} file(s)...`
  );
  await writePluginBundleZip(entries, out);
  const bundle = {
    path: path.basename(out),
    ...(await hashFile(out)),
  };
  log(`Wrote ${bundle.path} (${formatByteSize(bundle.size)}).`);
  return { bundlePath: out, bundle };
}

/**
 * Seal a deterministic payload and its portable Nostr proof into the manual
 * installation artifact. The proof authenticates the inner payload; the outer
 * archive is intentionally not part of the signed hash chain.
 */
export async function buildNostrPluginBundle(options) {
  const pluginId = required(options.pluginId, "pluginId");
  const version = required(options.version, "version");
  const payloadPath = path.resolve(
    required(options.payloadPath, "payloadPath")
  );
  const proofPath = path.resolve(required(options.proofPath, "proofPath"));
  const out = path.resolve(
    options.out ??
      path.join(
        path.dirname(payloadPath),
        `${pluginId}-${version}.lapis-plugin`
      )
  );
  const log = typeof options.log === "function" ? options.log : () => {};

  for (const [label, filePath] of [
    ["payload", payloadPath],
    ["Nostr release proof", proofPath],
  ]) {
    if (!existsSync(filePath)) throw new Error(`Missing ${label}: ${filePath}`);
  }

  await writePluginBundleZip(
    [
      { path: "release.nostr.json", sourcePath: proofPath, stored: true },
      { path: "payload.zip", sourcePath: payloadPath, stored: false },
    ],
    out
  );
  const bundle = {
    path: path.basename(out),
    ...(await hashFile(out)),
  };
  log(`Wrote offline ${bundle.path} (${formatByteSize(bundle.size)}).`);
  return { bundlePath: out, bundle };
}

export async function verifySignedRelease(options) {
  const envelope = JSON.parse(
    await readFile(path.resolve(required(options.input, "input")), "utf8")
  );
  const publicKey = await readFile(
    path.resolve(required(options.publicKeyFile, "publicKeyFile")),
    "utf8"
  );
  const payload = textEncoder.encode(canonicalJson(envelope.signed));
  const signature = Buffer.from(envelope.signatures?.[0]?.sig ?? "", "base64");
  return cryptoVerify(null, payload, publicKey, signature);
}

export function generateTestEd25519KeyPair() {
  return generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

export function canonicalJson(value) {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Canonical JSON only supports finite numbers");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  ) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => {
        if (typeof value[key] === "undefined") {
          throw new Error("Canonical JSON does not support undefined values");
        }
        return `${JSON.stringify(key)}:${canonicalJson(value[key])}`;
      })
      .join(",")}}`;
  }
  throw new Error(`Canonical JSON does not support ${typeof value} values`);
}

async function copyFileAndHash(sourcePath, targetPath) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  const hash = createHash("sha256");
  let size = 0;
  const reader = createReadStream(sourcePath);
  const writer = createWriteStream(targetPath);

  for await (const chunk of reader) {
    hash.update(chunk);
    size += chunk.byteLength;
    if (!writer.write(chunk)) {
      await once(writer, "drain");
    }
  }

  writer.end();
  await finished(writer);
  return {
    sha256: hash.digest("hex"),
    size,
  };
}

async function writePluginBundleZip(entries, zipPath) {
  await mkdir(path.dirname(zipPath), { recursive: true });
  const writer = createWriteStream(zipPath);
  writer.setMaxListeners(0);
  let writeChain = Promise.resolve();
  let resolveZipOutput;
  let rejectZipOutput;
  const zipOutputDone = new Promise((resolve, reject) => {
    resolveZipOutput = resolve;
    rejectZipOutput = reject;
  });
  const zip = new Zip((error, chunk, final) => {
    if (error) {
      writer.destroy(error);
      rejectZipOutput(error);
      return;
    }
    if (chunk?.byteLength) {
      const outputChunk = Buffer.from(chunk);
      writeChain = writeChain.then(() => writeBuffer(writer, outputChunk));
    }
    if (final) {
      writeChain = writeChain
        .then(() => {
          writer.end();
        })
        .then(resolveZipOutput, rejectZipOutput);
    }
  });

  try {
    for (const entry of entries) {
      await appendFileToBundleZip(zip, entry);
    }
    zip.end();
    await zipOutputDone;
    await finished(writer);
  } catch (error) {
    writer.destroy();
    throw error;
  }
}

async function appendFileToBundleZip(zip, entry) {
  const stream = entry.stored
    ? new ZipPassThrough(entry.path)
    : new ZipDeflate(entry.path, { level: pluginBundleCompressionLevel });
  stream.mtime = pluginBundleMtime;
  zip.add(stream);

  const reader = createReadStream(entry.sourcePath);
  for await (const chunk of reader) {
    stream.push(chunk, false);
  }
  stream.push(new Uint8Array(0), true);
}

async function writeBuffer(writer, buffer) {
  if (writer.write(buffer)) {
    return;
  }
  await once(writer, "drain");
}

async function hashFile(filePath) {
  const hash = createHash("sha256");
  let size = 0;
  const reader = createReadStream(filePath);
  for await (const chunk of reader) {
    hash.update(chunk);
    size += chunk.byteLength;
  }
  return { sha256: hash.digest("hex"), size };
}

async function listFiles(dir, prefix = "") {
  const entries = await import("node:fs/promises").then((fs) =>
    fs.readdir(path.join(dir, prefix), { withFileTypes: true })
  );
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await listFiles(dir, relativePath)));
    } else if (entry.isFile()) {
      files.push(relativePath);
    }
  }
  return files;
}

function assertReleasePath(relativePath) {
  if (
    !relativePath ||
    relativePath.startsWith("/") ||
    relativePath.includes("\\") ||
    relativePath.includes("\0") ||
    relativePath
      .split("/")
      .some((part) => !part || part === "." || part === "..")
  ) {
    throw new Error(`Unsafe release file path: ${relativePath}`);
  }
}

function required(value, name) {
  if (!value) throw new Error(`Missing required option: ${name}`);
  return value;
}

export function parseArgs(argv) {
  const [command, ...rest] = argv;
  const options = {};
  const args = rest[0] === "--" ? rest.slice(1) : rest;
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg.startsWith("--")) throw new Error(`Unexpected argument: ${arg}`);
    const key = arg
      .slice(2)
      .replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    options[key] = args[index + 1];
    index += 1;
  }
  return { command, options };
}

async function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  if (command === "package") {
    await packageOfficialPlugin(options);
    return;
  }
  if (command === "sign") {
    await signReleaseManifest(options);
    return;
  }
  if (command === "bundle") {
    await buildSignedPluginBundle(options);
    return;
  }
  if (command === "payload") {
    await buildPluginPayload(options);
    return;
  }
  throw new Error(`Unknown plugin release command: ${command ?? "(missing)"}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
