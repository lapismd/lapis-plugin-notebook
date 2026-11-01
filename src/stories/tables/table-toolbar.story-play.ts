import { expect, userEvent, waitFor, within } from "storybook/test";

export async function assertColumnControls(canvasElement: HTMLElement) {
  const c = within(canvasElement);
  const body = within(canvasElement.ownerDocument.body);
  await userEvent.click(
    await c.findByRole("button", { name: "Settings", exact: true }),
  );
  const density = body.getByRole("group", { name: "Row density" });
  const defaultChoice = within(density).getByRole("radio", {
    name: "Default",
    exact: true,
  });
  await expect(defaultChoice).toHaveAttribute("aria-checked", "true");
  await userEvent.click(defaultChoice);
  await expect(defaultChoice).toHaveAttribute("aria-checked", "true");
  const rowHeight = () =>
    c.getAllByRole("gridcell")[0].getBoundingClientRect().height;
  const defaultHeight = rowHeight();
  await userEvent.click(
    within(density).getByRole("radio", { name: "Compact", exact: true }),
  );
  await waitFor(() => expect(rowHeight()).toBeLessThan(defaultHeight));
  await userEvent.keyboard("{ArrowRight}{ArrowRight}{Enter}");
  await expect(
    within(density).getByRole("radio", { name: "Relaxed", exact: true }),
  ).toHaveAttribute("aria-checked", "true");
  await waitFor(() => expect(rowHeight()).toBeGreaterThan(defaultHeight));
  await userEvent.keyboard("{Escape}");
  await expect(
    c.getByRole("button", { name: "Settings", exact: true }),
  ).toHaveFocus();

  await userEvent.click(
    c.getByRole("button", { name: "Columns", exact: true }),
  );
  const search = body.getByRole("combobox", { name: "Find columns" });
  await userEvent.type(search, "score");
  const visible = body.getByRole("checkbox", { name: "Show score" });
  await expect(visible).toBeChecked();
  await expect(getComputedStyle(visible.querySelector("svg")!).color).toBe(
    getComputedStyle(visible).color,
  );
  await expect(
    body.queryByRole("checkbox", { name: "Show enabled" }),
  ).not.toBeInTheDocument();
  await userEvent.click(visible);
  await expect(visible).not.toBeChecked();
  await expect(
    c.queryByRole("button", { name: "Open profile for score" }),
  ).not.toBeInTheDocument();
  await userEvent.click(search);
  await userEvent.keyboard("{ArrowDown}{Enter}");
  await expect(visible).toBeChecked();
  await expect(
    c.getByRole("button", { name: "Open profile for score" }),
  ).toBeVisible();
  await userEvent.keyboard("{Escape}");
  await expect(
    c.getByRole("button", { name: "Columns", exact: true }),
  ).toHaveFocus();
}
