<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import DataFrameViewer from "../../lib/render/dataframe/DataFrameViewer.svelte";
  import Demo from "./NotebookTables.fixture.svelte";
  import { assertTableHeaders } from "./table-header.story-play";
  import { assertBasicSort } from "./table-sort.story-play";
  import {
    assertTableDisplay,
    assertFilterClearance,
  } from "./table-display.story-play";
  import { assertColumnControls } from "./table-toolbar.story-play";
  const { Story } = defineMeta({
    title: "Plugins/Notebook/Tables",
    component: DataFrameViewer,
    tags: ["visual-pending"],
    parameters: { layout: "fullscreen", a11y: { test: "error" } },
  });
</script>

<Story
  name="Results and structured filters"
  play={async ({ canvasElement }) => {
    const c = within(canvasElement),
      body = within(canvasElement.ownerDocument.body);
    await expect(await c.findByRole("grid")).toBeVisible();
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
      "Ada",
    );
    await userEvent.keyboard("{Escape}");
    await expect(c.getByRole("grid")).toHaveTextContent("Ada");
    await expect(c.getByRole("grid")).not.toHaveTextContent("Grace");
    await userEvent.click(
      c.getByRole("checkbox", { name: "Select all filtered rows" }),
    );
    await expect(
      c.getByRole("checkbox", { name: "Select row 1", exact: true }),
    ).toBeChecked();
  }}>{#snippet template()}<Demo />{/snippet}</Story
>
<Story
  name="Rich cells and expanded rows"
  play={async ({ canvasElement }) => {
    await assertTableHeaders(canvasElement);
    const c = within(canvasElement);
    const expand = (
      await c.findAllByRole("button", { name: /^Expand row / })
    )[0];
    await expect(expand.querySelector("svg")).toHaveClass(
      "lucide-chevron-right",
    );
    await expect(expand).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(expand);
    const collapse = c.getByRole("button", { name: /^Collapse row / });
    await expect(collapse.querySelector("svg")).toHaveClass(
      "lucide-chevron-down",
    );
    await expect(collapse).toHaveAttribute("aria-expanded", "true");
    await expect(c.getByText("name", { selector: "dt" })).toBeVisible();
    collapse.focus();
    await userEvent.keyboard("{Enter}");
    await expect(expand).toHaveAttribute("aria-expanded", "false");
    await expect(expand.querySelector("svg")).toHaveClass(
      "lucide-chevron-right",
    );
    await expect(
      c.queryByText("name", { selector: "dt" }),
    ).not.toBeInTheDocument();
  }}>{#snippet template()}<Demo />{/snippet}</Story
>
<Story name="Large typed results"
  >{#snippet template()}<Demo large />{/snippet}</Story
>
<Story name="Inspector sample"
  >{#snippet template()}<Demo preview />{/snippet}</Story
>
<Story
  name="Independent tables"
  play={async ({ canvasElement }) => {
    await assertFilterClearance(canvasElement);
    await assertBasicSort(canvasElement);
  }}
  >{#snippet template()}<Demo simple /><Demo
      simple
      setup={false}
    />{/snippet}</Story
>

<Story
  name="Column controls"
  play={async ({ canvasElement }) => {
    await assertColumnControls(canvasElement);
  }}
>
  {#snippet template()}<Demo />{/snippet}
</Story>

<Story
  name="Display controls"
  play={async ({ canvasElement }) => {
    await assertTableDisplay(canvasElement);
  }}
>
  {#snippet template()}<Demo longText />{/snippet}
</Story>
