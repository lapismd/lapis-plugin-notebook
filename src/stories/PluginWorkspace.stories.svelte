<script lang="ts" module>
  import type { App } from "@lapis-notes/api";
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, waitFor, within } from "storybook/test";

  import PluginWorkspaceDemo from "./PluginWorkspaceDemo.svelte";
  import {
    NotebookPlugin,
    NotebookView,
    NOTEBOOK_PLUGIN_ID,
  } from "../lib";
  import { NOTEBOOK_FIXTURE_PATHS } from "./notebook-fixtures";
  import { PluginWorkspaceExample } from "./PluginWorkspace.example-sources";

  const workspaceA11y = {
    test: "error",
    config: {
      rules: [
        // Full-shell rows intentionally compose nested workspace controls.
        { id: "nested-interactive", enabled: false },
        // CodeMirror owns its aria-hidden gutter focus behavior upstream.
        { id: "aria-hidden-focus", enabled: false },
      ],
    },
  } as const;

  const { Story } = defineMeta({
    title: "Plugins/Notebook/Shell",
    component: PluginWorkspaceDemo,
    tags: ["visual-pending", "test"],
    globals: {
      colorMode: "light",
      theme: "lapis",
    },
    parameters: {
      layout: "fullscreen",
      a11y: workspaceA11y,
      docs: {
        canvas: { className: "workspace-shell-docs-canvas" },
        source: {
          code: PluginWorkspaceExample,
          language: "svelte",
          type: "code",
        },
        story: { height: "700px", inline: false },
      },
    },
  });

  function storyApp(canvasElement: HTMLElement): App {
    const root = canvasElement.querySelector<
      HTMLElement & { __lapisApp?: App }
    >('[data-testid="plugin-workspace-demo"]');
    if (!root?.__lapisApp) {
      throw new Error("The plugin workspace story has no active Lapis app");
    }
    return root.__lapisApp;
  }

  async function waitForReady(canvasElement: HTMLElement) {
    const canvas = within(canvasElement);
    await waitFor(
      () => {
        expect(canvas.getByTestId("plugin-workspace-status")).toHaveTextContent(
          "ready",
        );
        expect(
          canvas
            .getByTestId("plugin-workspace-demo")
            .querySelector('[data-app-shell-ready="true"]'),
        ).toBeTruthy();
      },
      { timeout: 10_000 },
    );
    return canvas;
  }
</script>

<Story
  name="Workspace"
  render={() => ({
    Component: PluginWorkspaceDemo,
    props: { displayMode: "desktop" },
  })}
  play={async ({ canvasElement }) => {
    const canvas = await waitForReady(canvasElement);
    const app = storyApp(canvasElement);

    // The Notebook plugin loads and enables through the public host lifecycle.
    const notebookPlugin = app.plugins.plugins.get(NOTEBOOK_PLUGIN_ID);
    expect(notebookPlugin).toBeInstanceOf(NotebookPlugin);
    await waitFor(() => {
      expect(notebookPlugin?.state).toBe("enabled");
    });

    // The seeded vault keeps the executable notebook document identity.
    expect(
      app.vault.getFileByPath(NOTEBOOK_FIXTURE_PATHS.gettingStarted),
    ).toBeTruthy();
    expect(app.vault.getFileByPath(NOTEBOOK_FIXTURE_PATHS.welcome)).toBeTruthy();

    // The `.notebook.md` file-type association routes the seeded notebook
    // into the plugin-owned NotebookView (registerExtensions +
    // registerEditorView + registerView end-to-end through layout restore).
    await waitFor(() => {
      const activeView = app.workspace.activeLeaf?.view;
      expect(activeView).toBeInstanceOf(NotebookView);
      expect(activeView?.getViewType()).toBe("notebook");
    });

    // Stage 2 authoring commands are registered under the plugin id prefix.
    for (const commandId of [
      "enable-notebook-for-active-note",
      "create-demo-notebooks",
      "insert-notebook-code-cell",
      "insert-notebook-input-cell",
      "insert-notebook-sql-cell",
      "insert-notebook-markdown-cell",
    ]) {
      expect(
        app.commands.commands[`${NOTEBOOK_PLUGIN_ID}:${commandId}`],
        `missing command ${commandId}`,
      ).toBeTruthy();
    }

    // Settings initialized with the documented defaults through loadData.
    expect(notebookPlugin.getSettings().execution.autoRunStaleOnCellChange)
      .toBeTypeOf("boolean");

    // The shell renders the real public workspace chrome.
    expect(
      canvas
        .getByTestId("plugin-workspace-demo")
        .querySelector('[data-ui-component="lapis-workspace-shell"]'),
    ).toBeTruthy();

    const root = canvasElement.ownerDocument.documentElement;
    await waitFor(() => {
      expect(root).toHaveAttribute("data-ui-theme", "lapis");
      expect(root).not.toHaveClass("dark");
    });
  }}
/>
