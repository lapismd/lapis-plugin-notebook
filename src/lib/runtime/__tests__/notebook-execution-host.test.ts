import { expect, test, vi } from "vitest";
import {
  createNotebookExecutionHost,
  notebookInputHostContext,
} from "../notebook-execution-host";

test("vault input capabilities use listed vault-root paths independently of notebook folders", async () => {
  const file = {
    path: ".data/sample.json",
    name: "sample.json",
    stat: { size: 2, mtime: 10 },
  };
  const getFileByPath = vi.fn((path: string) =>
    path === file.path ? file : null,
  );
  const readBinary = vi.fn(async () => new Uint8Array([123, 125]).buffer);
  const app = {
    vault: { getFiles: () => [file], getFileByPath, readBinary },
  } as any;
  const context = notebookInputHostContext(
    createNotebookExecutionHost(app),
    "Notebooks/Example.notebook.md",
    "files",
  );
  expect(await context.files!.list()).toEqual([
    { path: file.path, name: file.name, size: 2, lastModified: 10 },
  ]);
  expect(readBinary).not.toHaveBeenCalled();
  await expect(context.files!.read(file.path)).resolves.toEqual(
    new Uint8Array([123, 125]).buffer,
  );
  expect(getFileByPath).toHaveBeenCalledWith(file.path);
});
