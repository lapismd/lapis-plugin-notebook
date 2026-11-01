import { createHash, createPublicKey } from "node:crypto";
import { parsePluginBundle } from "./plugin-bundle.mjs";
import { verifyPluginBundle } from "./verify-plugin-release.mjs";
import { staticReleaseKeys } from "./static-release-trust.mjs";

export async function verifiedPublishedCoordinates(
  release,
  {
    fetchImpl = fetch,
    token = process.env.GITHUB_TOKEN,
    keys = staticReleaseKeys,
  } = {},
) {
  const headers = {
    Accept: "application/vnd.github+json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  const get = async (url) => {
    const response = await fetchImpl(url, { headers });
    if (!response.ok)
      throw new Error(
        `Published release request failed: HTTP ${response.status}`,
      );
    return response.json();
  };
  const base = `https://api.github.com/repos/${release.repository}`;
  const published = await get(
    `${base}/releases/tags/${encodeURIComponent(release.releaseTag)}`,
  );
  if (published.draft)
    throw new Error("Cannot dispatch an unpublished draft release.");
  const download = async (name) => {
    const asset = published.assets?.find((a) => a.name === name);
    if (!asset?.browser_download_url)
      throw new Error(`Published release is missing ${name}.`);
    const url = new URL(asset.browser_download_url);
    if (url.protocol !== "https:" || url.hostname !== "github.com")
      throw new Error("Published asset must be hosted by GitHub.");
    const response = await fetchImpl(url.href);
    if (!response.ok)
      throw new Error(
        `Published asset request failed: HTTP ${response.status}`,
      );
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length !== asset.size)
      throw new Error("Published asset size mismatch.");
    return bytes;
  };
  const [bytes, checksum] = await Promise.all([
    download(release.assetName),
    download(`${release.assetName}.sha256`),
  ]);
  const expectedChecksum = `${createHash("sha256").update(bytes).digest("hex")}  ${release.assetName}`;
  if (checksum.toString("utf8").trimEnd() !== expectedChecksum)
    throw new Error("Published archive checksum mismatch.");
  const files = parsePluginBundle(bytes);
  const envelope = JSON.parse(
    files.get("release.signed.json").toString("utf8"),
  );
  const keyId = envelope.signatures?.[0]?.keyId;
  const key = keys[keyId];
  if (!key || envelope.signatures[0].alg !== "ed25519")
    throw new Error("Published release signature uses an untrusted key.");
  const publicKey = createPublicKey({
    key: Buffer.concat([
      Buffer.from("302a300506032b6570032100", "hex"),
      Buffer.from(key, "base64"),
    ]),
    format: "der",
    type: "spki",
  });
  const { releaseManifest: signed } = verifyPluginBundle({
    bundleBytes: bytes,
    publicKey,
  });
  if (
    signed.type !== "lapis.plugin.release" ||
    signed.schemaVersion !== 1 ||
    signed.channel !== "official" ||
    signed.pluginId !== release.pluginId ||
    signed.version !== release.version ||
    signed.source?.package !== release.packageName ||
    !/^[a-f0-9]{40}$/.test(signed.source?.commit ?? "")
  )
    throw new Error(
      "Published release coordinates do not match the selected plugin.",
    );
  let object = (
    await get(`${base}/git/ref/tags/${encodeURIComponent(release.releaseTag)}`)
  ).object;
  for (let depth = 0; object.type === "tag" && depth < 8; depth++)
    object = (await get(`${base}/git/tags/${object.sha}`)).object;
  if (object.type !== "commit" || object.sha !== signed.source.commit)
    throw new Error(
      "Published release tag does not match its signed source commit.",
    );
  return { ...release, sourceCommit: signed.source.commit };
}
