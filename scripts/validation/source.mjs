import { execFileSync } from "node:child_process";
import { readFile, writeFile, copyFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { exportPack } from "./docker.mjs";
import { hash } from "./model.mjs";

const jj = (root, args) =>
  execFileSync("jj", ["--no-pager", "--color=never", ...args], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  }).trim();
export function validateArchives(entries) {
  if (!Array.isArray(entries))
    throw Error("Archive inventory must be an array");
  const names = new Set();
  for (const entry of entries) {
    if (
      !/^(@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*$/.test(entry.name ?? "") ||
      !/^\d+\.\d+\.\d+[-+\w.]*$/.test(entry.version ?? "") ||
      typeof entry.path !== "string" ||
      !entry.path.endsWith(".tgz") ||
      !/^[a-f0-9]{64}$/.test(entry.sha256 ?? "") ||
      names.has(entry.name)
    )
      throw Error("Invalid or duplicate package archive identity");
    names.add(entry.name);
  }
  return entries;
}
export async function snapshot(root, directory, archiveManifest) {
  const revision = jj(root, [
    "log",
    "-r",
    "@",
    "--no-graph",
    "-T",
    "commit_id",
  ]);
  const parents = jj(root, [
    "log",
    "-r",
    `${revision}-`,
    "--no-graph",
    "-T",
    'commit_id ++ "\\n"',
  ])
    .split("\n")
    .filter(Boolean);
  const files = jj(root, ["file", "list", "-r", revision]).split("\n");
  if (
    files.some((file) =>
      /^(?:\.local|\.env|node_modules|target)(?:\/|$)/.test(file),
    )
  )
    throw Error(
      "Private/local state must not be tracked in the source snapshot",
    );
  await exportPack(
    root,
    jj(root, ["git", "root"]),
    revision,
    join(directory, "source.pack"),
  );
  const archives = [];
  if (archiveManifest) {
    const manifest = resolve(root, archiveManifest);
    for (const [index, entry] of validateArchives(
      JSON.parse(await readFile(manifest, "utf8")),
    ).entries()) {
      const source = resolve(dirname(manifest), entry.path),
        bytes = await readFile(source);
      if (hash(bytes) !== entry.sha256)
        throw Error(`Archive checksum mismatch: ${entry.name}`);
      const path = `package-${index}.tgz`;
      await copyFile(source, join(directory, path));
      archives.push({ ...entry, path });
    }
  }
  const source = {
    schema: 1,
    revision,
    parents,
    fileCount: files.length,
    archives,
    packSha256: hash(await readFile(join(directory, "source.pack"))),
  };
  await writeFile(
    join(directory, "source.json"),
    JSON.stringify(source, null, 2),
  );
  return source;
}
