import type { App } from "@lapis-notes/api";

import { bootPluginWorkspaceDemo } from "./create-plugin-workspace-demo";
import {
  createNotebookPanelDemoLayout,
  type NotebookPanelKind,
  type PanelDemoLayout,
} from "./panel-placements";

/**
 * Boots the smallest real persisted workspace shell for one panel placement:
 * the standard notebook demo App with the placement layout override, so the
 * story exercises the same view registration, imperative mount, grouping,
 * and surface styling paths as the application.
 */
export async function bootPanelPlacementDemo(
  kind: NotebookPanelKind,
  layout: PanelDemoLayout,
): Promise<{ app: App; dispose: () => Promise<void> }> {
  return bootPluginWorkspaceDemo(
    "preview",
    undefined,
    createNotebookPanelDemoLayout(kind, layout),
  );
}
