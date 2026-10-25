/**
 * Reactive execution signal keyed by notebook path and cell id. Cells depend on
 * their own signal so a reactive input update can wake only affected cells.
 */
let notebookRevisions = $state<Record<string, number>>({});
let cellRevisions = $state<Record<string, Record<string, number>>>({});

export function getNotebookExecutionRevision(sourcePath: string): number {
  return notebookRevisions[sourcePath] ?? 0;
}

export function getNotebookCellExecutionRevision(
  sourcePath: string,
  cellId: string,
): number {
  return cellRevisions[sourcePath]?.[cellId] ?? 0;
}

export function incrementNotebookExecutionRevision(sourcePath: string): void {
  notebookRevisions = {
    ...notebookRevisions,
    [sourcePath]: (notebookRevisions[sourcePath] ?? 0) + 1,
  };
}

export function incrementNotebookCellExecutionRevisions(
  sourcePath: string,
  cellIds: string[],
): void {
  const uniqueCellIds = Array.from(new Set(cellIds)).filter(Boolean);
  if (uniqueCellIds.length === 0) {
    return;
  }

  const current = cellRevisions[sourcePath] ?? {};
  const next = { ...current };
  for (const cellId of uniqueCellIds) {
    next[cellId] = (next[cellId] ?? 0) + 1;
  }
  cellRevisions = {
    ...cellRevisions,
    [sourcePath]: next,
  };
}
