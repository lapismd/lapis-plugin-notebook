import { describe, expect, test, vi } from "vitest";
import {
  deriveNotebookDependencyGlobalName,
  loadNotebookRuntimeDependency,
  loadReferencedNotebookDependencyGlobals,
  normalizeNotebookUserDependency,
  resolveRuntimeDependencySpecifier,
  sourceReferencesIdentifier,
  validateNotebookDependencyRegistry,
} from "..";

describe("notebook dependency registry contracts", () => {
  test("derives default global names from package names", () => {
    expect(deriveNotebookDependencyGlobalName("arquero")).toBe("arquero");
    expect(deriveNotebookDependencyGlobalName("lodash-es")).toBe("lodashEs");
    expect(deriveNotebookDependencyGlobalName("@observablehq/plot")).toBe(
      "plot",
    );
    expect(deriveNotebookDependencyGlobalName("@scope/data-tools")).toBe(
      "dataTools",
    );
  });

  test("normalizes descriptors with explicit or derived globals", () => {
    expect(
      normalizeNotebookUserDependency({
        packageName: " arquero ",
        version: " 8.0.0 ",
        globalName: " aq ",
      }),
    ).toMatchObject({
      packageName: "arquero",
      version: "8.0.0",
      globalName: "aq",
      requestedGlobalName: "aq",
    });

    expect(
      normalizeNotebookUserDependency({
        packageName: "@observablehq/plot",
        version: "0.6.17",
      }),
    ).toMatchObject({
      packageName: "@observablehq/plot",
      version: "0.6.17",
      globalName: "plot",
    });
  });

  test("validates pinned dependency globals and collisions", () => {
    expect(
      validateNotebookDependencyRegistry([
        { packageName: "arquero", version: "8.0.0", globalName: "aq" },
        { packageName: "lodash-es", version: "4.17.21" },
      ]),
    ).toMatchObject({ ok: true });

    const result = validateNotebookDependencyRegistry([
      { packageName: "", version: "1.0.0" },
      { packageName: "@observablehq/plot", version: "", globalName: "html" },
      { packageName: "arquero", version: "8.0.0", globalName: "aq" },
      { packageName: "another", version: "1.0.0", globalName: "aq" },
    ]);

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.reason)).toEqual([
      "missing-package",
      "invalid-global",
      "missing-version",
      "reserved-global",
      "duplicate-global",
    ]);
  });

  test("resolves runtime dependency specifiers and identifier references", () => {
    const dependency = normalizeNotebookUserDependency({
      packageName: "arquero",
      version: "8.0.0",
      globalName: "aq",
      resolver: { kind: "remote-esm", baseUrl: "https://esm.sh/" },
    });

    expect(resolveRuntimeDependencySpecifier(dependency)).toBe(
      "https://esm.sh/arquero@8.0.0",
    );
    expect(sourceReferencesIdentifier("const table = aq.from([]);", "aq")).toBe(
      true,
    );
    expect(sourceReferencesIdentifier("const table = a.join(q);", "aq")).toBe(
      false,
    );
  });

  test("loads referenced runtime dependency globals and caches module loads", async () => {
    const loadModule = vi.fn(async (specifier: string) => ({
      default: { specifier },
    }));
    const aq = normalizeNotebookUserDependency({
      packageName: "arquero",
      version: "8.0.0",
      globalName: "aq_runtime_test",
    });
    const lodash = normalizeNotebookUserDependency({
      packageName: "lodash-es",
      version: "4.17.21",
      globalName: "lodashRuntimeTest",
    });

    const first = await loadNotebookRuntimeDependency(aq, loadModule);
    const second = await loadNotebookRuntimeDependency(aq, loadModule);
    expect(first).toEqual({ specifier: "https://esm.sh/arquero@8.0.0" });
    expect(second).toEqual({ specifier: "https://esm.sh/arquero@8.0.0" });
    expect(loadModule).toHaveBeenCalledTimes(1);

    const globals = await loadReferencedNotebookDependencyGlobals(
      "const summary = aq_runtime_test.from([]);",
      [aq, lodash],
      async (dependency) => ({ loaded: dependency.globalName }),
    );
    expect(globals).toEqual([
      ["aq_runtime_test", { loaded: "aq_runtime_test" }],
    ]);
  });
});
