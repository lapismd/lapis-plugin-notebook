import { readFileSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { isDeepStrictEqual as equal } from "node:util";
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parse } from "yaml";
import { changesFromVcs } from "@lapismd/spec-validator";

const core = "@lapismd/design-core";
const policyPath = ".github/dependency-automation/canonical-intake.json";
const chapters = [
  "spec/src/plugins/notebook/index.md",
  "spec/src/spec-governance.md",
];
const expectedPolicy = {
  schemaVersion: 1,
  kind: "single-development-dependency",
  repository: "lapismd/lapis-plugin-notebook",
  dependency: core,
  slot: "core-development",
  chapters,
};
const fail = (reason) => {
  throw Error(`Notebook canonical intake: ${reason}`);
};
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
export function notebookCoreFacts(files, policyBytes) {
  if (!equal(JSON.parse(policyBytes), expectedPolicy))
    fail("source policy changed or unsupported");
  const manifest = JSON.parse(files["package.json"]),
    workspace = parse(files["pnpm-workspace.yaml"]),
    lock = parse(files["pnpm-lock.yaml"]);
  const version = manifest.devDependencies?.[core],
    peer = manifest.peerDependencies?.[core];
  const integrity =
    lock.packages?.[`${core}@${version}`]?.resolution?.integrity;
  const importers = Object.fromEntries(
    Object.entries(lock.importers ?? {})
      .filter(([, p]) => p.devDependencies?.[core])
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([path, p]) => [path, p.devDependencies[core]]),
  );
  if (
    !/^0\.13\.\d+$/.test(version ?? "") ||
    peer !== "^0.9.0 || ^0.10.0 || ^0.13.0" ||
    workspace.overrides?.[core] !== version ||
    lock.overrides?.[core] !== version ||
    !/^sha512-[A-Za-z0-9+/]{86}==$/.test(integrity ?? "") ||
    !importers["."] ||
    Object.values(importers).some(
      (v) => v.specifier !== version || v.version?.split("(")[0] !== version,
    )
  )
    fail(
      "Core catalog, peer support, override or registry resolution mismatch",
    );
  return {
    schemaVersion: 1,
    kind: "development-dependency-intake",
    dependency: core,
    version,
    peer,
    integrity,
    importers,
    policySha256: hash(policyBytes),
  };
}
function slot(text) {
  const start = "<!-- dependency-intake:core-development:start -->",
    end = "<!-- dependency-intake:core-development:end -->";
  if (
    typeof text !== "string" ||
    text.split(start).length !== 2 ||
    text.split(end).length !== 2 ||
    text.indexOf(end) < text.indexOf(start)
  )
    fail("missing or ambiguous source slot");
  const body = text.slice(
    text.indexOf(start) + start.length,
    text.indexOf(end),
  );
  const match = /^\s*```json\n([\s\S]*?)\n```\s*$/.exec(body);
  if (!match) fail("manual or malformed source slot");
  return {
    facts: JSON.parse(match[1]),
    outside:
      text.slice(0, text.indexOf(start)) +
      text.slice(text.indexOf(end) + end.length),
  };
}
// Notebook owns its catalog audit; it compares package identities, metadata and
// direct dependency edges independently from the coordinator's string renderer.
function catalog(lock, version) {
  const identity = (s) => {
    const base = s.split("(")[0];
    return base === `${core}@${version}` ? `${core}@<Core>` : base;
  };
  const reference = (name, value) =>
    name === core
      ? identity(value) === version
        ? "<Core>"
        : fail("unexpected Core lock reference")
      : identity(value);
  const entries = (rows, make) =>
    Object.fromEntries(
      Object.entries(rows ?? {}).map(([name, row]) => [
        identity(name),
        make(row),
      ]),
    );
  const packages = entries(lock.packages, (row) => ({
    ...row,
    ...(row.peerDependencies
      ? {
          peerDependencies: Object.fromEntries(
            Object.entries(row.peerDependencies).map(([n, v]) => [
              n,
              n === core && v === version ? "<Core>" : v,
            ]),
          ),
        }
      : {}),
  }));
  const selected = packages[`${core}@<Core>`];
  if (!selected) fail("missing Core package");
  selected.resolution = { ...selected.resolution, integrity: "<Core>" };
  const snapshots = {};
  for (const [name, row] of Object.entries(lock.snapshots ?? {})) {
    const key = identity(name),
      normalized = { ...row };
    for (const section of ["dependencies", "optionalDependencies"])
      if (row[section])
        normalized[section] = Object.fromEntries(
          Object.entries(row[section]).map(([n, v]) => [n, reference(n, v)]),
        );
    (snapshots[key] ??= []).push(normalized);
  }
  for (const rows of Object.values(snapshots))
    rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const importers = Object.fromEntries(
    Object.entries(lock.importers ?? {}).map(([path, row]) => [
      path,
      Object.fromEntries(
        Object.entries(row).map(([section, items]) => [
          section,
          Object.fromEntries(
            Object.entries(items).map(([name, item]) => [
              name,
              {
                ...item,
                ...(name === core ? { specifier: "<Core>" } : {}),
                version: reference(name, item.version),
              },
            ]),
          ),
        ]),
      ),
    ]),
  );
  return {
    ...lock,
    overrides: { ...lock.overrides, [core]: "<Core>" },
    packages,
    snapshots,
    importers,
  };
}
export function verifyNotebookCanonicalIntake({
  files,
  policyBytes,
  documents,
  before,
  basePolicyBytes,
  baseDocuments,
  changedFiles = [],
}) {
  const facts = notebookCoreFacts(files, policyBytes);
  for (const p of chapters)
    if (!equal(slot(documents[p]).facts, facts))
      fail("managed facts differ from actual candidate");
  if (!before) return facts;
  const previous = JSON.parse(before["package.json"]),
    candidate = JSON.parse(files["package.json"]);
  const old = previous.devDependencies?.[core];
  if (old === facts.version) {
    const originalIntegrity = parse(before["pnpm-lock.yaml"]).packages?.[
      `${core}@${old}`
    ]?.resolution?.integrity;
    if (originalIntegrity !== facts.integrity)
      fail("immutable Core version integrity changed");
    return facts;
  }
  if (
    basePolicyBytes !== policyBytes ||
    !/^0\.13\.\d+$/.test(old ?? "") ||
    Number(facts.version.split(".")[2]) <= Number(old.split(".")[2])
  )
    fail("missing, changed or stale source opt-in");
  if (
    changedFiles.some(
      (p) =>
        ![
          "package.json",
          "pnpm-workspace.yaml",
          "pnpm-lock.yaml",
          ...chapters,
        ].includes(p),
    )
  )
    fail("unexpected Core intake scope");
  const strip = (value, section) => {
    const copy = structuredClone(value);
    delete copy[section][core];
    return copy;
  };
  if (
    !equal(
      strip(previous, "devDependencies"),
      strip(candidate, "devDependencies"),
    ) ||
    !equal(
      strip(parse(before["pnpm-workspace.yaml"]), "overrides"),
      strip(parse(files["pnpm-workspace.yaml"]), "overrides"),
    ) ||
    !equal(
      catalog(parse(before["pnpm-lock.yaml"]), old),
      catalog(parse(files["pnpm-lock.yaml"]), facts.version),
    )
  )
    fail("unexpected public contract or registry catalog change");
  const oldFacts = notebookCoreFacts(before, basePolicyBytes);
  for (const p of chapters) {
    const base = slot(baseDocuments[p]),
      current = slot(documents[p]);
    if (!equal(base.facts, oldFacts) || base.outside !== current.outside)
      fail("manual source chapter edits or stale baseline");
  }
  return facts;
}
export function checkNotebookCanonicalIntake(root = process.cwd()) {
  const read = (path) => {
    const target = resolve(root, path);
    if (realpathSync(target) !== target) fail("non-regular source path");
    return readFileSync(target, "utf8");
  };
  const inputs = ["package.json", "pnpm-workspace.yaml", "pnpm-lock.yaml"];
  const files = Object.fromEntries(inputs.map((p) => [p, read(p)])),
    documents = Object.fromEntries(chapters.map((p) => [p, read(p)]));
  const run = (args) =>
    execFileSync("jj", ["--ignore-working-copy", ...args], {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 3 * 1024 * 1024,
    }).trimEnd();
  const parents = run([
    "log",
    "-r",
    "@",
    "--no-graph",
    "-T",
    'parents.map(|p| p.commit_id()).join("\n")',
  ])
    .split("\n")
    .filter(Boolean);
  if (!parents.length) fail("source ancestry unavailable");
  const base = (path) =>
    execFileSync(
      "jj",
      ["--ignore-working-copy", "file", "show", "-r", parents[0], "--", path],
      { cwd: root, encoding: "utf8", maxBuffer: 3 * 1024 * 1024 },
    );
  const before = Object.fromEntries(inputs.map((p) => [p, base(p)]));
  let basePolicyBytes, baseDocuments;
  if (
    JSON.parse(before["package.json"]).devDependencies?.[core] !==
    JSON.parse(files["package.json"]).devDependencies?.[core]
  ) {
    basePolicyBytes = base(policyPath);
    baseDocuments = Object.fromEntries(chapters.map((p) => [p, base(p)]));
  }
  return verifyNotebookCanonicalIntake({
    files,
    policyBytes: read(policyPath),
    documents,
    before,
    basePolicyBytes,
    baseDocuments,
    changedFiles: changesFromVcs({}, root).map((c) => c.path),
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  checkNotebookCanonicalIntake();
  console.log("Notebook Core canonical intake matches actual source facts.");
}
