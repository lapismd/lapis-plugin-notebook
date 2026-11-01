import { createHash, verify as cryptoVerify } from "node:crypto";

import { parsePluginBundle, parsePluginPayload } from "./plugin-bundle.mjs";
import { canonicalJson } from "../plugin-release.mjs";

export function verifyPluginBundle({ bundleBytes, publicKey }) {
  const files = parsePluginBundle(bundleBytes);
  const releaseBytes = files.get("release.signed.json");
  const envelope = JSON.parse(releaseBytes.toString("utf8"));
  const signature = Buffer.from(envelope.signatures?.[0]?.sig ?? "", "base64");
  if (
    !cryptoVerify(
      null,
      Buffer.from(canonicalJson(envelope.signed)),
      publicKey,
      signature,
    )
  ) {
    throw new Error("Plugin release signature is invalid.");
  }

  const verified = verifyReleaseFiles(files, envelope.signed, {
    ignoredPaths: ["release.signed.json"],
  });
  return { envelope, ...verified };
}

export function verifyPluginPayload({ bundleBytes, releaseManifest }) {
  const files = parsePluginPayload(bundleBytes);
  return verifyReleaseFiles(files, releaseManifest);
}

function verifyReleaseFiles(files, releaseManifest, options = {}) {
  const signedFiles = releaseManifest.files;
  const signedPaths = signedFiles.map((file) => file.path);
  if (
    JSON.stringify(signedPaths) !==
    JSON.stringify(
      [...signedPaths].sort((left, right) => left.localeCompare(right)),
    )
  ) {
    throw new Error("Plugin signed file list is not sorted.");
  }
  const ignoredPaths = new Set(options.ignoredPaths ?? []);
  const archivePaths = [...files.keys()].filter((file) => !ignoredPaths.has(file));
  if (JSON.stringify(archivePaths) !== JSON.stringify(signedPaths)) {
    throw new Error("Plugin archive includes unsigned or missing files.");
  }
  for (const signed of signedFiles) {
    const bytes = files.get(signed.path);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (bytes.byteLength !== signed.size || sha256 !== signed.sha256) {
      throw new Error(`${signed.path} failed size/hash verification.`);
    }
  }
  const manifest = JSON.parse(files.get("manifest.json").toString("utf8"));
  if (
    manifest.id !== releaseManifest.pluginId ||
    manifest.version !== releaseManifest.version ||
    releaseManifest.runtime?.entries?.workspace?.path !== "main.mjs" ||
    !files.has("main.mjs") ||
    !files.has("styles.css")
  ) {
    throw new Error("Plugin runtime metadata is inconsistent.");
  }
  return { releaseManifest, files, manifest };
}
