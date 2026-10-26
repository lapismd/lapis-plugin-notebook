import type { App } from "@lapis-notes/api";
import { expect, waitFor, within } from "storybook/test";

import {
  NOTEBOOK_PANEL_META,
  PANEL_PLACEMENTS,
  type NotebookPanelKind,
  type PanelDemoLayout,
} from "./panel-placements";

export const PANEL_DOCS_PARAMETERS = {
  canvas: { className: "workspace-shell-docs-canvas" },
  story: { height: "700px", inline: false },
};

export function panelDemoApp(canvasElement: HTMLElement): App {
  const root = canvasElement.querySelector<HTMLElement & { __lapisApp?: App }>(
    '[data-testid="panel-demo"]',
  );
  if (!root?.__lapisApp) {
    throw new Error("The panel demo story has no active Lapis app");
  }
  return root.__lapisApp;
}

export function panelPlacementSource(
  kind: NotebookPanelKind,
  layout: PanelDemoLayout,
): string {
  const meta = NOTEBOOK_PANEL_META[kind];
  return `<script lang="ts">
  import { onMount } from "svelte";
  import { App, installApplicationCompatibility, MemoryAppDatabase, MemoryVaultAdapter } from "@lapis-notes/api";
  import { NotebookPlugin } from "@lapis-notes/lapis-plugin-notebook";
  import { MarkdownPlugin } from "@lapis-notes/markdown";
  import { WorkspaceShell } from "@lapis-notes/workspace";

  // Placement: ${PANEL_PLACEMENTS[layout].name}. The persisted layout opens the
  // "${meta.viewType}" view in the ${layout} surface; every other dock stays
  // empty so the panel is the documented subject.
  const layout = notebookPanelLayout("${kind}", "${layout}");

  const app = new App({
    version: "1.0.0",
    configPath: ".lapis/app.json",
    adapter: new MemoryVaultAdapter({
      ".lapis/app.json": "{}",
      ".lapis/workspace.json": JSON.stringify(layout),
    }),
    appDatabase: new MemoryAppDatabase("notebook-panel-story"),
    markdownRenderer: async () => {},
  });
  const disposeApplicationCompatibility = installApplicationCompatibility(app);
  app.plugins.registerCorePlugins([
    { plugin: MarkdownPlugin, required: false, enabledByDefault: true },
    { plugin: NotebookPlugin, required: false, enabledByDefault: true,
      distribution: "first-party-external" },
  ]);

  let ready = false;
  onMount(() => void (async () => {
    await app.vault.load();
    await app.configuration.load();
    await app.plugins.loadPlugins({ communityPlugins: "disabled", optionalCorePlugins: "configured" });
    await app.metadataCache.load();
    await app.workspace.loadLayout();
    ready = true;
    return disposeApplicationCompatibility;
  })());
</script>

{#if ready}
  <WorkspaceShell {app} displayMode="desktop" workspaceLabel="Notebook" />
{/if}`;
}

export function panelPlacementParameters(
  kind: NotebookPanelKind,
  layout: PanelDemoLayout,
  description: string,
) {
  return {
    layout: "fullscreen" as const,
    docs: {
      ...PANEL_DOCS_PARAMETERS,
      description: { story: description },
      source: {
        code: panelPlacementSource(kind, layout),
        language: "svelte",
        type: "code" as const,
      },
    },
  };
}

