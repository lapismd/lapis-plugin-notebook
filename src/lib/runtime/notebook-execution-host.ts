import type { App } from "@lapis-notes/api";
import { resolveNotebookFilePath } from "@lapis-notes/notebook-stdlib";
import type {
  NotebookInputHostContext,
  NotebookVaultFile,
} from "@lapis-notes/notebook-input";
import type { NotebookFileReaderProvider } from "@lapis-notes/notebook-core";
import {
  collectAppTablesSnapshot,
  type NotebookAppTablesSnapshot,
} from "./duckdb/register-app-tables";

export interface NotebookExecutionHost {
  listVaultFiles?(): Promise<NotebookVaultFile[]>;
  reportInputError?(
    sourcePath: string | undefined,
    cellId: string | undefined,
    error: unknown,
  ): void;
  getAppTablesSnapshot(): Promise<NotebookAppTablesSnapshot>;
  readVaultFile(path: string, sourcePath?: string): Promise<ArrayBuffer>;
}

export interface NotebookExecutionHostOptions {
  onInputError?: NotebookExecutionHost["reportInputError"];
  fileReaderProvider?: NotebookFileReaderProvider;
}

export function createNotebookExecutionHost(
  app: App,
  options: NotebookExecutionHostOptions = {},
): NotebookExecutionHost {
  return {
    listVaultFiles: async () =>
      app.vault.getFiles().map((file) => ({
        path: file.path,
        name: file.name,
        size: file.stat.size,
        lastModified: file.stat.mtime,
      })),
    reportInputError: options.onInputError,
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
  return resolveNotebookFilePath(path, sourcePath);
}

export function notebookInputHostContext(
  host: NotebookExecutionHost,
  sourcePath?: string,
  cellId?: string,
  isActive?: () => boolean,
  signal?: AbortSignal,
): NotebookInputHostContext {
  return {
    files: host.listVaultFiles
      ? {
          list: () => host.listVaultFiles!(),
          // Chooser paths are vault-root references, including dot folders.
          read: (path) =>
            host.readVaultFile(`/${path.replace(/^\/+/, "")}`, sourcePath),
        }
      : undefined,
    onError: (error) => host.reportInputError?.(sourcePath, cellId, error),
    isActive,
    signal,
  };
}
