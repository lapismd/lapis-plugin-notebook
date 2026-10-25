/**
 * Reactive selection signal keyed by notebook path. Selection is tracked at the
 * notebook-cell level so code and output surfaces for the same cell stay in
 * sync and selecting one cell clears selection from its siblings.
 */
let selectedCellIds = $state<Record<string, string | null>>({});

export function getSelectedNotebookCellId(sourcePath: string): string | null {
  return selectedCellIds[sourcePath] ?? null;
}

export function setSelectedNotebookCellId(
  sourcePath: string,
  cellId: string | null,
): void {
  selectedCellIds = {
    ...selectedCellIds,
    [sourcePath]: cellId,
  };
}
