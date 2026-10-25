import { resolveNotebookFilePath } from "@lapis-notes/notebook-stdlib";
import type { NotebookDuckDbRuntime } from "./runtime";

export type NotebookVaultFileReader = (
  path: string,
  sourcePath?: string,
) => Promise<ArrayBuffer>;

export type NotebookVaultFileRegistrar = Pick<
  NotebookDuckDbRuntime,
  "registerFileBuffer" | "registerVaultFile"
>;

export async function registerNotebookVaultFile(
  service: NotebookVaultFileRegistrar,
  readVaultFile: NotebookVaultFileReader,
  alias: string,
  path: string,
  sourcePath?: string,
): Promise<void> {
  const resolvedPath = resolveNotebookVaultPath(path, sourcePath);
  if (service.registerVaultFile) {
    await service.registerVaultFile(alias, resolvedPath, sourcePath);
    return;
  }

  const buffer = await readVaultFile(resolvedPath, sourcePath);
  await service.registerFileBuffer(alias, buffer);
}

export function resolveNotebookVaultPath(
  path: string,
  sourcePath?: string,
): string {
  return resolveNotebookFilePath(path, sourcePath);
}
