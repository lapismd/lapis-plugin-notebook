import { expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import { resolveRegistrySource } from "./registry-resolve.mjs";

async function fixture(changes = {}) {
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  const manifest = JSON.parse(await readFile("manifest.json", "utf8"));
  const repository = pkg.repository.url.slice(
    "git+https://github.com/".length,
    -4,
  );
  const tag =
    manifest.id === "tasks" ? `${pkg.name}@${pkg.version}` : `v${pkg.version}`;
  const commit = "a".repeat(40);
  const gate = manifest.id === "tasks" ? "Validate" : "Validation lanes";
  const files = {
    "package.json": { ...pkg, ...changes.pkg },
    "manifest.json": manifest,
    "registry.json": JSON.parse(await readFile("registry.json", "utf8")),
  };
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    let value;
    if (url.includes("/releases/tags/"))
      value = { tag_name: tag, draft: false, ...changes.release };
    else if (url.includes("/git/ref/"))
      value = { object: { type: "commit", sha: commit } };
    else if (url.includes("/compare/"))
      value = { status: changes.ancestry ?? "ahead" };
    else if (url.includes("/contents/")) {
      const name = url.split("/contents/")[1].split("?")[0];
      value = {
        content: Buffer.from(JSON.stringify(files[name])).toString("base64"),
      };
    } else if (url.includes("/check-runs")) {
      const check = {
        id: 10,
        name: gate,
        app: { slug: "github-actions" },
        conclusion: "success",
        ...changes.check,
      };
      value = {
        check_runs:
          changes.paginate && url.endsWith("page=1")
            ? Array.from({ length: 100 }, (_, id) => ({
                id,
                name: "Another check",
              }))
            : [
                check,
                ...(changes.newerFailure
                  ? [{ ...check, id: 11, conclusion: "failure" }]
                  : []),
              ],
      };
    } else throw Error(`Unexpected URL: ${url}`);
    return new Response(JSON.stringify(value));
  };
  return { repository, tag, token: "read-token", fetchImpl, calls, commit };
}

test("resolves an admitted stable source and paginates exact-head CI checks", async () => {
  const f = await fixture({ paginate: true });
  expect(await resolveRegistrySource(f)).toEqual({
    commit: f.commit,
    tag: f.tag,
  });
  expect(f.calls.some((url) => url.endsWith("page=2"))).toBe(true);
});

test.each([
  { release: { draft: true } },
  { release: { prerelease: true } },
  { ancestry: "diverged" },
  { pkg: { version: "999.0.0" } },
  { check: { conclusion: "failure" } },
  { newerFailure: true },
])("rejects unqualified release state %j", async (changes) => {
  await expect(resolveRegistrySource(await fixture(changes))).rejects.toThrow();
});
