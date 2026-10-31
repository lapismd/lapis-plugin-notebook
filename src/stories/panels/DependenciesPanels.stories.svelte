<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import type { App } from "@lapis-notes/api";
  import { expect, userEvent, waitFor } from "storybook/test";

    import NotebookPanelDemo from "../NotebookPanelDemo.svelte";
  import type { PanelDemoLayout } from "../panel-placements";
  import {
    expectNotebookPanelPlacement,
    panelDemoApp,
    panelPlacementParameters,
    PANEL_DOCS_PARAMETERS,
  } from "../panel-story-helpers";

  const kind = "dependencies" as const;

  const { Story } = defineMeta({
    title: "Plugins/Notebook/Panels/Dependencies",
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
            "Dependencies shows the active notebook's cell DAG as a minimap or an interactive graph with persisted orientation and zoom settings.",
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

      // The defining interaction: switching from the minimap to the graph
      // surface through the panel's own tabs.
      await waitFor(
        () => {
          expect(panel.getByRole("button", { name: "Minimap" })).toBeTruthy();
          expect(panel.getByRole("button", { name: "Graph" })).toBeTruthy();
        },
        { timeout: 20_000 },
      );
      await userEvent.click(panel.getByRole("button", { name: "Graph" }));
      // The snapshot arrives through the async panel refresh chain (file-open
      // and layout-ready events), so the graph surface can lag the tab click.
      await waitFor(
        () => {
          expect(
            canvasElement.querySelector(".notebook-dependencies__graph"),
          ).toBeTruthy();
        },
        { timeout: 20_000 },
      );

      if (layout === "right-sidebar") {
        // The canonical placement also proves the persisted orientation
        // setting round-trips through plugin settings (LN-NB-009); the
        // wheel-zoom sensitivity setting shares the same persistence path
        // and is exposed in the settings tab.
        const plugin = app.plugins.plugins.get("lapis-notebook") as
          | { getSettings: () => { dependencyView: { graphOrientation: string } } }
          | undefined;
        await userEvent.click(
          panel.getByRole("button", { name: "Horizontal Tree" }),
        );
        await waitFor(
          () => {
            expect(plugin?.getSettings().dependencyView.graphOrientation).toBe(
              "horizontal",
            );
          },
          { timeout: 10_000 },
        );
      }
    };
  }
</script>

<Story
  name="Middle (Top Tabs)"
  args={{ kind, layout: "middle-top-tabs" }}
  parameters={panelPlacementParameters(
    kind,
    "middle-top-tabs",
    "Dependencies in the middle workspace as the sole mounted panel.",
  )}
  play={placementPlay("middle-top-tabs")}
/>

<Story
  name="Stacked Tabs"
  args={{ kind, layout: "stacked-tabs" }}
  parameters={panelPlacementParameters(
    kind,
    "stacked-tabs",
    "Dependencies selected inside the real stacked-tabs presentation.",
  )}
  play={placementPlay("stacked-tabs")}
/>

<Story
  name="Left Sidebar"
  args={{ kind, layout: "left-sidebar" }}
  parameters={panelPlacementParameters(
    kind,
    "left-sidebar",
    "Dependencies remains placement-independent in the left sidebar.",
  )}
  play={placementPlay("left-sidebar")}
/>

<Story
  name="Right Sidebar"
  args={{ kind, layout: "right-sidebar" }}
  parameters={panelPlacementParameters(
    kind,
    "right-sidebar",
    "Dependencies in its canonical right-sidebar placement.",
  )}
  play={placementPlay("right-sidebar")}
/>

<Story
  name="Bottom Panel"
  args={{ kind, layout: "bottom-panel" }}
  parameters={panelPlacementParameters(
    kind,
    "bottom-panel",
    "Dependencies inside the real grouped bottom panel.",
  )}
  play={placementPlay("bottom-panel")}
/>

<Story
  name="Sidebar As a Group"
  args={{ kind, layout: "sidebar-group" }}
  parameters={panelPlacementParameters(
    kind,
    "sidebar-group",
    "Dependencies inside a grouped right-sidebar item.",
  )}
  play={placementPlay("sidebar-group")}
/>
