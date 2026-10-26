import { describe, expect, test } from "vitest";
import { parseNotebookDocument } from "../../parse/parse-notebook-document";
import { buildNotebookPackagesSnapshot } from "../notebook-packages-data";

describe("notebook packages snapshot", () => {
  test("classifies direct and available imports from configured runtime dependencies", () => {
    const document = parseNotebookDocument(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        "const table = aq.from([]);",
        "const total = lodashEs.sum([1, 2, 3]);",
        "```",
        ":::",
      ].join("\n"),
      { sourcePath: "Notebook.notebook.md" },
    );

    const snapshot = buildNotebookPackagesSnapshot({
      file: { path: "Notebook.notebook.md", basename: "Notebook" } as const,
      document,
      runtimeDependencies: [
        { packageName: "arquero", version: "8.0.0", globalName: "aq" },
        { packageName: "lodash-es", version: "4.17.21" },
      ],
    });

    expect(snapshot.directImports.map((entry) => entry.globalName)).toEqual([
      "aq",
      "lodashEs",
    ]);
    expect(snapshot.availableImports).toHaveLength(2);
    expect(snapshot.availableImports[0]).toMatchObject({
      packageName: "arquero",
      usedInNotebook: true,
      referencedCellIds: ["load"],
      status: "configured",
    });
  });

  test("classifies static package imports as direct imports", () => {
    const document = parseNotebookDocument(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'import _ from "lodash";',
        "const total = _.sum([1, 2, 3]);",
        "```",
        ":::",
      ].join("\n"),
      { sourcePath: "Notebook.notebook.md" },
    );

    const snapshot = buildNotebookPackagesSnapshot({
      file: { path: "Notebook.notebook.md", basename: "Notebook" } as const,
      document,
      runtimeDependencies: [{ packageName: "lodash", version: "4.17.21" }],
    });

    expect(snapshot.directImports).toHaveLength(1);
    expect(snapshot.directImports[0]).toMatchObject({
      packageName: "lodash",
      globalName: "lodash",
      usedInNotebook: true,
      referencedCellIds: ["load"],
    });
  });

  test("surfaces invalid registry entries while preserving available imports", () => {
    const document = parseNotebookDocument(
      [':::cell{#load lang="ts"}', "```ts", "aq.from([]);", "```", ":::"].join(
        "\n",
      ),
      { sourcePath: "Notebook.notebook.md" },
    );

    const snapshot = buildNotebookPackagesSnapshot({
      file: { path: "Notebook.notebook.md", basename: "Notebook" } as const,
      document,
      runtimeDependencies: [
        { packageName: "arquero", version: "", globalName: "aq" },
      ],
    });

    expect(snapshot.availableImports[0]).toMatchObject({
      packageName: "arquero",
      globalName: "aq",
      usedInNotebook: true,
      status: "invalid",
    });
    expect(snapshot.availableImports[0].issueMessages).toContain(
      "Package version is required.",
    );
    expect(snapshot.indirectImportsStatus.kind).toBe("unavailable");
  });

  test("hydrates indirect imports when metadata is available", () => {
    const document = parseNotebookDocument(
      [':::cell{#load lang="ts"}', "```ts", "aq.from([]);", "```", ":::"].join(
        "\n",
      ),
      { sourcePath: "Notebook.notebook.md" },
    );

    const snapshot = buildNotebookPackagesSnapshot({
      file: { path: "Notebook.notebook.md", basename: "Notebook" } as const,
      document,
      runtimeDependencies: [
        { packageName: "arquero", version: "8.0.0", globalName: "aq" },
      ],
      indirectImports: [
        {
          packageName: "apache-arrow",
          version: "^15.0.2",
          requiredByPackageNames: ["arquero"],
        },
      ],
      indirectImportsStatus: {
        kind: "ready",
        message: "Loaded transitive dependencies.",
      },
    });

    expect(snapshot.indirectImports[0]).toMatchObject({
      kind: "indirect",
      packageName: "apache-arrow",
      version: "^15.0.2",
      requiredByPackageNames: ["arquero"],
    });
    expect(snapshot.indirectImportsStatus.kind).toBe("ready");
  });
});
