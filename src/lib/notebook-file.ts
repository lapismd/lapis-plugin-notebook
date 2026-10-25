import { Notice, type App, type TFile } from "@lapis-notes/api";
import { isNotebookFilePath, toNotebookFilePath } from "./notebook-path";

export function isMarkdownFile(file: TFile | null | undefined): file is TFile {
  if (!file) {
    return false;
  }

  const extension = file.extension.toLowerCase();
  return extension === "md" || extension === "markdown";
}

export function isNotebookFile(file: TFile | null | undefined): file is TFile {
  return !!file && isNotebookFilePath(file.path);
}

export function getActiveNotebookFile(app: App, message: string): TFile | null {
  const file = app.workspace.getActiveFile();
  if (!isNotebookFile(file)) {
    new Notice(message);
    return null;
  }

  return file;
}

export { isNotebookFilePath, toNotebookFilePath };
