import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { describe, it, expect } from "vitest";
import { parse, stringify } from "yaml";
import {
  notebookCoreFacts,
  verifyNotebookCanonicalIntake,
} from "./check-canonical-intake.mjs";
const fixture = JSON.parse(
  gunzipSync(
    readFileSync(new URL("../fixtures/core-intake.json.gz", import.meta.url)),
  ),
);
const policyBytes = readFileSync(
  new URL(
    "../../.github/dependency-automation/canonical-intake.json",
    import.meta.url,
  ),
  "utf8",
);
const chapters = JSON.parse(policyBytes).chapters;
const document = (facts) =>
  "# Notebook source contract\n\n<!-- dependency-intake:core-development:start -->\n\n```json\n" +
  JSON.stringify(facts, null, 2) +
  "\n```\n\n<!-- dependency-intake:core-development:end -->\n\nAuthored text.\n";
function input() {
  const before = structuredClone(fixture.before),
    files = structuredClone(fixture.after);
  return {
    before,
    files,
    policyBytes,
    basePolicyBytes: policyBytes,
    changedFiles: [...Object.keys(files), ...chapters],
    baseDocuments: Object.fromEntries(
      chapters.map((p) => [
        p,
        document(notebookCoreFacts(before, policyBytes)),
      ]),
    ),
    documents: Object.fromEntries(
      chapters.map((p) => [p, document(notebookCoreFacts(files, policyBytes))]),
    ),
  };
}
describe("source-owned Core intake verification", () => {
  it("verifies the actual Core PR36 candidate independently of shared rendering", () => {
    expect(verifyNotebookCanonicalIntake(input()).version).toBe("0.13.4");
  });
  for (const [name, mutate] of [
    [
      "stale facts",
      (d) => (d.documents[chapters[0]] = d.baseDocuments[chapters[0]]),
    ],
    ["missing facts", (d) => (d.documents[chapters[0]] = "no slot")],
    [
      "ambiguous markers",
      (d) => (d.documents[chapters[0]] += d.documents[chapters[0]]),
    ],
    [
      "manual chapter edits",
      (d) => (d.documents[chapters[0]] += "Manual repair"),
    ],
    ["changed source policy", (d) => (d.basePolicyBytes += " ")],
    [
      "unsupported policy",
      (d) =>
        (d.policyBytes = d.policyBytes.replace(
          "core-development",
          "unreviewed",
        )),
    ],
    [
      "unexpected source scope",
      (d) => d.changedFiles.push("src/lib/product.ts"),
    ],
    [
      "wrong registry package integrity",
      (d) =>
        (d.files["pnpm-lock.yaml"] = d.files["pnpm-lock.yaml"].replace(
          "sha512-pKZpaK",
          "sha512-XXXXXX",
        )),
    ],
    [
      "unrelated lock settings",
      (d) => (d.files["pnpm-lock.yaml"] += "\nunknownSetting: changed\n"),
    ],
  ])
    it(`holds ${name} without edits`, () => {
      const d = input();
      mutate(d);
      const saved = structuredClone(d);
      expect(() => verifyNotebookCanonicalIntake(d)).toThrow();
      expect(d).toEqual(saved);
    });
  it("rejects a same-version integrity rewrite even with matching forged slots", () => {
    const d = input();
    d.files = structuredClone(d.before);
    d.files["pnpm-lock.yaml"] = d.files["pnpm-lock.yaml"].replace(
      "sha512-VpzlcM",
      "sha512-XXXXXX",
    );
    const facts = notebookCoreFacts(d.files, policyBytes);
    d.documents = Object.fromEntries(chapters.map((p) => [p, document(facts)]));
    expect(() => verifyNotebookCanonicalIntake(d)).toThrow(
      /immutable Core version integrity changed/,
    );
  });
  it("preserves unrelated prefix-sharing Core package identities", () => {
    const d = input(),
      before = parse(d.before["pnpm-lock.yaml"]),
      after = parse(d.files["pnpm-lock.yaml"]);
    const metadata = {
      resolution: {
        integrity: "sha512-" + Buffer.alloc(64, 2).toString("base64"),
      },
    };
    before.packages["@lapismd/design-core@0.13.30"] = metadata;
    after.packages["@lapismd/design-core@0.13.40"] = metadata;
    d.before["pnpm-lock.yaml"] = stringify(before);
    d.files["pnpm-lock.yaml"] = stringify(after);
    expect(() => verifyNotebookCanonicalIntake(d)).toThrow(
      /unexpected public contract or registry catalog change/,
    );
  });
  it("stays outside specification exemptions and has no network/bootstrap", () => {
    const lane = JSON.parse(
      readFileSync(
        new URL("../validation/lanes.json", import.meta.url),
        "utf8",
      ),
    );
    expect(lane.check).toContain("pnpm check:dependency-intake");
    expect(lane["check:dependency-intake"]).toBe(
      "node scripts/dependency-automation/check-canonical-intake.mjs",
    );
    const source = readFileSync(
      new URL("./check-canonical-intake.mjs", import.meta.url),
      "utf8",
    );
    expect(source).not.toMatch(
      /skipSpecification|fetch\(|https:\/\/|pnpm.*install/,
    );
  });
});
