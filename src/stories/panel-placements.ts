// Notebook-scaled adaptation of the family panel-placement harness: the six
// supported movable-panel surfaces built from the smallest real persisted
// workspace shell, mounting exactly one panel instance per story.
export type NotebookPanelKind = "inspector" | "dependencies" | "packages";

export type PanelDemoLayout =
  | "middle-top-tabs"
  | "stacked-tabs"
  | "left-sidebar"
  | "right-sidebar"
  | "bottom-panel"
  | "sidebar-group";

export const PANEL_DEMO_LAYOUTS: PanelDemoLayout[] = [
  "middle-top-tabs",
  "stacked-tabs",
  "left-sidebar",
  "right-sidebar",
  "bottom-panel",
  "sidebar-group",
];

export const PANEL_PLACEMENTS: Record<PanelDemoLayout, { name: string }> = {
  "middle-top-tabs": { name: "Middle (Top Tabs)" },
  "stacked-tabs": { name: "Stacked Tabs" },
  "left-sidebar": { name: "Left Sidebar" },
  "right-sidebar": { name: "Right Sidebar" },
  "bottom-panel": { name: "Bottom Panel" },
  "sidebar-group": { name: "Sidebar As a Group" },
};

export interface NotebookPanelMeta {
  viewType: string;
  title: string;
  icon: string;
  group: string;
  testId: string;
}

export const NOTEBOOK_PANEL_META: Record<NotebookPanelKind, NotebookPanelMeta> =
  {
    inspector: {
      viewType: "notebook-session",
      title: "Variables",
      icon: "variable",
      group: "Notebook",
      testId: "notebook-inspector-panel",
    },
    dependencies: {
      viewType: "notebook-dependencies",
      title: "Dependencies",
      icon: "workflow",
      group: "Notebook",
      testId: "notebook-dependencies-panel",
    },
    packages: {
      viewType: "notebook-packages",
      title: "Packages",
      icon: "package",
      group: "Notebook",
      testId: "notebook-packages-panel",
    },
  };

function leaf(
  id: string,
  title: string,
  icon: string,
  type: string,
  state: Record<string, unknown> = {},
) {
  return { id, type: "leaf", state: { type, state, icon, title } };
}

type DemoLeaf = ReturnType<typeof leaf>;

function sidebarGroup(
  id: string,
  name: string,
  icon: string,
  children: DemoLeaf[],
) {
  return {
    id,
    type: "sidebar-group",
    name,
    icon,
    children,
    collapsed: Object.fromEntries(children.map((child) => [child.id, false])),
    panelSizes: Object.fromEntries(children.map((child) => [child.id, 100])),
  };
}

type DemoTabItem = DemoLeaf | ReturnType<typeof sidebarGroup>;

function tabs(
  id: string,
  children: DemoTabItem[],
  options: { stacked?: boolean; currentTab?: number } = {},
) {
  return {
    id,
    type: "tabs",
    stacked: options.stacked ?? false,
    currentTab: options.currentTab ?? 0,
    children,
  };
}

function split(
  id: string,
  direction: "horizontal" | "vertical",
  children: ReturnType<typeof tabs>[],
  options: { width?: string; sizes?: number[] } = {},
) {
  return {
    id,
    type: "split",
    direction,
    sizes:
      options.sizes ?? children.map(() => 100 / Math.max(children.length, 1)),
    children,
    ...(options.width ? { width: options.width } : {}),
  };
}

function emptyDock(id: string) {
  return split(id, "vertical", [], { width: "0px" });
}

function emptyBottom() {
  return { ...tabs("bottom-panel", []), height: "0px" };
}

function emptyWorkspaceTabs(id = "main-empty-tabs") {
  return tabs(id, [leaf("main-empty", "Workspace", "file", "empty")]);
}

// The panel snapshots resolve through the ACTIVE leaf, so every placement
// keeps the seeded Getting Started notebook as the active document leaf —
// the panel-under-test is the subject, the notebook is required context.
export const PANEL_CONTEXT_LEAF_ID = "panel-context-notebook";

