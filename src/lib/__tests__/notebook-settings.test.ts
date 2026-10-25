import { describe, expect, test } from "vitest";
import {
  DEFAULT_NOTEBOOK_SETTINGS,
  mergeNotebookSettings,
  normalizeStoredNotebookRuntimeDependencies,
  patchNotebookSettings,
} from "../notebook-settings";

describe("notebook settings", () => {
  test("merges stored settings with defaults", () => {
    const settings = mergeNotebookSettings({
      dependencyView: {
        defaultTab: "graph",
      },
      panels: {
        autoOpenSourcesOnNotebookOpen: false,
      },
    });

    expect(settings).toEqual({
      dependencyView: {
        ...DEFAULT_NOTEBOOK_SETTINGS.dependencyView,
        defaultTab: "graph",
      },
      execution: DEFAULT_NOTEBOOK_SETTINGS.execution,
      panels: {
        ...DEFAULT_NOTEBOOK_SETTINGS.panels,
        autoOpenSourcesOnNotebookOpen: false,
      },
      runtimeDependencies: [],
    });
  });

  test("patches nested settings without dropping sibling values", () => {
    const settings = patchNotebookSettings(DEFAULT_NOTEBOOK_SETTINGS, {
      dependencyView: {
        graphOrientation: "horizontal",
      },
    });

    expect(settings.dependencyView.defaultTab).toBe("minimap");
    expect(settings.dependencyView.graphOrientation).toBe("horizontal");
    expect(settings.execution.autoRunStaleOnCellChange).toBe(false);
    expect(settings.panels.autoOpenSourcesOnNotebookOpen).toBe(true);
    expect(settings.runtimeDependencies).toEqual([]);
  });

  test("patches execution settings without dropping sibling values", () => {
    const settings = patchNotebookSettings(DEFAULT_NOTEBOOK_SETTINGS, {
      execution: {
        autoRunStaleOnCellChange: true,
      },
    });

    expect(settings.execution.autoRunStaleOnCellChange).toBe(true);
    expect(settings.dependencyView.defaultTab).toBe("minimap");
    expect(settings.panels.autoOpenSourcesOnNotebookOpen).toBe(true);
    expect(settings.runtimeDependencies).toEqual([]);
  });

  test("normalizes stored runtime dependency descriptors", () => {
    expect(
      normalizeStoredNotebookRuntimeDependencies([
        {
          packageName: "arquero",
          version: "8.0.0",
          globalName: "aq",
          resolver: { kind: "remote-esm", baseUrl: "https://esm.sh" },
        },
        { packageName: 123, version: null, resolver: { kind: "unknown" } },
        null,
      ]),
    ).toEqual([
      {
        packageName: "arquero",
        version: "8.0.0",
        globalName: "aq",
        resolver: { kind: "remote-esm", baseUrl: "https://esm.sh" },
      },
      { packageName: "", version: "" },
    ]);
  });

  test("patches runtime dependencies without dropping nested settings", () => {
    const settings = patchNotebookSettings(DEFAULT_NOTEBOOK_SETTINGS, {
      runtimeDependencies: [
        { packageName: "arquero", version: "8.0.0", globalName: "aq" },
      ],
    });

    expect(settings.runtimeDependencies).toEqual([
      { packageName: "arquero", version: "8.0.0", globalName: "aq" },
    ]);
    expect(settings.dependencyView.defaultTab).toBe("minimap");
    expect(settings.execution.autoRunStaleOnCellChange).toBe(false);
  });
});
