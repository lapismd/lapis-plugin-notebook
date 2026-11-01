import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { validateArchives } from "./validation/source.mjs";

const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const member = (archive, path) =>
  execFileSync("tar", ["-xOf", archive, `package/${path}`], {
    maxBuffer: 16 * 1024 * 1024,
  });

/** Revalidate the worker inventory for a disposable packed-package consumer. */
export async function consumerArchiveConfiguration(
  target,
  {
    worker = process.env.LAPIS_NOTEBOOK_VALIDATION_WORKER,
    input = process.env.LAPIS_NOTEBOOK_VALIDATION_INPUT ?? null,
  } = {},
) {
  if (worker !== "1" || input == null) return null;
  const inventory = JSON.parse(
    await readFile(join(input, "source.json"), "utf8"),
  );
  const entries = validateArchives(inventory.archives);
  if (!entries.length) return null;
  const dependencies = {};
  const patchedDependencies = {};
  for (const entry of entries) {
    if (!/^package-\d+\.tgz$/.test(entry.path))
      throw Error("Invalid worker archive path");
    const archive = join(input, entry.path);
    if (hash(await readFile(archive)) !== entry.sha256)
      throw Error(`Archive checksum mismatch: ${entry.name}`);
    const identity = JSON.parse(member(archive, "package.json"));
    if (identity.name !== entry.name || identity.version !== entry.version)
      throw Error(`Archive identity mismatch: ${entry.name}`);
    dependencies[entry.name] = `file:${archive}`;
    if (entry.name === "@lapismd/design-core") {
      const patch = JSON.parse(member(archive, "patches/manifest.json"));
      if (
        patch.schemaVersion !== 1 ||
        patch.package !== "bits-ui" ||
        patch.version !== "2.20.2" ||
        patch.patchFile !== "bits-ui@2.20.2.patch"
      )
        throw Error("Unsupported Design Core public patch metadata");
      const bytes = member(archive, `patches/${patch.patchFile}`);
      if (hash(bytes) !== patch.patchSha256)
        throw Error("Public patch checksum mismatch");
      await mkdir(join(target, "patches"), { recursive: true });
      await writeFile(join(target, "patches", patch.patchFile), bytes);
      patchedDependencies["bits-ui@2.20.2"] = `patches/${patch.patchFile}`;
    }
  }
  return {
    dependencies,
    pnpm: {
      overrides: { ...dependencies },
      ...(Object.keys(patchedDependencies).length
        ? { patchedDependencies }
        : {}),
    },
    receipts: entries,
  };
}
