import type { App, TFile } from "@lapis-notes/api";
import type { AppDatabaseNotebookState } from "@lapis-notes/api";
import { parseNotebookDocument } from "../parse/parse-notebook-document";

const assignments = new WeakMap<App, Map<string, Promise<string>>>();

export function normalizeNotebookId(value: unknown): string | undefined {
  return typeof value === "string" &&
    /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i.test(
      value,
    )
    ? value.toLowerCase()
    : undefined;
}

export function notebookStateKey(id: string): string {
  return `plugin:lapis-notebook:state:v1:${id}`;
}

export async function notebookIdentityHasOtherOwner(
  app: App,
  id: string,
  sourcePath: string,
  saved: AppDatabaseNotebookState,
): Promise<boolean> {
  if (saved.sourcePath === sourcePath) return false;
  const previousFile = app.vault.getFileByPath(saved.sourcePath);
  if (!previousFile) return false;
  const source = await app.vault.cachedRead(previousFile);
  return (
    parseNotebookDocument(source, { sourcePath: previousFile.path }).frontmatter
      ?.id === id
  );
}

/** Assign only while saving state; ordinary parsing/opening remains read-only. */
export async function ensureNotebookId(
  app: App,
  file: TFile,
  replaceId?: string,
): Promise<string> {
  let pending = assignments.get(app);
  if (!pending) assignments.set(app, (pending = new Map()));
  const path = file.path;
  const existing = pending.get(path);
  if (existing) return existing;
  const task = (async () => {
    let id: string | undefined;
    await app.fileManager.processFrontMatter(file, (frontmatter) => {
      const current = frontmatter.notebook;
      const notebook =
        current && typeof current === "object" && !Array.isArray(current)
          ? (current as Record<string, unknown>)
          : {};
      id = normalizeNotebookId(notebook.id);
      if (notebook.id != null && notebook.id !== "" && !id) {
        throw new Error(
          "Notebook id must be a UUID; the existing value was preserved.",
        );
      }
      if (id && id !== replaceId) return;
      id = crypto.randomUUID();
      frontmatter.notebook = { version: 1, ...notebook, id };
    });
    if (!id) throw new Error("Notebook UUID was not persisted.");
    return id;
  })();
  pending.set(path, task);
  try {
    return await task;
  } finally {
    if (pending.get(path) === task) pending.delete(path);
  }
}
