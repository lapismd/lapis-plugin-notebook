import { expect, within } from "storybook/test";

/** Header snippets must fit the shared viewport and paint visible charts. */
export async function assertTableHeaders(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const grid = await canvas.findByRole("grid");
  await expect(
    canvasElement.querySelector(".notebook-dataframe__toolbar"),
  ).not.toHaveTextContent(/\d+ rows/);
  await expect(grid).toHaveAttribute("data-ui-part", "scroll-area-viewport");
  const summaries = canvasElement.querySelectorAll<HTMLElement>(
    ".notebook-dataframe__summary-compact",
  );
  await expect(summaries.length).toBeGreaterThan(0);
  for (const summary of summaries) {
    const heading = summary.closest('[role="columnheader"]')!;
    const bounds = heading.getBoundingClientRect();
    const content = summary.getBoundingClientRect();
    await expect(
      content.bottom,
      "summary fits header height",
    ).toBeLessThanOrEqual(bounds.bottom + 1);
    await expect(
      content.right,
      "summary fits column width",
    ).toBeLessThanOrEqual(bounds.right + 1);
  }
  const bars = canvasElement.querySelectorAll<HTMLElement>(
    ".notebook-dataframe__summary-bar, .notebook-dataframe__summary-boolean-fill",
  );
  await expect(bars.length).toBeGreaterThan(0);
  for (const bar of bars) {
    await expect(getComputedStyle(bar).backgroundColor).not.toBe(
      "rgba(0, 0, 0, 0)",
    );
    await expect(bar.getBoundingClientRect().height).toBeGreaterThan(0);
  }
  const counts = canvasElement.querySelectorAll<HTMLElement>(
    ".notebook-dataframe__summary-boolean-count",
  );
  await expect(counts.length).toBeGreaterThan(0);
  for (const count of counts) {
    await expect(count).toBeVisible();
    await expect(
      count.closest(".notebook-dataframe__summary-boolean-fill"),
    ).toBeNull();
    await expect(getComputedStyle(count).opacity).toBe("1");
  }
}
