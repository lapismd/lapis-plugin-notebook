<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import {
    expect,
    fireEvent,
    userEvent,
    waitFor,
    within,
  } from "storybook/test";
  import DataFrameViewer from "../../lib/render/dataframe/DataFrameViewer.svelte";
  import Demo from "./NotebookTableLifecycle.fixture.svelte";
  const { Story } = defineMeta({
    title: "Plugins/Notebook/Table Lifecycle",
    component: DataFrameViewer,
    tags: ["visual-pending"],
    parameters: { a11y: { test: "error" } },
  });
</script>

<Story
  name="Sorting disabled"
  play={async ({ canvasElement }) => {
    const c = within(canvasElement);
    await expect(
      await c.findByRole("button", { name: /^Value unknown$/i }),
    ).toBeDisabled();
  }}>{#snippet template()}<Demo sortable={false} />{/snippet}</Story
>
<Story
  name="Stable result generation"
  play={async ({ canvasElement }) => {
    const c = within(canvasElement),
      body = within(canvasElement.ownerDocument.body);
    await userEvent.click(
      await c.findByRole("button", { name: /^Value unknown$/i }),
    );
    await userEvent.click(c.getByRole("checkbox", { name: /^Select row 1$/ }));
    await userEvent.click(
      c.getByRole("button", { name: "Filters", exact: true }),
    );
    await userEvent.type(
      body.getByRole("textbox", { name: "Value filter value" }),
      "10",
    );
    await userEvent.keyboard("{Escape}");
    const grid = c.getByRole("grid");
    grid.focus();
    await userEvent.keyboard("{ArrowDown}");
    fireEvent.click(c.getByRole("button", { name: "Update values" }));
    await waitFor(() =>
      expect(c.getByText("No rows match the active filters.")).toBeVisible(),
    );
    await expect(c.getByText("1 sort(s), 1 filter(s)")).toBeInTheDocument();
    await expect(c.getByRole("button", { name: /^Filters/ })).toHaveFocus();
    await userEvent.click(c.getByRole("button", { name: /^Filters/ }));
    await expect(
      body.getByRole("combobox", { name: "Value field type" }),
    ).toHaveTextContent("Auto · Number");
    await userEvent.keyboard("{Escape}");
    await userEvent.click(c.getByRole("button", { name: "Replace result" }));
    await waitFor(() =>
      expect(c.getByText("0 sort(s), 0 filter(s)")).toBeInTheDocument(),
    );
    await expect(
      c.getByRole("checkbox", { name: /^Select row 1$/ }),
    ).not.toBeChecked();
  }}>{#snippet template()}<Demo />{/snippet}</Story
>