export async function expectNotebookPanelPlacement(
  canvasElement: HTMLElement,
  kind: NotebookPanelKind,
  layout: PanelDemoLayout,
) {
  // svelte-csf carries kind/layout as control-disabled args (the family's
  // .ts-CSF render-prop purity assertion does not apply to this repo's
  // story format); each exported placement story fixes them at compile time.
  const meta = NOTEBOOK_PANEL_META[kind];
  const canvas = within(canvasElement);
  await waitFor(
    () => {
      expect(canvas.getByTestId("panel-demo-status")).toHaveTextContent(
        "ready",
      );
      expect(
        canvasElement.querySelector('[data-app-shell-ready="true"]'),
      ).not.toBeNull();
      expect(canvas.getAllByTestId(meta.testId)).toHaveLength(1);
    },
    { timeout: 20_000 },
  );

  await new Promise<void>((resolve) => {
    const storyWindow = canvasElement.ownerDocument.defaultView;
    if (storyWindow) storyWindow.setTimeout(resolve, 150);
    else resolve();
  });
  await waitFor(() => {
    expect(canvas.getAllByTestId(meta.testId)).toHaveLength(1);
  });

  const demo = canvas.getByTestId("panel-demo");
  const storyRoot = demo.closest("#storybook-root") as HTMLElement | null;
  const viewport = canvasElement.ownerDocument.documentElement;
  const demoBox = demo.getBoundingClientRect();
  await expect(
    Math.abs(demoBox.height - viewport.clientHeight),
    "Application fixture fills the browser viewport without relying on Storybook body classes",
  ).toBeLessThan(1);
  await expect(Math.abs(demoBox.width - viewport.clientWidth)).toBeLessThan(1);
  if (storyRoot) {
    const rootBox = storyRoot.getBoundingClientRect();
    await expect(Math.abs(demoBox.width - rootBox.width)).toBeLessThan(1);
    await expect(Math.abs(demoBox.height - rootBox.height)).toBeLessThan(1);
    await expect(
      Math.abs(rootBox.width - viewport.clientWidth),
    ).toBeLessThan(1);
    await expect(
      Math.abs(rootBox.height - viewport.clientHeight),
    ).toBeLessThan(1);
    await expect(getComputedStyle(storyRoot).padding).toBe("0px");
    await expect(getComputedStyle(storyRoot).overflow).toBe("hidden");
    await expect(
      getComputedStyle(canvasElement.ownerDocument.body).overflow,
    ).toBe("hidden");
  }
  await expect(getComputedStyle(demo).overflow).toBe("hidden");

  const panel = canvas.getByTestId(meta.testId);
  const expectedHost = {
    "middle-top-tabs": "workspace-tabs",
    "stacked-tabs": "workspace-stacked-tabs",
    "left-sidebar": "workspace-sidebar",
    "right-sidebar": "workspace-sidebar",
    "bottom-panel": "workspace-bottom-panel-group",
    "sidebar-group": "workspace-sidebar-group",
  }[layout];
  const host = panel.closest(
    `[data-ui-component="${expectedHost}"]`,
  ) as HTMLElement | null;
  await expect(host).not.toBeNull();

  const expectedSurface = {
    "middle-top-tabs": "body",
    "stacked-tabs": "body",
    "left-sidebar": "left-sidebar",
    "right-sidebar": "right-sidebar",
    "bottom-panel": "bottom-panel",
    "sidebar-group": "right-sidebar",
  }[layout];
  const surfaceHost = panel.closest(
    "[data-workspace-surface]",
  ) as HTMLElement | null;
  if (!surfaceHost) throw new Error(`Missing workspace surface for ${layout}`);
  await expect(surfaceHost).toHaveAttribute(
    "data-workspace-surface",
    expectedSurface,
  );

  const viewHost = panel.closest(
    '[data-ui-component="workspace-view-host"]',
  ) as HTMLElement | null;
  if (!viewHost) throw new Error(`Missing WorkspaceViewHost for ${layout}`);
  const storyWindow = canvasElement.ownerDocument.defaultView;
  if (!storyWindow) throw new Error("Missing Storybook preview window");
  const directSidebar = layout === "left-sidebar" || layout === "right-sidebar";
  const paintHost = directSidebar
    ? surfaceHost
    : (canvasElement.querySelector(
        '[data-workspace-surface="body"]',
      ) as HTMLElement | null);
  if (!paintHost) throw new Error(`Missing expected paint host for ${layout}`);
  const viewBackground = storyWindow.getComputedStyle(viewHost).backgroundColor;
  await expect(viewBackground).toBe(
    storyWindow.getComputedStyle(paintHost).backgroundColor,
  );
  // Notebook panel roots stay transparent; the WorkspaceViewHost owns paint.
  const panelBackground = storyWindow.getComputedStyle(panel).backgroundColor;
  await expect(panelBackground).toBe("rgba(0, 0, 0, 0)");

  if (directSidebar) {
    await expect(host).toHaveAttribute(
      "data-workspace-sidebar-side",
      layout === "left-sidebar" ? "left" : "right",
    );
  }
  if (layout === "bottom-panel" || layout === "sidebar-group") {
    const groupHeader = host?.querySelector<HTMLElement>(
      'button[data-ui-part="panel-header"]',
    );
    await expect(groupHeader).not.toBeNull();
    await expect(groupHeader).toBeVisible();
    await expect(groupHeader).toHaveAttribute("aria-expanded", "true");
  }

  return within(panel);
}
