import { expect, userEvent, within } from "storybook/test";

export function assertInputTableFrame(root: HTMLElement) {
  const frame = root.querySelector<HTMLElement>(
    "[data-notebook-canvas-table]",
  )!;
  expect(frame).toBeTruthy();
  expect(parseFloat(getComputedStyle(frame).borderTopWidth)).toBeGreaterThan(0);
  expect(
    parseFloat(getComputedStyle(frame).borderTopLeftRadius),
  ).toBeGreaterThan(0);
  return frame;
}

export async function assertInputTableViewport(
  root: HTMLElement,
  wide = false,
) {
  const grid = within(root).getByRole("grid");
  expect(getComputedStyle(grid).overflowX).toMatch(/^(auto|scroll)$/);
  expect(grid.getBoundingClientRect().right).toBeLessThanOrEqual(
    root.getBoundingClientRect().right + 1,
  );
  if (wide) {
    expect(grid.scrollWidth).toBeGreaterThan(grid.clientWidth);
    const previous = grid.scrollLeft;
    grid.scrollLeft = previous + 80;
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => resolve()),
    );
    expect(grid.scrollLeft).toBeGreaterThan(previous);
    grid.scrollLeft = previous;
  }
  return grid;
}

export async function assertInputSelectedRow(root: HTMLElement) {
  const c = within(root);
  await userEvent.click(c.getByRole("radio", { name: /^Select row 1$/ }));
  const row = c
    .getByRole("grid")
    .querySelector<HTMLElement>('[role="row"][aria-selected="true"]')!;
  expect(row).toBeTruthy();
  expect(row).toHaveAttribute("aria-selected", "true");
  const cell = row.querySelector<HTMLElement>('[role="gridcell"]')!;
  expect(getComputedStyle(cell).backgroundImage).not.toBe("none");
  expect(getComputedStyle(cell).backgroundColor).not.toBe(
    getComputedStyle(cell).borderBottomColor,
  );
}

export async function assertGuideTables(root: HTMLElement) {
  const catalog = root.querySelector<HTMLElement>(
    '[data-notebook-cell="sample-catalog"]',
  )!;
  const frame = assertInputTableFrame(catalog);
  const grid = await assertInputTableViewport(catalog);
  expect(grid.getBoundingClientRect().width).toBeGreaterThanOrEqual(
    frame.clientWidth - 2,
  );
  await assertInputTableViewport(
    root.querySelector<HTMLElement>('[data-notebook-cell="sample-preview"]')!,
    true,
  );
}
