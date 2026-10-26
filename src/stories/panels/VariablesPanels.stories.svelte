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

  const kind = "inspector" as const;

  const { Meta, Story } = defineMeta({
    title: "Plugins/Notebook/Panels/Variables",
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
            "Variables lists the active notebook session's runtime values and the DuckDB catalog with lazy table previews.",
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

      // The variables panel exposes its variable/cell search once the active
      // notebook context is resolved.
      await waitFor(
        () => {
          expect(
            panel.getByPlaceholderText("Search variables or cell ids..."),
          ).toBeTruthy();
        },
        { timeout: 20_000 },
      );
    };
  }
</script>

<Meta />

<Story
  name="Middle (Top Tabs)"
  args={{ kind, layout: "middle-top-tabs" }}
  parameters={panelPlacementParameters(
    kind,
    "middle-top-tabs",
    "Variables in the middle workspace as the sole mounted panel.",
  )}
  play={placementPlay("middle-top-tabs")}
/>

<Story
  name="Stacked Tabs"
  args={{ kind, layout: "stacked-tabs" }}
  parameters={panelPlacementParameters(
    kind,
    "stacked-tabs",
    "Variables selected inside the real stacked-tabs presentation.",
  )}
  play={placementPlay("stacked-tabs")}
/>

<Story
  name="Left Sidebar"
  args={{ kind, layout: "left-sidebar" }}
  parameters={panelPlacementParameters(
    kind,
    "left-sidebar",
    "Variables remains placement-independent in the left sidebar.",
  )}
  play={placementPlay("left-sidebar")}
/>

<Story
  name="Right Sidebar"
  args={{ kind, layout: "right-sidebar" }}
  parameters={panelPlacementParameters(
    kind,
    "right-sidebar",
    "Variables in its canonical right-sidebar placement.",
  )}
  play={placementPlay("right-sidebar")}
/>

<Story
  name="Bottom Panel"
  args={{ kind, layout: "bottom-panel" }}
  parameters={panelPlacementParameters(
    kind,
    "bottom-panel",
    "Variables inside the real grouped bottom panel.",
  )}
  play={placementPlay("bottom-panel")}
/>

<Story
  name="Sidebar As a Group"
  args={{ kind, layout: "sidebar-group" }}
  parameters={panelPlacementParameters(
    kind,
    "sidebar-group",
    "Variables inside a grouped right-sidebar item.",
  )}
  play={placementPlay("sidebar-group")}
/>
