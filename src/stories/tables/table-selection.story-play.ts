import { expect, userEvent, within } from "storybook/test";

export async function assertScrollingSelection(canvasElement: HTMLElement) {
  const c = within(canvasElement);
  const grid = await c.findByRole("grid");
  await userEvent.click(c.getByRole("checkbox", { name: /^Select row 6$/ }));
  const cell = grid.querySelector<HTMLElement>('[data-rich-row-id="5"]')!;
  const other = grid.querySelector<HTMLElement>('[data-rich-row-id="6"]')!;
  await expect(cell.closest('[role="row"]')).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(getComputedStyle(cell).backgroundImage).not.toBe(
    getComputedStyle(other).backgroundImage,
  );
  const initial = cell.getBoundingClientRect();
  const stop = (event: Event) => event.stopImmediatePropagation();
  grid.addEventListener("scroll", stop, { capture: true });
  try {
    for (const top of [24, 70, 100, 36, 0]) {
      grid.scrollTop = top;
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve()),
      );
      await expect(
        Math.abs(
          cell.getBoundingClientRect().top - initial.top + grid.scrollTop,
        ),
      ).toBeLessThan(1);
      await expect(getComputedStyle(cell).backgroundImage).not.toBe("none");
      await expect(cell.isConnected).toBe(true);
    }
  } finally {
    grid.removeEventListener("scroll", stop, { capture: true });
    grid.scrollTop = 0;
  }
  await expect(grid.querySelectorAll('[role="gridcell"]').length).toBeLessThan(
    300,
  );
  await expect(
    c.getByRole("checkbox", { name: /^Select row 6$/ }),
  ).toBeChecked();
}
