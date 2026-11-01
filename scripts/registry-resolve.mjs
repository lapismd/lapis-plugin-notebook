import { readFile, appendFile } from "node:fs/promises";

// Resolve public data without running source from a tag. Workflow and resolver
// code are checked out from main before the verified source is checked out.
export async function resolveRegistrySource({
  repository,
  tag,
  token,
  fetchImpl = fetch,
}) {
  if (!/^lapismd\/[a-z0-9-]+$/.test(repository))
    throw Error("Unexpected source repository");
  const base = `https://api.github.com/repos/${repository}`;
  const get = async (url) => {
    const response = await fetchImpl(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Cache-Control": "no-cache",
      },
    });
    if (!response.ok)
      throw Error(`Registry source request failed: ${response.status}`);
    return response.json();
  };
  const release = await get(`${base}/releases/tags/${encodeURIComponent(tag)}`);
  if (release.draft || release.prerelease || release.tag_name !== tag)
    throw Error("Stable published release required");
  let object = (await get(`${base}/git/ref/tags/${encodeURIComponent(tag)}`))
    .object;
  for (let depth = 0; object.type === "tag" && depth < 8; depth++)
    object = (await get(`${base}/git/tags/${object.sha}`)).object;
  if (object.type !== "commit" || !/^[a-f0-9]{40}$/.test(object.sha))
    throw Error("Release tag does not resolve to a commit");
  const comparison = await get(`${base}/compare/${object.sha}...main`);
  if (!["ahead", "identical"].includes(comparison.status))
    throw Error("Release source must be merged into main");
  const file = async (name) => {
    const content = await get(`${base}/contents/${name}?ref=${object.sha}`);
    return JSON.parse(Buffer.from(content.content, "base64").toString("utf8"));
  };
  const [pkg, manifest, metadata] = await Promise.all([
    file("package.json"),
    file("manifest.json"),
    file("registry.json"),
  ]);
  const expected =
    manifest.id === "tasks" ? `${pkg.name}@${pkg.version}` : `v${pkg.version}`;
  if (
    pkg.private ||
    pkg.version !== manifest.version ||
    tag !== expected ||
    metadata.schemaVersion !== 2 ||
    pkg.repository.url !== `git+https://github.com/${repository}.git` ||
    !metadata.media?.banner
  )
    throw Error("Release package, tag, runtime or registry metadata mismatch");
  const gate = manifest.id === "tasks" ? "Validate" : "Validation lanes";
  const checks = [];
  for (let page = 1; ; page++) {
    const result = await get(
      `${base}/commits/${object.sha}/check-runs?per_page=100&page=${page}`,
    );
    checks.push(...result.check_runs);
    if (result.check_runs.length < 100) break;
  }
  const latest = checks
    .filter(
      (check) => check.name === gate && check.app?.slug === "github-actions",
    )
    .sort((left, right) => right.id - left.id)[0];
  if (latest?.conclusion !== "success")
    throw Error(`Exact release source requires a successful ${gate} CI check`);
  return { commit: object.sha, tag };
}

if (process.argv[1]?.endsWith("/registry-resolve.mjs")) {
  try {
    const pkg = JSON.parse(await readFile("package.json", "utf8"));
    const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
    const tag =
      process.env.RELEASE_TAG ||
      (manifest.id === "tasks"
        ? `${pkg.name}@${pkg.version}`
        : `v${pkg.version}`);
    const result = await resolveRegistrySource({
      repository: process.env.GITHUB_REPOSITORY,
      tag,
      token: process.env.GH_TOKEN,
    });
    await appendFile(
      process.env.GITHUB_OUTPUT,
      `commit=${result.commit}\ntag=${result.tag}\nready=true\n`,
    );
  } catch (error) {
    if (process.env.REGISTRY_AUTOMATIC === "true") {
      console.log(`No eligible registry release: ${error.message}`);
      await appendFile(process.env.GITHUB_OUTPUT, "ready=false\n");
    } else {
      console.error(error.message);
      process.exitCode = 1;
    }
  }
}
