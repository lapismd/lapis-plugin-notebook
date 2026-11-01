<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, waitFor, within } from "storybook/test";
  import NotebookCanvasTable from "../../lib/render/table/NotebookCanvasTable.svelte";
  import Demo from "./NotebookInputTable.fixture.svelte";
  import { assertBasicSort } from "./table-sort.story-play";
  import { assertTableDisplay } from "./table-display.story-play";
  const { Story } = defineMeta({
    title: "Plugins/Notebook/Input Tables",
    component: NotebookCanvasTable,
    tags: ["visual-pending"],
    parameters: { a11y: { test: "error" } },
  });
</script>

<Story
  name="Typed multiple selection"
  play={async ({ canvasElement }) => {
    const c = within(canvasElement),
      body = within(canvasElement.ownerDocument.body);
    const row = await c.findByRole(
      "checkbox",
      {
        name: "Select row 2",
        exact: true,
      },
      { timeout: 30000 },
    );
    const grid = c.getByRole("grid");
    await userEvent.click(row);
    await expect(c.getByLabelText("Selected input rows")).toHaveTextContent(
      "Ada, Grace",
    );
    await expect(c.getByLabelText("Input events")).toHaveTextContent(/^1$/);
    await userEvent.click(c.getByRole("button", { name: "Sort name" }));
    await expect(c.getByLabelText("Input events")).toHaveTextContent(/^1$/);
    await userEvent.click(
      c.getByRole("button", { name: "Filters", exact: true }),
    );
    await userEvent.click(
      body.getByRole("combobox", { name: "name filter operator" }),
    );
    await userEvent.click(
      body.getByRole("option", { name: "contains", exact: true }),
    );
    await userEvent.type(
      body.getByRole("textbox", { name: "name filter value" }),
      "Grace",
    );
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(c.getByRole("button", { name: /Filters/ })).toHaveFocus(),
    );
    await waitFor(() =>
      expect(
        getComputedStyle(canvasElement.ownerDocument.body).pointerEvents,
      ).not.toBe("none"),
    );
    await expect(c.getByLabelText("Input events")).toHaveTextContent(/^1$/);
    await expect(c.getByLabelText("Selected input rows")).toHaveTextContent(
      "Ada, Grace",
    );
    await userEvent.click(c.getByRole("button", { name: "Replace selection" }));
    await expect(c.getByLabelText("Selected input rows")).toHaveTextContent(
      /^Katherine$/,
    );
    await expect(c.getByLabelText("Input events")).toHaveTextContent(/^1$/);
    await expect(c.getByRole("grid")).toBe(grid);
  }}>{#snippet template()}<Demo />{/snippet}</Story
>
<Story
  name="Optional single selection"
  play={async ({ canvasElement }) => {
    const c = within(canvasElement);
    const row = await c.findByRole(
      "radio",
      {
        name: "Select row 2",
        exact: true,
      },
      { timeout: 30000 },
    );
    await userEvent.click(row);
    await expect(c.getByLabelText("Selected input rows")).toHaveTextContent(
      /^Grace$/,
    );
    await userEvent.click(row);
    await expect(c.getByLabelText("Selected input rows")).toHaveTextContent(
      /^None$/,
    );
  }}>{#snippet template()}<Demo single />{/snippet}</Story
>
<Story
  name="Required single selection"
  play={async ({ canvasElement }) => {
    const c = within(canvasElement);
    const radio = await c.findByRole(
      "radio",
      { name: "Select row 1", exact: true },
      { timeout: 30000 },
    );
    await expect(radio).toBeChecked();
    await userEvent.click(radio);
    await expect(c.getByLabelText("Selected input rows")).toHaveTextContent(
      /^Ada$/,
    );
    await expect(c.getByLabelText("Input events")).toHaveTextContent(/^0$/);
  }}>{#snippet template()}<Demo single required />{/snippet}</Story
>
<Story
  name="Disabled selection"
  play={async ({ canvasElement }) => {
    const c = within(canvasElement);
    const checkbox = await c.findByRole(
      "checkbox",
      { name: "Select row 2", exact: true },
      { timeout: 30000 },
    );
    await expect(checkbox).toBeDisabled();
    await userEvent.click(checkbox);
    await expect(c.getByLabelText("Input events")).toHaveTextContent(/^0$/);
  }}>{#snippet template()}<Demo disabled />{/snippet}</Story
>

<Story
  name="Display controls"
  play={async ({ canvasElement }) => {
    await assertTableDisplay(canvasElement);
  }}
>
  {#snippet template()}<Demo />{/snippet}
</Story>

<Story
  name="Sort state"
  play={async ({ canvasElement }) => {
    await assertBasicSort(canvasElement);
  }}
>
  {#snippet template()}<Demo />{/snippet}
</Story>
