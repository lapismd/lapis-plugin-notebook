import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
/** The same real-data assertions cover desktop and constrained shell layouts. */
export async function checkStructuredTableFilters(canvasElement: HTMLElement) {
  const body = within(canvasElement.ownerDocument.body);
  const viewer = canvasElement.querySelector<HTMLElement>(
    ".notebook-dataframe",
  )!;
  const c = within(viewer);
  const grid = () => c.getByRole("grid");
  const rows = async (present: string, absent?: string) =>
    waitFor(() => {
      expect(grid()).toHaveTextContent(present);
      if (absent) expect(grid()).not.toHaveTextContent(absent);
    });
  await userEvent.click(
    c.getByRole("button", { name: "Filters", exact: true }),
  );
  async function operator(field: string, label: string) {
    const trigger = body.getByRole("combobox", {
      name: field + " filter operator",
    });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.click(
      body.getByRole("option", { name: label, exact: true }),
    );
    await waitFor(() => expect(trigger).toHaveFocus());
  }
  async function field(name: string) {
    await userEvent.click(body.getByRole("button", { name: /^Filter field:/ }));
    await userEvent.type(
      body.getByRole("combobox", { name: "Find filter field" }),
      name,
    );
    await userEvent.click(body.getByRole("option", { name, exact: true }));
  }
  async function clear() {
    await userEvent.click(
      body.getByRole("button", { name: "Clear filters", exact: true }),
    );
    await rows("Ada");
    await rows("Grace");
    await rows("Katherine");
  }
  await operator("name", "starts with");
  await userEvent.type(
    body.getByRole("textbox", { name: "name filter value" }),
    "Ad",
  );
  await rows("Ada", "Grace");
  await operator("name", "matches regex");
  const text = body.getByRole("textbox", { name: "name filter value" });
  await userEvent.clear(text);
  await userEvent.type(text, "[[");
  await expect(body.getByRole("alert")).toHaveTextContent("regular expression");
  await rows("Ada", "Grace");
  await clear();
  await operator("name", "is not null");
  await rows("Grace");
  await clear();
  await field("score");
  await operator("score", "at least");
  await userEvent.type(
    body.getByRole("textbox", { name: "score filter value" }),
    "8",
  );
  await rows("Katherine", "Ada");
  await clear();
  await field("score");
  await operator("score", "at most");
  await userEvent.type(
    body.getByRole("textbox", { name: "score filter value" }),
    "8",
  );
  await rows("Ada", "Grace");
  await clear();
  await field("score");
  await operator("score", "between");
  await userEvent.type(
    body.getByRole("textbox", { name: "score lower bound" }),
    "8",
  );
  await userEvent.type(
    body.getByRole("textbox", { name: "score upper bound" }),
    "9",
  );
  await rows("Katherine", "Ada");
  await clear();
  await field("enabled");
  await userEvent.click(
    body.getByRole("checkbox", { name: "enabled filter value" }),
  );
  await rows("Grace", "Katherine");
  await clear();
  await field("created");
  await operator("created", "on or after");
  fireEvent.input(body.getByLabelText("created filter value"), {
    target: { value: "2026-03-01" },
  });
  await rows("Katherine", "Ada");
  await clear();
  await userEvent.keyboard("{Escape}");
  await waitFor(() =>
    expect(
      c.getByRole("button", { name: "Filters", exact: true }),
    ).toHaveFocus(),
  );
}
