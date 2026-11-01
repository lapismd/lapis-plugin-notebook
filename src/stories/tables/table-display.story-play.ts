import { expect, userEvent, waitFor, within } from "storybook/test";

export async function assertTableDisplay(canvasElement: HTMLElement) {
  const c = within(canvasElement);
  const grid = await c.findByRole("grid", {}, { timeout: 30000 });
  const cell = within(grid).getAllByRole("gridcell")[0];
  const initialHeight = cell.getBoundingClientRect().height;
  const initialColour = getComputedStyle(cell).color;
  const header = within(grid).getAllByRole("columnheader")[0];
  const headerColour = getComputedStyle(header).backgroundColor;
  const wrap = c.getByRole("button", { name: "Wrap text", exact: true });
  const colours = c.getByRole("button", {
    name: "Column colours",
    exact: true,
  });
  await expect(wrap).toHaveAttribute("aria-pressed", "false");
  await userEvent.click(wrap);
  await expect(wrap).toHaveAttribute("aria-pressed", "true");
  await waitFor(() =>
    expect(cell.getBoundingClientRect().height).toBeGreaterThan(initialHeight),
  );
  await userEvent.click(colours);
  await expect(colours).toHaveAttribute("aria-pressed", "true");
  await waitFor(() =>
    expect(getComputedStyle(header).backgroundColor).not.toBe(headerColour),
  );
  await waitFor(() =>
    expect(getComputedStyle(cell).color).not.toBe(initialColour),
  );
  await userEvent.click(wrap);
  await userEvent.click(colours);
  await waitFor(() =>
    expect(cell.getBoundingClientRect().height).toBe(initialHeight),
  );
  await expect(getComputedStyle(cell).color).toBe(initialColour);
  const inputEvents = c.queryByLabelText("Input events");
  if (inputEvents) await expect(inputEvents).toHaveTextContent(/^0$/);
}

export async function assertFilterClearance(canvasElement: HTMLElement) {
  const c = within(canvasElement);
  const body = within(canvasElement.ownerDocument.body);
  for (const trigger of c.getAllByRole("button", {
    name: "Filters",
    exact: true,
  })) {
    await userEvent.click(trigger);
    const dialog = await body.findByRole("dialog", { name: "Table filters" });
    await waitFor(() => {
      const bounds = dialog.getBoundingClientRect();
      expect(bounds.left).toBeGreaterThanOrEqual(11);
      expect(bounds.right).toBeLessThanOrEqual(
        canvasElement.ownerDocument.documentElement.clientWidth - 11,
      );
    });
    await userEvent.keyboard("{Escape}");
    await expect(trigger).toHaveFocus();
  }
}
