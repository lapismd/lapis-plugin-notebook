import { Notice, type App, type TFile } from "@lapis-notes/api";

export const DEFAULT_NOTEBOOK_FRONTMATTER = Object.freeze({
  version: 1,
});

type EnsureNotebookFrontmatterOptions = {
  file?: TFile | null;
  notify?: boolean;
};

export function isMarkdownFile(file: TFile | null | undefined): file is TFile {
  if (!file) {
    return false;
  }

  const extension = file.extension.toLowerCase();
  return extension === "md" || extension === "markdown";
}

export function getActiveMarkdownFile(app: App, message: string): TFile | null {
  const file = app.workspace.getActiveFile();
  if (!isMarkdownFile(file)) {
    new Notice(message);
    return null;
  }

  return file;
}

export async function ensureNotebookFrontmatter(
  app: App,
  options: EnsureNotebookFrontmatterOptions = {},
): Promise<TFile | null> {
  const file =
    options.file ?? getActiveMarkdownFile(app, "Open a markdown note first");
  if (!file) {
    return null;
  }

  const cachedNotebook =
    app.metadataCache.getFileCache(file)?.frontmatter?.notebook;
  const alreadyEnabled = Boolean(
    cachedNotebook &&
      typeof cachedNotebook === "object" &&
      !Array.isArray(cachedNotebook),
  );

  await app.fileManager.processFrontMatter(file, (frontmatter) => {
    const current = frontmatter.notebook;
    if (current && typeof current === "object" && !Array.isArray(current)) {
      frontmatter.notebook = {
        ...DEFAULT_NOTEBOOK_FRONTMATTER,
        ...current,
      };
      return;
    }

    frontmatter.notebook = { ...DEFAULT_NOTEBOOK_FRONTMATTER };
  });

  if (options.notify !== false) {
    new Notice(
      alreadyEnabled
        ? "Notebook mode already enabled for active note"
        : "Enabled notebook mode for active note",
    );
  }

  return file;
}
