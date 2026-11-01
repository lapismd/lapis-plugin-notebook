<script lang="ts" module>
  import type { App } from "@lapis-notes/api";
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, waitFor, within } from "storybook/test";
  import { workspaceA11y } from "./workspace-a11y";
  import PluginWorkspaceDemo from "./PluginWorkspaceDemo.svelte";
  import { researchNotebook, interactiveNotebook } from "./registry-fixtures";

  const { Story } = defineMeta({
    title: "Plugins/Notebook/Registry Screenshots",
    component: PluginWorkspaceDemo,
    tags: ["registry-media", "visual-pending", "test"],
    parameters: { layout: "fullscreen", a11y: workspaceA11y },
    args: { notebookMode: "preview" },
    beforeEach: () => {
      // Fix the fixture clock so execution summaries remain reproducible.
      // Native timers and the complete runtime warning guard remain active.
      const originalNow = Date.now;
      Date.now = () => 1_793_491_200_000;
      return () => { Date.now = originalNow; };
    },
  });

  async function showNotebook(canvasElement: HTMLElement, source: string, output: string) {
    const canvas = within(canvasElement);
    const root = await waitFor(() => {
      const element = canvas.getByTestId("plugin-workspace-demo") as HTMLElement & { __lapisApp?: App };
      expect(element).toHaveAttribute("data-status", "ready");
      expect(element.__lapisApp).toBeTruthy();
      return element;
    }, { timeout: 20_000 });
    const app = root.__lapisApp!;
    const file = await app.vault.create(`${output}.notebook.md`, source);
    await app.workspace.getUnpinnedLeaf().setViewState({ type: "notebook", state: { file: file.path, mode: "preview" } });
    await waitFor(() => expect(canvas.getByRole("heading", { name: output })).toBeVisible(), { timeout: 15_000 });
    await app.commands.executeCommand("lapis-notebook:run-active-notebook");
    await waitFor(() => {
      expect(canvasElement.querySelector('[data-notebook-cell="results"] .notebook-output')).not.toBeNull();
      expect(canvasElement.querySelector('[data-notebook-cell="results"]')?.textContent).toContain("North");
    }, { timeout: 30_000 });
  }
</script>

<Story name="Research notebook" play={async ({ canvasElement }) => {
  await showNotebook(canvasElement, researchNotebook, "From questions to evidence");
}} />

<Story name="Interactive analysis" play={async ({ canvasElement }) => {
  await showNotebook(canvasElement, interactiveNotebook, "Explore the next quarter");
  expect(within(canvasElement).getByRole("slider", { name: "Growth" })).toBeVisible();
}} />
