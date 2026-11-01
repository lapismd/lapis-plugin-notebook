import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  integrity,
  packageName,
  prepare,
  registryVersion,
  validateArchiveFiles,
  validateCandidate,
  validateIdentity,
  verifyPublishedArtifact,
} from "./release-candidate.mjs";
import {
  assertPublicationEnvironment,
  shouldPublish,
  version,
} from "./release.mjs";

describe("Notebook immutable Changesets release boundary", () => {
  const bytes = Buffer.from("qualified npm package");
  const source = "a".repeat(40);
  const candidate = {
    schema: 1,
    installation: "frozen-registry",
    name: packageName,
    version: "0.2.2",
    source,
    tarball: "lapis-notes-lapis-plugin-notebook-0.2.2.tgz",
    integrity: integrity(bytes),
    size: bytes.length,
  };
  const pkg = {
    name: packageName,
    version: "0.2.2",
    dependencies: { api: "^0.2.4" },
  };
  const manifest = {
    id: "lapis-notebook",
    version: pkg.version,
    distribution: "first-party-external",
  };

  it("holds publication until changesets are consumed and skips published versions", () => {
    expect(shouldPublish({ pendingChangesets: true, existing: null })).toBe(
      false,
    );
    expect(
      shouldPublish({
        pendingChangesets: false,
        existing: { version: "0.2.2" },
      }),
    ).toBe(false);
    expect(shouldPublish({ pendingChangesets: false, existing: null })).toBe(
      true,
    );
  });
  it("rejects private packages, mismatched runtime IDs/versions and local dependencies", () => {
    expect(() => validateIdentity(pkg, manifest)).not.toThrow();
    for (const patch of [
      { private: true },
      { version: "0.2.1" },
      { name: "other" },
      { version: "0.2.2-beta.1" },
      { dependencies: { api: "file:../api" } },
      { dependencies: { api: "workspace:*" } },
    ])
      expect(() => validateIdentity({ ...pkg, ...patch }, manifest)).toThrow();
    expect(() =>
      validateIdentity(pkg, { ...manifest, id: "notebook" }),
    ).toThrow();
  });
  it("requires the exact main workflow, source and production approval", () => {
    const env = {
      LAPIS_NOTEBOOK_RELEASE_APPROVED: "1",
      GITHUB_REPOSITORY: "lapismd/lapis-plugin-notebook",
      GITHUB_REF: "refs/heads/main",
      GITHUB_SHA: source,
      GITHUB_WORKFLOW_REF:
        "lapismd/lapis-plugin-notebook/.github/workflows/ci.yml@refs/heads/main",
      GITHUB_EVENT_NAME: "push",
    };
    expect(() => assertPublicationEnvironment(candidate, env)).not.toThrow();
    for (const patch of [
      { LAPIS_NOTEBOOK_RELEASE_APPROVED: "" },
      { GITHUB_SHA: "b".repeat(40) },
      { GITHUB_REF: "refs/heads/feature" },
      { GITHUB_EVENT_NAME: "pull_request" },
      { GITHUB_REPOSITORY: "other/repo" },
      { GITHUB_WORKFLOW_REF: "other" },
    ])
      expect(() =>
        assertPublicationEnvironment(candidate, { ...env, ...patch }),
      ).toThrow();
  });
  it("rejects stale artifacts, changed bytes and paths outside the qualified artifact", () => {
    expect(() => validateCandidate(candidate, source, bytes)).not.toThrow();
    for (const patch of [
      { source: "b".repeat(40) },
      { size: 0 },
      { installation: "temporary-archive" },
      { tarball: "../outside.tgz" },
      { name: "other" },
      { integrity: integrity(Buffer.from("changed")) },
    ])
      expect(() =>
        validateCandidate({ ...candidate, ...patch }, source, bytes),
      ).toThrow();
    expect(() =>
      validateCandidate(candidate, source, Buffer.from("changed")),
    ).toThrow();
  });
  it("requires packed public entries and excludes local credentials and test sources", () => {
    const files = [
      "dist/main.mjs",
      "dist/index.d.ts",
      "dist/styles.css",
      "manifest.json",
      "LICENSE",
      "CHANGELOG.md",
    ].map((x) => "package/" + x);
    expect(() => validateArchiveFiles(files)).not.toThrow();
    expect(() => validateArchiveFiles(files.slice(1))).toThrow("missing");
    for (const entry of [
      "../outside",
      "package/../outside",
      "package/.env",
      "package/.env.production",
      "package/dist/code.test.js",
      "package/node_modules/key",
    ])
      expect(() => validateArchiveFiles([...files, entry])).toThrow(
        "Forbidden",
      );
  });
  it("refuses artifact preparation in a temporary archive worker", async () => {
    vi.stubEnv("LAPIS_NOTEBOOK_VALIDATION_WORKER", "1");
    vi.stubEnv("LAPIS_NOTEBOOK_VALIDATION_ARCHIVE_COUNT", "1");
    try {
      await expect(prepare("/unused")).rejects.toThrow("registry-only");
    } finally {
      vi.unstubAllEnvs();
    }
  });
  it("requires exact downloadable bytes, matching coordinates and npm provenance", () => {
    const metadata = {
      name: packageName,
      version: candidate.version,
      dist: {
        integrity: candidate.integrity,
        attestations: {
          provenance: { predicateType: "https://slsa.dev/provenance/v1" },
        },
      },
    };
    expect(() =>
      verifyPublishedArtifact(candidate, metadata, bytes),
    ).not.toThrow();
    expect(() =>
      verifyPublishedArtifact(candidate, metadata, Buffer.from("different")),
    ).toThrow();
    expect(() =>
      verifyPublishedArtifact(
        candidate,
        { ...metadata, version: "0.1.0" },
        bytes,
      ),
    ).toThrow();
    expect(() =>
      verifyPublishedArtifact(
        candidate,
        { ...metadata, dist: { integrity: candidate.integrity } },
        bytes,
      ),
    ).toThrow("provenance");
  });
  it("fails closed on npm errors and unexpected metadata", async () => {
    expect(
      await registryVersion("0.2.2", async () => ({ status: 404 })),
    ).toBeNull();
    await expect(
      registryVersion("0.2.2", async () => ({ status: 500, ok: false })),
    ).rejects.toThrow("500");
    await expect(
      registryVersion("0.2.2", async () => ({
        ok: true,
        json: async () => ({ name: "other" }),
      })),
    ).rejects.toThrow("coordinates");
  });
  it("uses real Changesets versioning and synchronizes the public runtime and canonical version", async () => {
    const root = await mkdtemp(join(tmpdir(), "notebook-changeset-"));
    try {
      for (const dir of [
        ".changeset",
        "spec/src/plugins/notebook",
        "packages/private",
      ])
        await mkdir(join(root, dir), { recursive: true });
      await writeFile(
        join(root, "package.json"),
        JSON.stringify({ ...pkg, version: "0.2.1", dependencies: {} }),
      );
      await writeFile(
        join(root, "manifest.json"),
        JSON.stringify({ ...manifest, version: "0.2.1" }),
      );
      await writeFile(
        join(root, "pnpm-workspace.yaml"),
        'packages:\n  - "."\n  - "packages/*"\n',
      );
      await writeFile(
        join(root, "packages/private/package.json"),
        JSON.stringify({
          name: "@lapis-notes/notebook-test-private",
          version: "0.0.0",
          private: true,
        }),
      );
      await writeFile(
        join(root, "spec/src/plugins/notebook/index.md"),
        "Release package and runtime manifest version: `0.2.1`.\n",
      );
      await writeFile(
        join(root, ".changeset/config.json"),
        await readFile(new URL("../.changeset/config.json", import.meta.url)),
      );
      await writeFile(
        join(root, ".changeset/patch.md"),
        `---\n"${packageName}": patch\n---\n\nAutomatic registry releases.\n`,
      );
      const calls = [];
      await version(root, (command, args, options) => {
        calls.push(args);
        if (args[0] === "exec")
          execFileSync(
            process.execPath,
            [
              new URL("../node_modules/@changesets/cli/bin.js", import.meta.url)
                .pathname,
              "version",
            ],
            { ...options, stdio: "pipe" },
          );
      });
      expect(
        JSON.parse(await readFile(join(root, "package.json"))).version,
      ).toBe("0.2.2");
      expect(
        JSON.parse(await readFile(join(root, "manifest.json"))).version,
      ).toBe("0.2.2");
      expect(
        JSON.parse(await readFile(join(root, "packages/private/package.json")))
          .version,
      ).toBe("0.0.0");
      expect(
        await readFile(
          join(root, "spec/src/plugins/notebook/index.md"),
          "utf8",
        ),
      ).toContain("`0.2.2`");
      expect(await readFile(join(root, "CHANGELOG.md"), "utf8")).toContain(
        "Automatic registry releases.",
      );
      expect(calls.at(-1)).toEqual([
        "install",
        "--lockfile-only",
        "--ignore-pnpmfile",
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
