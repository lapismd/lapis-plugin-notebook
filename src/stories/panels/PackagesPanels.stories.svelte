<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import type { App } from "@lapis-notes/api";
  import { expect, waitFor } from "storybook/test";

    import NotebookPanelDemo from "../NotebookPanelDemo.svelte";
  import type { PanelDemoLayout } from "../panel-placements";
  import {
    expectNotebookPanelPlacement,
    panelDemoApp,
    panelPlacementParameters,
    PANEL_DOCS_PARAMETERS,
  } from "../panel-story-helpers";

  const kind = "packages" as const;

  const { Story } = defineMeta({
    title: "Plugins/Notebook/Panels/Packages",
    component: NotebookPanelDemo,
    args: { kind, layout: "middle-top-tabs" as PanelDemoLayout },
    argTypes: {
      kind: { control: false, table: { disable: true } },
      layout: { control: false, table: { disable: true } },
    },
    tags: ["visual-pending", "test"],
    parameters: {
      layout: "fullscreen",
      a11y: {
        test: "error",
        // Test mode has no #storybook-root; scope the scan to the demo so the
        // Storybook docs-source chrome (highlight.js) stays out while all
        // panel content remains fully scanned.
        context: '[data-testid="panel-demo"]',
        config: {
          rules: [
            { id: "nested-interactive", enabled: false },
            { id: "aria-hidden-focus", enabled: false },
          ],
        },
      },
      docs: {
        ...PANEL_DOCS_PARAMETERS,
        description: {
          component:
            "Packages manages the notebook runtime dependency registry: npm search, install, pin, and uninstall through validated descriptors.",
        },
      },
    },
  });

  function placementPlay(layout: PanelDemoLayout) {
    return async ({ canvasElement }: { canvasElement: HTMLElement }) => {
      const panel = await expectNotebookPanelPlacement(
        canvasElement,
        kind,
        layout,
      );
      const app = panelDemoApp(canvasElement) as App;
      expect(app.plugins.plugins.get("lapis-notebook")).toBeTruthy();

      // The installed-packages filter is present in the panel chrome.
      await waitFor(
        () => {
          expect(panel.getByPlaceholderText("Filter packages")).toBeTruthy();
        },
        { timeout: 20_000 },
      );
    };
  }
</script>

<Story
  name="Middle (Top Tabs)"
  args={{ kind, layout: "middle-top-tabs" }}
  parameters={panelPlacementParameters(
    kind,
    "middle-top-tabs",
    "Packages in the middle workspace as the sole mounted panel.",
  )}
  play={placementPlay("middle-top-tabs")}
/>

<Story
  name="Stacked Tabs"
  args={{ kind, layout: "stacked-tabs" }}
  parameters={panelPlacementParameters(
    kind,
    "stacked-tabs",
    "Packages selected inside the real stacked-tabs presentation.",
  )}
  play={placementPlay("stacked-tabs")}
/>

<Story
  name="Left Sidebar"
  args={{ kind, layout: "left-sidebar" }}
  parameters={panelPlacementParameters(
    kind,
    "left-sidebar",
    "Packages remains placement-independent in the left sidebar.",
  )}
  play={placementPlay("left-sidebar")}
/>

<Story
  name="Right Sidebar"
  args={{ kind, layout: "right-sidebar" }}
  parameters={panelPlacementParameters(
    kind,
    "right-sidebar",
    "Packages in its canonical right-sidebar placement.",
  )}
  play={placementPlay("right-sidebar")}
/>

<Story
  name="Bottom Panel"
  args={{ kind, layout: "bottom-panel" }}
  parameters={panelPlacementParameters(
    kind,
    "bottom-panel",
    "Packages inside the real grouped bottom panel.",
  )}
  play={placementPlay("bottom-panel")}
/>

<Story
  name="Sidebar As a Group"
  args={{ kind, layout: "sidebar-group" }}
  parameters={panelPlacementParameters(
    kind,
    "sidebar-group",
    "Packages inside a grouped right-sidebar item.",
  )}
  play={placementPlay("sidebar-group")}
/>
