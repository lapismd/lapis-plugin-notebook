import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

export const packageName = "@lapis-notes/lapis-plugin-notebook";
export const repository = "lapismd/lapis-plugin-notebook";
export const integrity = (bytes) =>
  "sha512-" + createHash("sha512").update(bytes).digest("base64");
export const run = (command, args, options = {}) =>
  execFileSync(command, args, { stdio: "inherit", ...options });
export const output = (command, args, options = {}) =>
  run(command, args, { encoding: "utf8", stdio: "pipe", ...options }).trim();
export const json = async (path) => JSON.parse(await readFile(path, "utf8"));

export function validateIdentity(pkg, manifest) {
  if (
    pkg.name !== packageName ||
    pkg.private ||
    !/^\d+\.\d+\.\d+$/.test(pkg.version) ||
    pkg.version !== manifest.version ||
    manifest.id !== "lapis-notebook" ||
    manifest.distribution !== "first-party-external"
  )
    throw Error("Notebook public package/runtime manifest identity mismatch");
  for (const field of [
    "dependencies",
    "peerDependencies",
    "optionalDependencies",
  ])
    for (const [name, range] of Object.entries(pkg[field] ?? {}))
      if (
        !/^[~^\d*><=| ]/.test(range) ||
        /(?:file:|link:|workspace:|git|\/Users\/)/.test(range)
      )
        throw Error(`Non-registry dependency: ${name}`);
}

export function validateCandidate(candidate, source, bytes) {
  if (
    candidate.schema !== 1 ||
    candidate.installation !== "frozen-registry" ||
    candidate.name !== packageName ||
    !/^\d+\.\d+\.\d+$/.test(candidate.version) ||
    !/^[a-f0-9]{40}$/.test(candidate.source) ||
    candidate.source !== source ||
    basename(candidate.tarball) !== candidate.tarball ||
    !candidate.tarball.endsWith(".tgz") ||
    candidate.integrity !== integrity(bytes) ||
    candidate.size !== bytes.length
  )
    throw Error("Release candidate source, identity or checksum mismatch");
}

export function validateArchiveFiles(files) {
  for (const file of files)
    if (
      !file.startsWith("package/") ||
      /(?:^|\/)(?:\.\.|node_modules|\.env(?:\.[^/]*)?|\.git|\.local)(?:\/|$)/.test(
        file,
      ) ||
      /\.(?:test|spec|stories)\./.test(file)
    )
      throw Error(`Forbidden npm archive entry: ${file}`);
  for (const name of [
    "dist/main.mjs",
    "dist/index.d.ts",
    "dist/styles.css",
    "manifest.json",
    "LICENSE",
    "CHANGELOG.md",
  ])
    if (!files.includes(`package/${name}`))
      throw Error(`Release input missing: ${name}`);
}

export async function prepare(root = process.cwd()) {
  if (
    process.env.LAPIS_NOTEBOOK_VALIDATION_WORKER !== "1" ||
    process.env.LAPIS_NOTEBOOK_VALIDATION_ARCHIVE_COUNT !== "0"
  )
    throw Error(
      "Release preparation requires the frozen registry-only validation worker",
    );
  const pkg = await json(join(root, "package.json"));
  validateIdentity(pkg, await json(join(root, "manifest.json")));
  const directory = join(root, ".release/npm");
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
  run("npm", ["pack", "--ignore-scripts", "--pack-destination", directory], {
    cwd: root,
  });
  const tarball = `lapis-notes-lapis-plugin-notebook-${pkg.version}.tgz`;
  const path = join(directory, tarball);
  const bytes = await readFile(path);
  validateIdentity(
    JSON.parse(output("tar", ["-xOf", path, "package/package.json"])),
    JSON.parse(output("tar", ["-xOf", path, "package/manifest.json"])),
  );
  const files = output("tar", ["-tf", path]).split("\n");
  validateArchiveFiles(files);
  const source =
    process.env.GITHUB_SHA ??
    output(
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
      { cwd: root },
    );
  const candidate = {
    schema: 1,
    installation: "frozen-registry",
    name: packageName,
    version: pkg.version,
    source,
    tarball,
    integrity: integrity(bytes),
    size: bytes.length,
    files,
  };
  validateCandidate(candidate, source, bytes);
  await writeFile(
    join(directory, "candidate.json"),
    JSON.stringify(candidate, null, 2) + "\n",
  );
  console.log(
    `Qualified npm candidate ${candidate.name}@${candidate.version}: ${candidate.integrity}`,
  );
}

export async function loadCandidate(root = process.cwd()) {
  const directory = join(root, ".release/npm");
  const candidate = await json(join(directory, "candidate.json"));
  // Validate the filename before opening an artifact-supplied path.
  if (
    typeof candidate.tarball !== "string" ||
    basename(candidate.tarball) !== candidate.tarball
  )
    throw Error("Release candidate tarball path mismatch");
  const path = join(directory, candidate.tarball);
  const bytes = await readFile(path);
  const source =
    process.env.GITHUB_SHA ??
    output(
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
      { cwd: root },
    );
  validateCandidate(candidate, source, bytes);
  const pkg = await json(join(root, "package.json"));
  validateIdentity(pkg, await json(join(root, "manifest.json")));
  if (pkg.version !== candidate.version)
    throw Error("Candidate differs from the checked-out package version");
  return { candidate, path, bytes };
}

export async function registryVersion(version, fetchImpl = fetch) {
  const response = await fetchImpl(
    `https://registry.npmjs.org/${encodeURIComponent(packageName)}/${version}`,
    { headers: { "Cache-Control": "no-cache" } },
  );
  if (response.status === 404) return null;
  if (!response.ok)
    throw Error(`npm metadata request failed: ${response.status}`);
  const metadata = await response.json();
  if (
    metadata.name !== packageName ||
    metadata.version !== version ||
    !metadata.dist?.integrity
  )
    throw Error("Published npm coordinates mismatch");
  return metadata;
}

export function verifyPublishedArtifact(candidate, metadata, bytes) {
  if (
    metadata.name !== candidate.name ||
    metadata.version !== candidate.version ||
    metadata.dist?.integrity !== candidate.integrity ||
    integrity(bytes) !== candidate.integrity
  )
    throw Error("Published npm artifact differs from the qualified candidate");
  if (!metadata.dist.attestations?.provenance)
    throw Error("Published npm artifact has no provenance attestation");
}
