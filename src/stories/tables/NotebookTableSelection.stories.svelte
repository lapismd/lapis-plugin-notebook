<script module lang="ts">
  import { defineMeta } from "@storybook/addon-svelte-csf";
  import { expect, userEvent, within } from "storybook/test";
  import NotebookCanvasTable from "../../lib/render/table/NotebookCanvasTable.svelte";
  import Tables from "./NotebookTables.fixture.svelte";
  import Input from "./NotebookInputTable.fixture.svelte";
  const { Story } = defineMeta({
    title: "Plugins/Notebook/Table Selection",
    component: NotebookCanvasTable,
    tags: ["visual-pending"],
    parameters: { a11y: { test: "error" } },
  });
</script>

<Story
  name="Result row selection"
  play={async ({ canvasElement }) => {
    const c = within(canvasElement);
    const user = userEvent.setup();
    await user.click(await c.findByText("Grace 1", { exact: true }));
    await expect(
      c.getByRole("checkbox", { name: /^Select row 2$/ }),
    ).toBeChecked();
    await user.keyboard("{Control>}");
    await user.click(c.getByText("Ada 0", { exact: true }));
    await user.keyboard("{/Control}");
    await expect(
      c.getByRole("checkbox", { name: /^Select row 1$/ }),
    ).toBeChecked();
    await user.keyboard("{Shift>}");
    await user.click(c.getByText("Katherine 2", { exact: true }));
    await user.keyboard("{/Shift}");
    await expect(c.getAllByRole("checkbox", { checked: true })).toHaveLength(3);
    await user.click(c.getByRole("button", { name: /^Expand row 4$/ }));
    await expect(
      c.getByRole("checkbox", { name: /^Select row 4$/ }),
    ).not.toBeChecked();
    await expect(
      c.getByRole("grid").querySelector('[data-active="true"]'),
    ).toBeNull();
  }}>{#snippet template()}<Tables />{/snippet}</Story
>

<Story
  name="Rows without checkboxes"
  play={async ({ canvasElement }) => {
    const c = within(canvasElement);
    const user = userEvent.setup();
    await user.click(await c.findByText("Grace 1", { exact: true }));
    const grid = c.getByRole("grid");
    await expect(c.getByRole("row", { selected: true })).toHaveTextContent(
      "Grace 1",
    );
    await expect(c.queryAllByRole("checkbox")).toHaveLength(0);
    await user.click(c.getByRole("button", { name: "Sort name" }));
    await expect(c.getByRole("row", { selected: true })).toHaveTextContent(
      "Grace 1",
    );
    await expect(c.getByRole("grid")).toBe(grid);
  }}>{#snippet template()}<Tables simple />{/snippet}</Story
>

<Story
  name="Typed row clicks"
  play={async ({ canvasElement }) => {
    const c = within(canvasElement);
    const user = userEvent.setup();
    const grid = await c.findByRole("grid", {}, { timeout: 30000 });
    const cells = within(grid);
    await user.click(cells.getByText("Grace", { exact: true }));
    const host = canvasElement.querySelector(
      '[data-notebook-input-type="table"]',
    ) as HTMLElement & { value: { name: string; score: number }[] };
    const grace = host.value[0];
    await expect(grace).toEqual({ name: "Grace", score: 9 });
    await expect(c.getByLabelText("Selected input rows")).toHaveTextContent(
      /^Grace$/,
    );
    await expect(c.getByLabelText("Input events")).toHaveTextContent(/^1$/);
    await user.click(
      within(c.getByRole("grid")).getByText("Grace", { exact: true }),
    );
    await expect(c.getByLabelText("Input events")).toHaveTextContent(/^1$/);
    await user.keyboard("{Control>}");
    await user.click(
      within(c.getByRole("grid")).getByText("Ada", { exact: true }),
    );
    await user.keyboard("{/Control}");
    await expect(c.getByLabelText("Selected input rows")).toHaveTextContent(
      /^Grace, Ada$/,
    );
    await expect(host.value).toEqual([
      grace,
      expect.objectContaining({ name: "Ada", score: 7 }),
    ]);
    await expect(host.value[0]).toBe(grace);
    await expect(c.getByLabelText("Input events")).toHaveTextContent(/^2$/);
    await user.click(c.getByRole("button", { name: "Sort name" }));
    await expect(c.getByLabelText("Input events")).toHaveTextContent(/^2$/);
    await expect(c.getByRole("grid")).toBe(grid);
  }}>{#snippet template()}<Input />{/snippet}</Story
>

<Story
  name="Required single row clicks"
  play={async ({ canvasElement }) => {
    const c = within(canvasElement);
    const user = userEvent.setup();
    const grid = await c.findByRole("grid", {}, { timeout: 30000 });
    await user.click(within(grid).getByText("Ada", { exact: true }));
    await expect(c.getByLabelText("Input events")).toHaveTextContent(/^0$/);
    await user.click(
      within(c.getByRole("grid")).getByText("Grace", { exact: true }),
    );
    await expect(c.getByLabelText("Selected input rows")).toHaveTextContent(
      /^Grace$/,
    );
    await user.keyboard(" ");
    await expect(c.getByLabelText("Selected input rows")).toHaveTextContent(
      /^Grace$/,
    );
    await expect(c.getByLabelText("Input events")).toHaveTextContent(/^1$/);
  }}>{#snippet template()}<Input single required />{/snippet}</Story
>

<Story
  name="Disabled row clicks"
  play={async ({ canvasElement }) => {
    const c = within(canvasElement);
    const user = userEvent.setup();
    const grid = await c.findByRole("grid", {}, { timeout: 30000 });
    await user.click(within(grid).getByText("Grace", { exact: true }));
    await expect(c.getByLabelText("Selected input rows")).toHaveTextContent(
      /^Ada$/,
    );
    await expect(c.getByLabelText("Input events")).toHaveTextContent(/^0$/);
    await expect(
      c.getByRole("checkbox", { name: /^Select row 2$/ }),
    ).toBeDisabled();
  }}>{#snippet template()}<Input disabled />{/snippet}</Story
>
