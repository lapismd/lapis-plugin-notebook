import { lookup } from "mrmime";
import {
  createNotebookFileAttachmentFromReader,
  type NotebookFileAttachment,
} from "@lapis-notes/notebook-stdlib";
import type {
  NotebookInputHostContext,
  NotebookVaultFile,
} from "./host-context";

export interface NotebookInputFile
  extends Omit<NotebookFileAttachment, "path"> {
  readonly source: "vault" | "upload";
  readonly path?: string;
  readonly type: string;
  readonly size: number;
  readonly lastModified: number;
}
export interface NotebookFileReference {
  __notebookFile: 1;
  source: "vault" | "upload";
  path?: string;
  name: string;
  type: string;
  size: number;
  lastModified: number;
  needsReselection?: boolean;
}
const files = new WeakSet<object>();
export const isNotebookInputFile = (
  value: unknown,
): value is NotebookInputFile =>
  Boolean(value && typeof value === "object" && files.has(value));
export const isNotebookFileReference = (
  value: unknown,
): value is NotebookFileReference =>
  Boolean(
    value &&
      typeof value === "object" &&
      (value as NotebookFileReference).__notebookFile === 1,
  );

export function fileMimeType(
  file: Pick<NotebookVaultFile, "name" | "type">,
): string {
  return file.type || lookup(file.name) || "application/octet-stream";
}
export function acceptsNotebookFile(
  file: Pick<NotebookVaultFile, "name" | "type">,
  accept?: string,
): boolean {
  if (!accept?.trim()) return true;
  const name = file.name.toLowerCase();
  const type = fileMimeType(file).toLowerCase();
  return accept.split(",").some((raw) => {
    const value = raw.trim().toLowerCase();
    return value.startsWith(".")
      ? name.endsWith(value)
      : value.endsWith("/*")
        ? type.startsWith(value.slice(0, -1))
        : type === value;
  });
}
export function vaultInputFile(
  file: NotebookVaultFile,
  context: NotebookInputHostContext,
): NotebookInputFile {
  const { path: _path, ...attachment } = createNotebookFileAttachmentFromReader(
    file.name,
    async () => {
      if (!context.files || context.isActive?.() === false)
        throw new Error("Notebook file access is no longer available");
      const bytes = await context.files.read(file.path);
      if (context.isActive?.() === false)
        throw new Error("Notebook file access is no longer available");
      return bytes;
    },
    file.path,
  );
  const value: NotebookInputFile = {
    ...attachment,
    ...file,
    source: "vault",
    type: fileMimeType(file),
  };
  const blob = attachment.blob;
  value.blob = (type = value.type) => blob(type);
  files.add(value);
  return value;
}
export function uploadedInputFile(file: File): NotebookInputFile {
  const { path: _path, ...attachment } = createNotebookFileAttachmentFromReader(
    file.name,
    () => file.arrayBuffer(),
  );
  const value: NotebookInputFile = {
    ...attachment,
    source: "upload",
    name: file.name,
    type: fileMimeType(file),
    size: file.size,
    lastModified: file.lastModified,
  };
  const blob = attachment.blob;
  value.blob = (type = value.type) => blob(type);
  files.add(value);
  return value;
}
export function snapshotNotebookFile(
  value: NotebookInputFile,
): NotebookFileReference {
  return {
    __notebookFile: 1,
    source: value.source,
    name: value.name,
    type: value.type,
    size: value.size,
    lastModified: value.lastModified,
    ...(value.source === "vault"
      ? { path: value.path }
      : { needsReselection: true }),
  };
}
export function hasTemporaryNotebookFiles(value: unknown): boolean {
  if (isNotebookFileReference(value) && value.needsReselection) return true;
  if (Array.isArray(value)) return value.some(hasTemporaryNotebookFiles);
  return Boolean(
    value &&
      typeof value === "object" &&
      Object.values(value).some(hasTemporaryNotebookFiles),
  );
}
