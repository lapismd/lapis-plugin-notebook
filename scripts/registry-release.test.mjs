import { afterAll, expect, test } from "vitest";
import { createHash, createPublicKey, generateKeyPairSync } from "node:crypto";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  prepareRegistryRelease,
  signRegistryRelease,
} from "./registry-release.mjs";
import { publishRegistryRelease } from "./registry-publish.mjs";
import { verifiedPublishedCoordinates } from "./vendor/lapis-plugins/scripts/lib/published-static-release.mjs";
import { parsePluginBundle } from "./vendor/lapis-plugins/scripts/lib/plugin-bundle.mjs";
import { mediaCaptures } from "./registry-media.mjs";

const roots = [];
afterAll(async () => {
  await Promise.all(
    roots.map((root) => rm(root, { recursive: true, force: true })),
  );
});
const json = async (file) => JSON.parse(await readFile(file, "utf8"));
const ok = (body) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "registry-release-test-"));
  roots.push(root);
  const pkg = await json("package.json");
  const manifest = await json("manifest.json");
  await mkdir(join(root, "runtime"));
  for (const [file, value] of Object.entries({
    "package.json": pkg,
    "manifest.json": manifest,
    "registry.json": await json("registry.json"),
  }))
    await writeFile(join(root, file), JSON.stringify(value));
  await writeFile(
    join(root, "runtime/manifest.json"),
    JSON.stringify(manifest),
  );
  await writeFile(
    join(root, "runtime/main.mjs"),
    "export default class Plugin {}\n",
  );
  await writeFile(
    join(root, "runtime/styles.css"),
    ".plugin { color: inherit }\n",
  );
  await writeFile(
    join(root, "runtime/app.css"),
    ".plugin { color: inherit }\n",
  );
  const request = await prepareRegistryRelease({
    root,
    inputDir: join(root, "runtime"),
    sourceCommit: "a".repeat(40),
  });
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const keyFile = join(root, "key.pem");
  await writeFile(keyFile, privateKey.export({ type: "pkcs8", format: "pem" }));
  const publicRaw = publicKey
    .export({ type: "spki", format: "der" })
    .subarray(-32)
    .toString("base64");
  await signRegistryRelease({
    root,
    privateKeyFile: keyFile,
    keyId: "test-key",
    production: false,
  });
  const bytes = await readFile(
    join(root, ".release/registry", request.assetName),
  );
  return { root, request, keyFile, bytes, keys: { "test-key": publicRaw } };
}

function published(f, overrides = {}) {
  const calls = [];
  const fetchImpl = async (input, options = {}) => {
    const url = String(input);
    calls.push({ url, ...options });
    if (url.endsWith("/dispatches")) return new Response(null, { status: 204 });
    if (url.includes("/releases/tags/"))
      return ok({
        id: 7,
        tag_name: f.request.releaseTag,
        draft: false,
        upload_url: `https://uploads.github.com/repos/${f.request.repository}/releases/7/assets{?name,label}`,
        assets: overrides.incomplete
          ? [{ name: f.request.assetName }]
          : [
              {
                name: f.request.assetName,
                size: f.bytes.length,
                browser_download_url: "https://github.com/archive",
              },
              {
                name: `${f.request.assetName}.sha256`,
                size: 100,
                browser_download_url: "https://github.com/checksum",
              },
            ],
      });
    if (url.endsWith("/archive"))
      return new Response(overrides.bytes ?? f.bytes);
    if (url.endsWith("/checksum")) {
      const text = `${createHash("sha256").update(f.bytes).digest("hex")}  ${f.request.assetName}\n`;
      // The published verifier checks the advertised size too.
      return new Response(overrides.checksum ?? text);
    }
    if (url.includes("/git/ref/tags/"))
      return ok({
        object: { type: "commit", sha: overrides.commit ?? "a".repeat(40) },
      });
    throw Error(`Unexpected request: ${url}`);
  };
  // Compute the real checksum response size rather than assuming a name length.
  const wrapped = async (url, options) => {
    const response = await fetchImpl(url, options);
    if (String(url).includes("/releases/tags/") && !overrides.incomplete) {
      const release = await response.json();
      release.assets[1].size = Buffer.byteLength(
        overrides.checksum ??
          `${createHash("sha256").update(f.bytes).digest("hex")}  ${f.request.assetName}\n`,
      );
      return ok(release);
    }
    return response;
  };
  return { fetchImpl: wrapped, calls };
}

