import { expect, userEvent, within } from "storybook/test";

export async function assertBasicSort(canvasElement: HTMLElement) {
  const canvas = within(canvasElement);
  const interaction = userEvent.setup();
  const grids = await canvas.findAllByRole("grid", {}, { timeout: 30000 });
  const c = within(grids[0]);
  const name = c.getByRole("button", { name: "Sort name", exact: true });
  const score = c.getByRole("button", { name: "Sort score", exact: true });
  await expect(name.querySelector("svg")).toHaveClass(
    "lucide-chevrons-up-down",
  );
  await interaction.click(name);
  await expect(name.querySelector("svg")).toHaveClass(
    "lucide-arrow-up-narrow-wide",
  );
  await expect(name).toHaveAttribute("data-sort-direction", "asc");
  await interaction.click(name);
  await expect(name.querySelector("svg")).toHaveClass(
    "lucide-arrow-down-wide-narrow",
  );
  await interaction.click(name);
  await expect(name.querySelector("svg")).toHaveClass(
    "lucide-chevrons-up-down",
  );
  await interaction.click(name);
  await interaction.keyboard("{Shift>}");
  await interaction.click(score);
  await interaction.keyboard("{/Shift}");
  await expect(name).toHaveAttribute("data-sort-direction", "asc");
  await expect(score).toHaveAttribute("data-sort-direction", "asc");
  await expect(score).toHaveTextContent("2");
  await expect(score).toHaveAccessibleName("Sort score 2");
  await expect(score).toHaveAccessibleDescription(/Ascending, sort priority 2/);
  if (grids[1])
    await expect(
      within(grids[1]).getByRole("button", { name: "Sort name", exact: true }),
    ).toHaveAttribute("data-sort-direction", "none");
  const inputEvents = canvas.queryByLabelText("Input events");
  if (inputEvents) await expect(inputEvents).toHaveTextContent(/^0$/);
}
