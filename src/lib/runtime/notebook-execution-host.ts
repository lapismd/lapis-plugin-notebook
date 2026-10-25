import { dirname, resolvePath, type App } from "@lapis-notes/api";
import type { NotebookFileReaderProvider } from "@lapis-notes/notebook-core";
import {
  collectAppTablesSnapshot,
  type NotebookAppTablesSnapshot,
} from "./duckdb/register-app-tables";

export interface NotebookExecutionHost {
  getAppTablesSnapshot(): Promise<NotebookAppTablesSnapshot>;
  readVaultFile(path: string, sourcePath?: string): Promise<ArrayBuffer>;
}

export interface NotebookExecutionHostOptions {
  fileReaderProvider?: NotebookFileReaderProvider;
}

export function createNotebookExecutionHost(
  app: App,
  options: NotebookExecutionHostOptions = {},
): NotebookExecutionHost {
  return {
    getAppTablesSnapshot: () => collectAppTablesSnapshot(app),
    async readVaultFile(
      path: string,
      sourcePath?: string,
    ): Promise<ArrayBuffer> {
      const resolvedPath = resolveVaultPath(path, sourcePath);
      if (options.fileReaderProvider) {
        return options.fileReaderProvider(resolvedPath, sourcePath);
      }

      const file = app.vault.getFileByPath(resolvedPath);
      if (!file) {
        throw new Error(`Notebook vault file not found: ${resolvedPath}`);
      }

      return app.vault.readBinary(file);
    },
  };
}

function resolveVaultPath(path: string, sourcePath?: string): string {
  if (path.startsWith("/")) {
    return path.replace(/^\/+/, "");
  }

  if (!sourcePath || !path.startsWith(".")) {
    return resolvePath(path);
  }

  return resolvePath(dirname(sourcePath), path);
}