test("archive reproduction is byte-identical and contains exactly its sorted signed files", async () => {
  const f = await fixture();
  const files = parsePluginBundle(f.bytes);
  const envelope = JSON.parse(files.get("release.signed.json"));
  expect([...files.keys()]).toEqual([
    "release.signed.json",
    ...envelope.signed.files.map((file) => file.path),
  ]);
  expect(envelope.signed.source.commit).toBe("a".repeat(40));
  await signRegistryRelease({
    root: f.root,
    privateKeyFile: f.keyFile,
    keyId: "test-key",
    production: false,
  });
  expect(
    await readFile(join(f.root, ".release/registry", f.request.assetName)),
  ).toEqual(f.bytes);
});

test("production refuses keys outside the pinned release trust root", async () => {
  const f = await fixture();
  await expect(
    signRegistryRelease({
      root: f.root,
      privateKeyFile: f.keyFile,
      keyId: "test-key",
    }),
  ).rejects.toThrow("pinned");
});

test("retained published assets dispatch their signed commit without upload", async () => {
  const f = await fixture();
  f.request.sourceCommit = "b".repeat(40);
  await writeFile(
    join(f.root, ".release/registry/request.json"),
    JSON.stringify(f.request),
  );
  const mock = published(f);
  const result = await publishRegistryRelease({
    root: f.root,
    token: "release-token",
    registryToken: "registry-token",
    fetchImpl: mock.fetchImpl,
    verify: (request, options) =>
      verifiedPublishedCoordinates(request, { ...options, keys: f.keys }),
  });
  expect(result.payload.source_commit).toBe("a".repeat(40));
  expect(mock.calls.filter((call) => call.method === "POST")).toHaveLength(1);
  expect(JSON.parse(mock.calls.at(-1).body).client_payload).toEqual(
    result.payload,
  );
});

test("dry runs verify retained archives without any GitHub mutation or registry token", async () => {
  const f = await fixture();
  const mock = published(f);
  await publishRegistryRelease({
    root: f.root,
    token: "read-token",
    dryRun: true,
    fetchImpl: mock.fetchImpl,
    verify: (request, options) =>
      verifiedPublishedCoordinates(request, { ...options, keys: f.keys }),
  });
  expect(mock.calls.every((call) => !call.method)).toBe(true);
});

test.each(["checksum", "tag", "coordinates", "signature", "size"])(
  "rejects invalid published %s before dispatch",
  async (kind) => {
    const f = await fixture();
    const options =
      kind === "checksum"
        ? { checksum: "bad" }
        : kind === "tag"
          ? { commit: "b".repeat(40) }
          : kind === "size"
            ? { bytes: f.bytes.subarray(1) }
            : {};
    const mock = published(f, options);
    const request =
      kind === "coordinates"
        ? { ...f.request, pluginId: "another-plugin" }
        : f.request;
    const keys =
      kind === "signature"
        ? {
            "test-key": createPublicKey(
              generateKeyPairSync("ed25519").privateKey,
            )
              .export({ type: "spki", format: "der" })
              .subarray(-32)
              .toString("base64"),
          }
        : f.keys;
    await expect(
      verifiedPublishedCoordinates(request, {
        fetchImpl: mock.fetchImpl,
        keys,
      }),
    ).rejects.toThrow();
    expect(mock.calls.some((call) => call.method === "POST")).toBe(false);
  },
);

test("an incomplete immutable asset pair requires a new patch", async () => {
  const f = await fixture();
  await expect(
    publishRegistryRelease({
      root: f.root,
      token: "token",
      registryToken: "token",
      fetchImpl: published(f, { incomplete: true }).fetchImpl,
    }),
  ).rejects.toThrow("incomplete immutable");
});

test("media declares ordered variants with alt text and rejects traversal or undeclared stories", async () => {
  const source = await json("registry.json");
  const manifest = await json("manifest.json");
  expect(
    mediaCaptures(source, manifest.name)
      .slice(-2)
      .map((item) => item.id),
  ).toEqual(source.gallery.map((item) => item.id));
  source.gallery[0].images.preview.path = "../escaped.webp";
  expect(() => mediaCaptures(source, manifest.name)).toThrow("Unsafe");
});

test("vendored shared code matches every pinned upstream checksum", async () => {
  const directory = "scripts/vendor/lapis-plugins";
  const provenance = await json(join(directory, "provenance.json"));
  for (const [file, hash] of Object.entries(provenance.sha256))
    expect(
      createHash("sha256")
        .update(await readFile(join(directory, file)))
        .digest("hex"),
    ).toBe(hash);
});

test("every external runtime module is in the published web host import map", async () => {
  const { pluginHostModuleRegistry } = await import(
    "@lapis-notes/api/plugin-host-modules"
  );
  const manifest = await json("manifest.json");
  const missing =
    manifest.lapis.runtime.entries.workspace.sharedDependencies.filter(
      (name) => {
        const host = pluginHostModuleRegistry[name];
        return !host?.public || !host.platforms.includes("web");
      },
    );
  expect(missing).toEqual([]);
});
