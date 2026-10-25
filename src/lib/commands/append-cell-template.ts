import { Notice, type App, type TFile } from "@lapis-notes/api";
import {
  buildCellTemplate,
  labelForCellLanguage,
  type NotebookCellLanguage,
} from "../templates/cells";
import { getActiveNotebookFile } from "../notebook-file";

export type { NotebookCellLanguage } from "../templates/cells";

export async function appendCellTemplate(
  app: App,
  language: NotebookCellLanguage,
  file: TFile | null = getActiveNotebookFile(
    app,
    "Notebook cells can only be inserted into notebook notes",
  ),
): Promise<TFile | null> {
  if (!file) {
    return null;
  }

  const template = buildCellTemplate(language);

  await app.vault.process(file, (data) => appendNotebookBlock(data, template));

  new Notice(`Inserted notebook ${labelForCellLanguage(language)} cell`);
  return file;
}

function appendNotebookBlock(source: string, block: string): string {
  const content = source.trimEnd();
  if (!content) {
    return `${block}\n`;
  }

  return `${content}\n\n${block}\n`;
}
