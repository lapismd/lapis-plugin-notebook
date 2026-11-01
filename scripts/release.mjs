import {
  appendFile,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  integrity,
  json,
  loadCandidate,
  output,
  packageName,
  prepare,
  registryVersion,
  repository,
  run,
  validateIdentity,
  verifyPublishedArtifact,
} from "./release-candidate.mjs";

export function shouldPublish({ pendingChangesets, existing }) {
  return !pendingChangesets && !existing;
}

export function assertPublicationEnvironment(candidate, env = process.env) {
  if (
    env.LAPIS_NOTEBOOK_RELEASE_APPROVED !== "1" ||
    env.GITHUB_REPOSITORY !== repository ||
    env.GITHUB_REF !== "refs/heads/main" ||
    env.GITHUB_SHA !== candidate.source ||
    env.GITHUB_WORKFLOW_REF !==
      `${repository}/.github/workflows/ci.yml@refs/heads/main` ||
    !["push", "workflow_dispatch"].includes(env.GITHUB_EVENT_NAME)
  )
    throw Error("Publication requires the approved exact main CI source");
}

export async function version(root = process.cwd(), execute = run) {
  execute("pnpm", ["exec", "changeset", "version"], { cwd: root });
  const pkg = await json(join(root, "package.json"));
  const manifestPath = join(root, "manifest.json");
  const manifest = await json(manifestPath);
  manifest.version = pkg.version;
  validateIdentity(pkg, manifest);
  const chapter = join(root, "spec/src/plugins/notebook/index.md");
  const text = await readFile(chapter, "utf8");
  const marker =
    /Release package and runtime manifest version: `\d+\.\d+\.\d+`\./;
  if (!marker.test(text))
    throw Error("Canonical release version declaration missing");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  await writeFile(
    chapter,
    text.replace(
      marker,
      `Release package and runtime manifest version: \`${pkg.version}\`.`,
    ),
  );
  execute("pnpm", ["install", "--lockfile-only", "--ignore-pnpmfile"], {
    cwd: root,
  });
}

export async function plan(root = process.cwd()) {
  const pkg = await json(join(root, "package.json"));
  validateIdentity(pkg, await json(join(root, "manifest.json")));
  const pendingChangesets = (await readdir(join(root, ".changeset"))).some(
    (name) => name.endsWith(".md") && name !== "README.md",
  );
  const existing = pendingChangesets
    ? null
    : await registryVersion(pkg.version);
  const publish = shouldPublish({ pendingChangesets, existing });
  if (process.env.GITHUB_OUTPUT)
    await appendFile(process.env.GITHUB_OUTPUT, `publish=${publish}\n`);
  console.log(
    publish
      ? `Ready for approved publication: ${packageName}@${pkg.version}`
      : pendingChangesets
        ? "Changesets are pending; merge the version PR first."
        : "The package version is already published; no release approval is needed.",
  );
  return publish;
}

export async function verify(root = process.cwd(), fetchImpl = fetch) {
  const { candidate } = await loadCandidate(root);
  let metadata;
  for (let attempt = 0; attempt < 12; attempt++) {
    metadata = await registryVersion(candidate.version, fetchImpl);
    if (metadata) break;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  if (!metadata) throw Error("Published npm version is not downloadable");
  const response = await fetchImpl(metadata.dist.tarball);
  if (!response.ok)
    throw Error(`npm archive request failed: ${response.status}`);
  verifyPublishedArtifact(
    candidate,
    metadata,
    Buffer.from(await response.arrayBuffer()),
  );
  const consumer = await mkdtemp(
    join(tmpdir(), "lapis-notebook-release-consumer-"),
  );
  try {
    await writeFile(
      join(consumer, "package.json"),
      JSON.stringify({
        name: "notebook-clean-registry-acceptance",
        version: "0.0.0",
        private: true,
        dependencies: { [packageName]: candidate.version },
      }),
    );
    for (const command of ["install", "ci"])
      run(
        "npm",
        [
          command,
          "--ignore-scripts",
          "--strict-peer-deps",
          "--registry=https://registry.npmjs.org",
        ],
        { cwd: consumer },
      );
    run("npm", ["audit", "signatures"], { cwd: consumer });
    run(
      "pnpm",
      ["exec", "publint", join(consumer, "node_modules", packageName)],
      { cwd: root },
    );
    await writeFile(
      join(root, ".release/npm/registry-receipt.json"),
      JSON.stringify(
        {
          schema: 1,
          name: candidate.name,
          version: candidate.version,
          source: candidate.source,
          integrity: candidate.integrity,
          attestations: metadata.dist.attestations,
          tarball: metadata.dist.tarball,
          cleanConsumer:
            "npm install, frozen npm ci, strict peers, audit signatures and publint",
        },
        null,
        2,
      ) + "\n",
    );
  } finally {
    await rm(consumer, { recursive: true, force: true });
  }
  return candidate;
}

export async function publish(root = process.cwd()) {
  const { candidate, path } = await loadCandidate(root);
  assertPublicationEnvironment(candidate);
  const existing = await registryVersion(candidate.version);
  if (existing && existing.dist.integrity !== candidate.integrity)
    throw Error(
      "Existing npm version has different bytes; publish a new patch",
    );
  const tag = `v${candidate.version}`;
  let release;
  try {
    release = JSON.parse(
      output(
        "gh",
        [
          "release",
          "view",
          tag,
          "--repo",
          repository,
          "--json",
          "targetCommitish",
        ],
        { cwd: root },
      ),
    );
  } catch (error) {
    if (!String(error.stderr ?? "").includes("release not found")) throw error;
  }
  if (release && release.targetCommitish !== candidate.source)
    throw Error(
      "Existing GitHub release targets another source; publish a new patch",
    );
  if (!existing)
    run(
      "npm",
      [
        "publish",
        path,
        "--access=public",
        "--provenance",
        "--tag=latest",
        "--ignore-scripts",
      ],
      { cwd: root },
    );
  await verify(root);
  if (!release)
    run(
      "gh",
      [
        "release",
        "create",
        tag,
        path,
        join(root, ".release/npm/candidate.json"),
        join(root, ".release/npm/registry-receipt.json"),
        "--repo",
        repository,
        "--target",
        candidate.source,
        "--title",
        tag,
        "--generate-notes",
      ],
      { cwd: root },
    );
  console.log(
    `Verified ${tag} from ${candidate.source} (${integrity(await readFile(path))}).`,
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const command = { version, prepare, plan, publish, verify }[process.argv[2]];
  if (!command || process.argv.length !== 3)
    throw Error("Usage: release.mjs version|prepare|plan|publish|verify");
  await command();
}
