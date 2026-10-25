import type { App } from "@lapis-notes/api";
import {
  registerNotebookAppTablesSnapshot,
  type NotebookAppTablesSnapshot,
  type NotebookDuckDbRuntime,
} from "@lapis-notes/notebook-duckdb";

export type { NotebookAppTablesSnapshot } from "@lapis-notes/notebook-duckdb";

function normalizeFrontmatter(frontmatter: unknown): unknown {
  if (frontmatter == null) {
    return null;
  }

  return JSON.parse(JSON.stringify(frontmatter));
}

export async function collectAppTablesSnapshot(
  app: App,
): Promise<NotebookAppTablesSnapshot> {
  const notes = app.vault.getMarkdownFiles().map((file) => {
    const cache = app.metadataCache.getFileCache(file);
    return {
      path: file.path,
      name: file.baseName,
      extension: file.extension,
      size: file.stat.size,
      ctime: file.stat.ctime,
      mtime: file.stat.mtime,
      tags: (cache?.tags ?? []).map((tag) => tag.tag),
      frontmatter: normalizeFrontmatter(cache?.frontmatter),
    };
  });

  const links = [
    ...Object.entries(app.metadataCache.resolvedLinks).flatMap(
      ([sourcePath, targets]) =>
        Object.entries(targets).map(([resolvedTargetPath, count]) => ({
          sourcePath,
          targetText: resolvedTargetPath,
          resolvedTargetPath,
          count,
          kind: "resolved",
        })),
    ),
    ...Object.entries(app.metadataCache.unresolvedLinks).flatMap(
      ([sourcePath, targets]) =>
        Object.entries(targets).map(([targetText, count]) => ({
          sourcePath,
          targetText,
          resolvedTargetPath: null,
          count,
          kind: "unresolved",
        })),
    ),
  ];

  return {
    notes,
    links,
    searchDocuments: await app.appDatabase.listSearchDocuments(),
  };
}

export async function registerAppTables(
  service: NotebookDuckDbRuntime,
  app: App,
): Promise<void> {
  await registerAppTablesSnapshot(service, await collectAppTablesSnapshot(app));
}

export async function registerAppTablesSnapshot(
  service: NotebookDuckDbRuntime,
  snapshot: NotebookAppTablesSnapshot,
): Promise<void> {
  await registerNotebookAppTablesSnapshot(service, snapshot);
}