function notebookContextTabs(id = "main-document-tabs") {
  return tabs(id, [
    leaf(
      PANEL_CONTEXT_LEAF_ID,
      "Getting Started",
      "square-terminal",
      "notebook",
      { file: "Getting Started.notebook.md", mode: "source" },
    ),
  ]);
}

export function panelLayoutMarker(
  kind: NotebookPanelKind,
  layout: PanelDemoLayout,
): string {
  if (layout === "stacked-tabs") return "main-stacked-tabs";
  if (layout === "bottom-panel") return `${kind}-bottom-group`;
  if (layout === "sidebar-group") return `${kind}-sidebar-group`;
  return {
    "middle-top-tabs": "panel-middle",
    "left-sidebar": "panel-left",
    "right-sidebar": "panel-right",
  }[layout] as string;
}

export function createNotebookPanelDemoLayout(
  kind: NotebookPanelKind,
  layout: PanelDemoLayout,
): Record<string, unknown> {
  const meta = NOTEBOOK_PANEL_META[kind];
  const panel = (id: string) => leaf(id, meta.title, meta.icon, meta.viewType);

  if (layout === "middle-top-tabs") {
    return {
      main: split(
        "main",
        "vertical",
        [notebookContextTabs(), tabs("main-panel-tabs", [panel("panel-middle")])],
        { sizes: [35, 65] },
      ),
      left: emptyDock("left"),
      right: emptyDock("right"),
      bottom: emptyBottom(),
      floating: [],
      active: PANEL_CONTEXT_LEAF_ID,
    };
  }

  if (layout === "stacked-tabs") {
    return {
      main: split(
        "main",
        "vertical",
        [
          notebookContextTabs(),
          tabs(
            "main-stacked-tabs",
            [
              leaf("stacked-workspace", "Workspace", "layout-template", "empty"),
              panel("panel-stacked"),
              leaf("stacked-reference", "Reference", "book-open", "empty"),
            ],
            { stacked: true, currentTab: 1 },
          ),
        ],
        { sizes: [35, 65] },
      ),
      left: emptyDock("left"),
      right: emptyDock("right"),
      bottom: emptyBottom(),
      floating: [],
      active: PANEL_CONTEXT_LEAF_ID,
    };
  }

  if (layout === "left-sidebar") {
    return {
      main: split("main", "horizontal", [notebookContextTabs()]),
      left: split(
        "left",
        "vertical",
        [tabs("left-panel-tabs", [panel("panel-left")])],
        { width: "22rem" },
      ),
      right: emptyDock("right"),
      bottom: emptyBottom(),
      floating: [],
      active: PANEL_CONTEXT_LEAF_ID,
    };
  }

  if (layout === "right-sidebar") {
    return {
      main: split("main", "horizontal", [notebookContextTabs()]),
      left: emptyDock("left"),
      right: split(
        "right",
        "vertical",
        [tabs("right-panel-tabs", [panel("panel-right")])],
        { width: "22rem" },
      ),
      bottom: emptyBottom(),
      floating: [],
      active: PANEL_CONTEXT_LEAF_ID,
    };
  }

  if (layout === "bottom-panel") {
    return {
      main: split("main", "horizontal", [notebookContextTabs()]),
      left: emptyDock("left"),
      right: emptyDock("right"),
      bottom: {
        ...tabs("bottom-panel", [
          sidebarGroup(`${kind}-bottom-group`, meta.group, meta.icon, [
            panel("panel-bottom"),
          ]),
        ]),
        height: "22rem",
      },
      floating: [],
      active: PANEL_CONTEXT_LEAF_ID,
    };
  }

  return {
    main: split("main", "horizontal", [notebookContextTabs()]),
    left: emptyDock("left"),
    right: split(
      "right",
      "vertical",
      [
        tabs("right-panel-tabs", [
          sidebarGroup(`${kind}-sidebar-group`, meta.group, meta.icon, [
            panel("panel-grouped"),
          ]),
        ]),
      ],
      { width: "24rem" },
    ),
    bottom: emptyBottom(),
    floating: [],
    active: PANEL_CONTEXT_LEAF_ID,
  };
}
