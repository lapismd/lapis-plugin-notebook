import { describe, expect, test } from "vitest";
import {
  fetchNotebookPackageManifest,
  type NotebookPackageManifest,
  resolveNotebookIndirectImports,
  searchNotebookPackages,
} from "../notebook-package-registry";

describe("notebook package registry", () => {
  test("loads a pinned package manifest from the npm registry payload shape", async () => {
    const manifest = await fetchNotebookPackageManifest(
      "arquero",
      "8.0.0",
      async () => ({
        ok: true,
        status: 200,
        async json() {
          return {
            name: "arquero",
            version: "8.0.0",
            description: "Tables",
            dependencies: {
              "apache-arrow": "^15.0.2",
            },
          };
        },
      }),
    );

    expect(manifest).toEqual({
      packageName: "arquero",
      version: "8.0.0",
      description: "Tables",
      dependencies: {
        "apache-arrow": "^15.0.2",
      },
    });
  });

  test("searches npm packages and returns package suggestions", async () => {
    const results = await searchNotebookPackages("arquero", async () => ({
      ok: true,
      status: 200,
      async json() {
        return {
          objects: [
            {
              package: {
                name: "arquero",
                version: "8.0.0",
                description: "Columnar tables",
              },
            },
          ],
        };
      },
    }));

    expect(results).toEqual([
      {
        packageName: "arquero",
        latestVersion: "8.0.0",
        description: "Columnar tables",
      },
    ]);
  });

  test("resolves indirect imports from direct package manifests", async () => {
    const resolved = await resolveNotebookIndirectImports(
      [
        { packageName: "arquero", version: "8.0.0" },
        { packageName: "plot", version: "0.6.17" },
      ],
      async (packageName, _version): Promise<NotebookPackageManifest> => {
        if (packageName === "arquero") {
          return {
            packageName,
            version: "8.0.0",
            dependencies: {
              "apache-arrow": "^15.0.2",
            },
          };
        }

        return {
          packageName,
          version: "0.6.17",
          dependencies: {
            d3: "^7.9.0",
            "apache-arrow": "^15.0.2",
          },
        };
      },
    );

    expect(resolved.imports).toEqual([
      {
        packageName: "apache-arrow",
        version: "^15.0.2",
        requiredByPackageNames: ["arquero", "plot"],
      },
      {
        packageName: "d3",
        version: "^7.9.0",
        requiredByPackageNames: ["plot"],
      },
    ]);
    expect(resolved.errors).toEqual([]);
  });
});
