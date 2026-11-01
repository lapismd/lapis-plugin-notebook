import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { verifiedPublishedCoordinates } from "./vendor/lapis-plugins/scripts/lib/published-static-release.mjs";

export async function publishRegistryRelease({
  root,
  token,
  registryToken,
  fetchImpl = fetch,
  verify = verifiedPublishedCoordinates,
  dryRun = false,
}) {
  if (!token || (!dryRun && !registryToken))
    throw Error("GitHub release and registry App tokens are required");
  const directory = join(root, ".release/registry");
  const request = JSON.parse(
    await readFile(join(directory, "request.json"), "utf8"),
  );
  if (
    process.env.GITHUB_REPOSITORY &&
    process.env.GITHUB_REPOSITORY !== request.repository
  )
    throw Error("Registry request belongs to another repository");
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
  };
  const api = `https://api.github.com/repos/${request.repository}`;
  const response = await fetchImpl(
    `${api}/releases/tags/${encodeURIComponent(request.releaseTag)}`,
    { headers },
  );
  if (!response.ok)
    throw Error(`Published GitHub release missing: ${response.status}`);
  const release = await response.json();
  if (
    release.draft ||
    release.prerelease ||
    release.tag_name !== request.releaseTag
  )
    throw Error("Only a published stable release can submit to the registry");
  const names = [request.assetName, `${request.assetName}.sha256`];
  const present = names.map((name) =>
    release.assets.some((asset) => asset.name === name),
  );
  if (present.some(Boolean) && !present.every(Boolean))
    throw Error(
      "Published release has incomplete immutable registry assets; publish a patch",
    );
  if (!present[0]) {
    let objectResponse = await fetchImpl(
      `${api}/git/ref/tags/${encodeURIComponent(request.releaseTag)}`,
      { headers },
    );
    if (!objectResponse.ok) throw Error("Release tag is missing");
    let object = (await objectResponse.json()).object;
    for (let depth = 0; object.type === "tag" && depth < 8; depth++) {
      objectResponse = await fetchImpl(`${api}/git/tags/${object.sha}`, {
        headers,
      });
      if (!objectResponse.ok) throw Error("Annotated release tag is missing");
      object = (await objectResponse.json()).object;
    }
    if (object.type !== "commit" || object.sha !== request.sourceCommit)
      throw Error(
        "Release tag differs from the qualified source; publish a patch",
      );
    const npm = await fetchImpl(
      `https://registry.npmjs.org/${encodeURIComponent(request.packageName)}/${request.version}`,
    );
    if (!npm.ok)
      throw Error(
        "Publish and verify the matching npm version before registry publication",
      );
    const pkg = await npm.json();
    if (
      pkg.name !== request.packageName ||
      pkg.version !== request.version ||
      !pkg.dist?.integrity
    )
      throw Error("Published npm coordinates differ from the prepared plugin");
    if (dryRun) return { status: "needs-approved-upload", request };
    const upload = new URL(release.upload_url.replace(/\{.*$/, ""));
    if (
      upload.protocol !== "https:" ||
      upload.hostname !== "uploads.github.com" ||
      upload.pathname !==
        `/repos/${request.repository}/releases/${release.id}/assets`
    )
      throw Error("Unexpected GitHub release upload URL");
    for (const name of names) {
      upload.searchParams.set("name", name);
      const result = await fetchImpl(upload.href, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/octet-stream" },
        body: await readFile(join(directory, name)),
      });
      if (!result.ok)
        throw Error(`Immutable release upload failed: ${result.status}`);
    }
  }
  // Always verify the actual downloaded release, including retained assets.
  // The dispatch source is the archive's signed commit, never the local plan.
  const published = await verify(request, { fetchImpl, token });
  const payload = {
    repository: published.repository,
    package_name: published.packageName,
    plugin_id: published.pluginId,
    version: published.version,
    release_tag: published.releaseTag,
    asset_name: published.assetName,
    source_commit: published.sourceCommit,
  };
  if (!dryRun) {
    const dispatch = await fetchImpl(
      "https://api.github.com/repos/lapismd/plugin-registry/dispatches",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${registryToken}`,
          Accept: "application/vnd.github+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          event_type: "plugin_release",
          client_payload: payload,
        }),
      },
    );
    if (!dispatch.ok)
      throw Error(`Registry dispatch failed: ${dispatch.status}`);
  }
  console.log(
    `${dryRun ? "Verified" : "Submitted"} ${published.pluginId}@${published.version} from ${published.sourceCommit}`,
  );
  return { status: dryRun ? "verified" : "submitted", payload };
}
