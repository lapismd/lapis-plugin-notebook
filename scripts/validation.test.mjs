import { describe, expect, it } from "vitest";
import {
  auditRouting,
  browserInvocations,
  dispatch,
  imageKey,
  imageInputs,
  cacheKeys,
  nativeInvocation,
  leaseReleaseAllowed,
  stoppedRunState,
  workerArguments,
  validationConfig,
} from "./validation/model.mjs";
import { validateArchives } from "./validation/source.mjs";

describe("Notebook portable validation", () => {
  const recipe =
    "FROM rust:1.99.0-slim@sha256:rust AS rust\nFROM example@sha256:base\n";
  const toolInput = (extra = {}) => ({
    recipe,
    installer: "pinned tools",
    packageJson: JSON.stringify({
      packageManager: "pnpm@10.32.1",
      scripts: { test: "one" },
    }),
    lock: "  playwright@1.62.1:\n  unrelated@1.0.0:\n",
    architecture: "x86_64",
    ...extra,
  });
  it("keys images only from actual recipe and selected tool inputs", () => {
    const original = imageKey(imageInputs(toolInput()));
    expect(
      imageKey(
        imageInputs(
          toolInput({
            packageJson: JSON.stringify({
              packageManager: "pnpm@10.32.1",
              scripts: { test: "changed" },
            }),
            lock: "  playwright@1.62.1:\n  unrelated@2.0.0:\n",
          }),
        ),
      ),
    ).toBe(original);
    for (const change of [
      { lock: "  playwright@1.63.0:\n" },
      { packageJson: '{"packageManager":"pnpm@10.33.0"}' },
      { recipe: recipe.replace("1.99.0", "1.100.0") },
      { installer: "changed tools" },
      { architecture: "aarch64" },
    ])
      expect(imageKey(imageInputs(toolInput(change)))).not.toBe(original);
  });
  it("separates pnpm dependency and Rust cache invalidation", () => {
    const input = {
      image: imageInputs(toolInput()),
      lock: "deps one",
      cargoManifest: "native manifest",
      cargoLock: "native dependencies",
      archives: [],
    };
    const original = cacheKeys(input);
    const dependencies = cacheKeys({ ...input, lock: "deps two" });
    expect(dependencies.pnpm).not.toBe(original.pnpm);
    expect(dependencies.rust).toBe(original.rust);
    const native = cacheKeys({
      ...input,
      cargoLock: "native dependencies two",
    });
    expect(native.rust).not.toBe(original.rust);
    expect(native.pnpm).toBe(original.pnpm);
    expect(
      cacheKeys({
        ...input,
        archives: [
          {
            name: "@lapis-notes/api",
            version: "0.1.4",
            sha256: "a".repeat(64),
          },
        ],
      }).pnpm,
    ).not.toBe(original.pnpm);
  });
  it("retains the checkout lease for an active or unknown worker", () => {
    expect(leaseReleaseAllowed(null)).toBe(false);
    expect(leaseReleaseAllowed(["active-worker"])).toBe(false);
    expect(leaseReleaseAllowed([])).toBe(true);
  });
  it("never treats a preparing or paused worker as stopped cleanup", () => {
    for (const status of [
      "created",
      "running",
      "paused",
      "restarting",
      "removing",
    ])
      expect(stoppedRunState(status)).toBe(false);
    expect(stoppedRunState("exited")).toBe(true);
    expect(stoppedRunState("dead")).toBe(true);
  });
  it("defaults to Docker with finite worker limits", () => {
    expect(validationConfig({}, {})).toMatchObject({
      runtime: "docker",
      cpus: 4,
      memoryGiB: 12,
      shmGiB: 2,
    });
  });
  it("requires an explicit valid native override", () => {
    expect(
      validationConfig({}, { LAPIS_NOTEBOOK_VALIDATION_RUNTIME: "native" })
        .runtime,
    ).toBe("native");
    expect(() =>
      validationConfig({}, { LAPIS_NOTEBOOK_VALIDATION_RUNTIME: "auto" }),
    ).toThrow();
  });
  it("rejects invalid worker limits and contexts", () => {
    for (const value of [0, -1, NaN, Infinity, "4"])
      expect(() => validationConfig({ cpus: value }, {})).toThrow();
    expect(() => validationConfig({ context: "" }, {})).toThrow();
  });
  it("keeps test names and shell metacharacters literal", () => {
    const invocation = nativeInvocation(
      { test: "vitest run" },
      "test",
      ["path with spaces.test.ts", "-t", "$(touch unsafe)"],
      "/repo",
      {},
    );
    expect(invocation.args).toEqual([
      "-c",
      'vitest run "$@"',
      "validation",
      "path with spaces.test.ts",
      "-t",
      "$(touch unsafe)",
    ]);
    expect(invocation.env.LAPIS_NOTEBOOK_VALIDATION_RUNTIME).toBe("native");
  });
  it("rejects an unregistered lane", () => {
    expect(() => nativeInvocation({}, "missing", [], "/repo", {})).toThrow();
  });
  it("bounds the complete browser suite and preserves focused/shard invocations", () => {
    expect(browserInvocations([])).toEqual([
      ["--shard=1/3"],
      ["--shard=2/3"],
      ["--shard=3/3"],
    ]);
    expect(browserInvocations([], 5)).toEqual([
      ["--shard=1/3"],
      ["--shard=2/3"],
      ["--shard=3/3"],
    ]);
    expect(browserInvocations([], 2)).toEqual([
      ["--shard=1/2"],
      ["--shard=2/2"],
    ]);
    expect(browserInvocations([], 1)).toEqual([[]]);
    expect(browserInvocations([], 0)).toEqual([[]]);
    const args = [
      "file with spaces.stories.svelte",
      "-t",
      "two words",
      "--shard=2/4",
    ];
    expect(browserInvocations(args)).toEqual([args]);
    expect(browserInvocations(args, 1)).toEqual([args]);
  });
  it("keys images by sorted dependency/tool identities", () => {
    expect(imageKey({ lock: "one", arch: "arm64" })).toBe(
      imageKey({ arch: "arm64", lock: "one" }),
    );
    expect(imageKey({ lock: "one" })).not.toBe(imageKey({ lock: "two" }));
  });
  it("detects future script-name and executable bypasses", () => {
    const args = workerArguments(validationConfig({}, {}), {
      run: "worker",
      owner: "checkout",
      cache: "rust",
      dependencies: "pnpm",
      image: "pinned",
    });
    expect(args).toContain("--init");
    expect(args).toContain("--cap-drop=ALL");
    expect(args).not.toContain("--privileged");
    expect(
      auditRouting(
        { test: "node scripts/validation.mjs run test" },
        { test: "vitest run" },
      ),
    ).toEqual([]);
    expect(
      auditRouting({ test: "vitest run" }, { test: "vitest run" }),
    ).not.toEqual([]);
    expect(auditRouting({ "check:new": "node new-check.mjs" }, {})).not.toEqual(
      [],
    );
    expect(auditRouting({ surprise: "playwright test" }, {})).not.toEqual([]);
    expect(
      auditRouting({ surprise: "node --test scripts/example.mjs" }, {}),
    ).not.toEqual([]);
    expect(auditRouting({ storybook: "storybook dev" }, {})).not.toEqual([]);
  });
  it("never falls back to native after a Docker failure", async () => {
    let native = false;
    await expect(
      dispatch(
        { runtime: "docker" },
        () => {
          native = true;
        },
        () => {
          throw Error("daemon unavailable");
        },
      ),
    ).rejects.toThrow("daemon unavailable");
    expect(native).toBe(false);
  });
  it("validates explicit temporary archive identities without changing manifests", () => {
    const entry = {
      name: "@lapis-notes/api",
      version: "0.1.0",
      path: "api.tgz",
      sha256: "a".repeat(64),
    };
    expect(validateArchives([entry])).toEqual([entry]);
    expect(() => validateArchives([entry, entry])).toThrow();
    expect(() => validateArchives([{ ...entry, sha256: "wrong" }])).toThrow();
  });
});
