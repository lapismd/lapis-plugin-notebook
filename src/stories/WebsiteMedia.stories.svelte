<script lang="ts" module>
import type { App } from "@lapis-notes/api";
import { defineMeta } from "@storybook/addon-svelte-csf";
import { expect, waitFor, within } from "storybook/test";
import PluginWorkspaceDemo from "./PluginWorkspaceDemo.svelte";
import { NOTEBOOK_FIXTURE_PATHS } from "./notebook-fixtures";
import { NOTEBOOK_PLUGIN_ID } from "../lib";
const { Story } = defineMeta({
  title: "Plugins/Notebook/Website media",
  component: PluginWorkspaceDemo,
  tags: ["website-media", "visual-pending", "!autodocs"],
  parameters: { layout: "fullscreen" },
  args: {
    notebookMode: "preview",
    notebookPath: NOTEBOOK_FIXTURE_PATHS.gettingStarted,
    displayMode: "desktop",
  },
});
async function run(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  await waitFor(
    () =>
      expect(canvas.getByTestId("plugin-workspace-status")).toHaveTextContent(
        "ready",
      ),
    { timeout: 10000 },
  );
  const root = canvas.getByTestId("plugin-workspace-demo") as HTMLElement & {
    __lapisApp?: App;
  };
  if (!root.__lapisApp) throw new Error("The source fixture has no owned App");
  await root.__lapisApp.commands.executeCommand(
    `${NOTEBOOK_PLUGIN_ID}:run-active-notebook`,
  );
  await waitFor(() =>
    expect(canvasElement.querySelector(".notebook-view")).not.toBeNull(),
  );
}

async function workspace({ canvasElement }: { canvasElement: HTMLElement }) {
  await run(canvasElement);
  await waitFor(() => expect(canvasElement.textContent).toContain("The answer is 42"), { timeout: 10000 });
}
async function inputs({ canvasElement }: { canvasElement: HTMLElement }) {
  await run(canvasElement);
  await waitFor(() => expect(canvasElement.querySelector('input[type="range"]')).not.toBeNull());
}
</script>
<Story name="Workspace" play={workspace} />
<Story name="Inputs" args={{ notebookPath: NOTEBOOK_FIXTURE_PATHS.interactiveInputs }} play={inputs} />
<Story name="Panels" args={{ panelGroupLayout: true }} play={workspace} />
