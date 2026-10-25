export const NOTEBOOK_FILE_SUFFIX = ".notebook.md";

export function isNotebookFilePath(path: string | null | undefined): boolean {
  return (
    typeof path === "string" &&
    path.toLowerCase().endsWith(NOTEBOOK_FILE_SUFFIX)
  );
}

export function toNotebookFilePath(path: string): string {
  if (isNotebookFilePath(path)) {
    return path;
  }

  return path.replace(/\.(md|markdown)$/i, NOTEBOOK_FILE_SUFFIX);
}
