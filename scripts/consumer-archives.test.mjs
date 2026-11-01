import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { afterEach, expect, it, vi } from "vitest";
import { consumerArchiveConfiguration } from "./consumer-archives.mjs";
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const roots = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
async function fixture({
  name = "@lapis-notes/api",
  version = "0.2.3",
  badPatch = false,
} = {}) {
  const root = await mkdtemp(join(tmpdir(), "notebook-consumer-archives-"));
  roots.push(root);
  const input = join(root, "input"),
    target = join(root, "consumer"),
    stage = join(root, "stage");
  await mkdir(join(stage, "package", "patches"), { recursive: true });
  await mkdir(input);
  await mkdir(target);
  await writeFile(
    join(stage, "package", "package.json"),
    JSON.stringify({ name, version }),
  );
  if (name === "@lapismd/design-core") {
    const bytes = "qualified public patch";
    await writeFile(
      join(stage, "package", "patches", "bits-ui@2.20.2.patch"),
      bytes,
    );
    await writeFile(
      join(stage, "package", "patches", "manifest.json"),
      JSON.stringify({
        schemaVersion: 1,
        package: "bits-ui",
        version: "2.20.2",
        patchFile: "bits-ui@2.20.2.patch",
        patchSha256: hash(badPatch ? "changed" : bytes),
      }),
    );
  }
  const path = "package-0.tgz";
  execFileSync("tar", ["-czf", join(input, path), "-C", stage, "package"]);
  const bytes = await (
    await import("node:fs/promises")
  ).readFile(join(input, path));
  const entry = { name, version, path, sha256: hash(bytes) };
  const inventory = (entries) =>
    writeFile(
      join(input, "source.json"),
      JSON.stringify({ archives: entries }),
    );
  await inventory([entry]);
  return { input, target, entry, inventory };
}
it("leaves registry consumers untouched outside an isolated worker", async () => {
  expect(
    await consumerArchiveConfiguration("/unused", {
      worker: "0",
      input: "/missing",
    }),
  ).toBeNull();
});
it("stages only identity/checksum verified archives in the disposable consumer", async () => {
  const f = await fixture();
  const value = await consumerArchiveConfiguration(f.target, {
    worker: "1",
    input: f.input,
  });
  expect(value.dependencies[f.entry.name]).toBe(
    `file:${join(f.input, f.entry.path)}`,
  );
  expect(value.pnpm.overrides).toEqual(value.dependencies);
  expect(value.receipts[0].sha256).toBe(f.entry.sha256);
});
it.each(["checksum", "identity", "path", "duplicate"])(
  "rejects invalid %s before installing",
  async (kind) => {
    const f = await fixture();
    const entry = { ...f.entry };
    if (kind === "checksum") entry.sha256 = "0".repeat(64);
    if (kind === "identity") entry.version = "9.0.0";
    if (kind === "path") entry.path = "../escape.tgz";
    await f.inventory(kind === "duplicate" ? [entry, entry] : [entry]);
    await expect(
      consumerArchiveConfiguration(f.target, { worker: "1", input: f.input }),
    ).rejects.toThrow();
  },
);
it("uses Design Core's published consumer-root Bits patch metadata", async () => {
  const f = await fixture({ name: "@lapismd/design-core", version: "0.8.0" });
  const value = await consumerArchiveConfiguration(f.target, {
    worker: "1",
    input: f.input,
  });
  expect(value.pnpm.patchedDependencies).toEqual({
    "bits-ui@2.20.2": "patches/bits-ui@2.20.2.patch",
  });
});
it("rejects changed public patch bytes", async () => {
  const f = await fixture({ name: "@lapismd/design-core", badPatch: true });
  await expect(
    consumerArchiveConfiguration(f.target, { worker: "1", input: f.input }),
  ).rejects.toThrow(/patch checksum/);
});

it("uses registry packages when an isolated CI job has no archive input", async () => {
  expect(
    await consumerArchiveConfiguration("/unused", { worker: "1", input: null }),
  ).toBeNull();
});
it("reads the explicitly supplied worker input from its environment", async () => {
  const f = await fixture();
  vi.stubEnv("LAPIS_NOTEBOOK_VALIDATION_INPUT", f.input);
  const value = await consumerArchiveConfiguration(f.target, { worker: "1" });
  expect(value.receipts).toEqual([f.entry]);
});
it("rejects a missing explicitly supplied archive inventory", async () => {
  const f = await fixture();
  await expect(
    consumerArchiveConfiguration(f.target, {
      worker: "1",
      input: join(f.input, "missing"),
    }),
  ).rejects.toMatchObject({ code: "ENOENT" });
});
it("keeps an explicitly empty worker archive inventory on registry packages", async () => {
  const f = await fixture();
  await f.inventory([]);
  expect(
    await consumerArchiveConfiguration(f.target, {
      worker: "1",
      input: f.input,
    }),
  ).toBeNull();
});
