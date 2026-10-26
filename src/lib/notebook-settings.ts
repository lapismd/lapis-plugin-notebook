import type {
  NotebookDependencyResolverDescriptor,
  NotebookUserDependencyDescriptor,
} from "@lapis-notes/notebook-stdlib";
import type { NotebookDependencyGraphOrientation } from "./dependencies/notebook-dependencies-graph";

export type { NotebookDependencyGraphOrientation };

export type NotebookDependencyViewTab = "minimap" | "graph";

export interface NotebookPluginSettings {
  dependencyView: {
    defaultTab: NotebookDependencyViewTab;
    graphOrientation: NotebookDependencyGraphOrientation;
    wheelZoomSensitivity: number;
  };
  execution: {
    autoRunStaleOnCellChange: boolean;
  };
  panels: {
    autoOpenSourcesOnNotebookOpen: boolean;
    autoOpenDependenciesOnNotebookOpen: boolean;
    openPanelGroupOnNotebookOpen: boolean;
  };
  runtimeDependencies: NotebookUserDependencyDescriptor[];
}

export type NotebookPluginSettingsPatch = {
  dependencyView?: Partial<NotebookPluginSettings["dependencyView"]>;
  execution?: Partial<NotebookPluginSettings["execution"]>;
  panels?: Partial<NotebookPluginSettings["panels"]>;
  runtimeDependencies?: NotebookUserDependencyDescriptor[];
};

export type StoredNotebookPluginSettings = {
  dependencyView?: Partial<NotebookPluginSettings["dependencyView"]>;
  execution?: Partial<NotebookPluginSettings["execution"]>;
  panels?: Partial<NotebookPluginSettings["panels"]>;
  runtimeDependencies?: unknown;
};

export const DEFAULT_NOTEBOOK_SETTINGS: NotebookPluginSettings = {
  dependencyView: {
    defaultTab: "minimap",
    graphOrientation: "vertical",
    wheelZoomSensitivity: 1,
  },
  execution: {
    autoRunStaleOnCellChange: false,
  },
  panels: {
    autoOpenSourcesOnNotebookOpen: true,
    autoOpenDependenciesOnNotebookOpen: false,
    openPanelGroupOnNotebookOpen: true,
  },
  runtimeDependencies: [],
};

export function mergeNotebookSettings(
  stored: StoredNotebookPluginSettings | null | undefined,
): NotebookPluginSettings {
  return {
    dependencyView: {
      ...DEFAULT_NOTEBOOK_SETTINGS.dependencyView,
      ...stored?.dependencyView,
    },
    execution: {
      ...DEFAULT_NOTEBOOK_SETTINGS.execution,
      ...stored?.execution,
    },
    panels: {
      ...DEFAULT_NOTEBOOK_SETTINGS.panels,
      ...stored?.panels,
    },
    runtimeDependencies: normalizeStoredNotebookRuntimeDependencies(
      stored?.runtimeDependencies,
    ),
  };
}

export function patchNotebookSettings(
  current: NotebookPluginSettings,
  patch: NotebookPluginSettingsPatch,
): NotebookPluginSettings {
  return mergeNotebookSettings({
    ...current,
    dependencyView: {
      ...current.dependencyView,
      ...patch.dependencyView,
    },
    execution: {
      ...current.execution,
      ...patch.execution,
    },
    panels: {
      ...current.panels,
      ...patch.panels,
    },
    runtimeDependencies:
      patch.runtimeDependencies ?? current.runtimeDependencies,
  });
}

export function normalizeStoredNotebookRuntimeDependencies(
  value: unknown,
): NotebookUserDependencyDescriptor[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === "object",
    )
    .map((entry) => {
      const dependency: NotebookUserDependencyDescriptor = {
        packageName:
          typeof entry.packageName === "string" ? entry.packageName : "",
        version: typeof entry.version === "string" ? entry.version : "",
      };

      if (typeof entry.globalName === "string") {
        dependency.globalName = entry.globalName;
      }

      const resolver = normalizeStoredNotebookDependencyResolver(
        entry.resolver,
      );
      if (resolver) {
        dependency.resolver = resolver;
      }

      return dependency;
    });
}

function normalizeStoredNotebookDependencyResolver(
  value: unknown,
): NotebookDependencyResolverDescriptor | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const entry = value as Record<string, unknown>;
  if (entry.kind !== "remote-esm" && entry.kind !== "host") {
    return undefined;
  }

  return {
    kind: entry.kind,
    ...(typeof entry.id === "string" ? { id: entry.id } : {}),
    ...(typeof entry.baseUrl === "string" ? { baseUrl: entry.baseUrl } : {}),
  };
}
