import {
  registerNotebookVaultFile,
  type NotebookDuckDbRuntime,
} from "@lapis-notes/notebook-duckdb";
import type { NotebookExecutionHost } from "../notebook-execution-host";

export async function registerVaultFile(
  service: NotebookDuckDbRuntime,
  host: NotebookExecutionHost,
  alias: string,
  path: string,
  sourcePath?: string,
): Promise<void> {
  await registerNotebookVaultFile(
    service,
    (targetPath, targetSourcePath) =>
      host.readVaultFile(targetPath, targetSourcePath),
    alias,
    path,
    sourcePath,
  );
}
