import type {
  NotebookDuckDbColumnDefinition,
  NotebookDuckDbRuntime,
} from "./runtime";

export interface NotebookAppTablesSnapshot {
  notes: Array<Record<string, unknown>>;
  links: Array<Record<string, unknown>>;
  searchDocuments: unknown[];
}

export type NotebookAppTableRegistrar = Pick<
  NotebookDuckDbRuntime,
  "registerJsonTable"
>;

export const NOTEBOOK_APP_TABLE_COLUMNS: Record<
  keyof NotebookAppTablesSnapshot,
  NotebookDuckDbColumnDefinition[]
> = {
  notes: [
    { name: "path", type: "VARCHAR" },
    { name: "name", type: "VARCHAR" },
    { name: "extension", type: "VARCHAR" },
    { name: "size", type: "BIGINT" },
    { name: "ctime", type: "BIGINT" },
    { name: "mtime", type: "BIGINT" },
    { name: "tags", type: "VARCHAR[]" },
    { name: "frontmatter", type: "JSON" },
  ],
  links: [
    { name: "sourcePath", type: "VARCHAR" },
    { name: "targetText", type: "VARCHAR" },
    { name: "resolvedTargetPath", type: "VARCHAR" },
    { name: "count", type: "BIGINT" },
    { name: "kind", type: "VARCHAR" },
  ],
  searchDocuments: [
    { name: "path", type: "VARCHAR" },
    { name: "name", type: "VARCHAR" },
    { name: "extension", type: "VARCHAR" },
    { name: "checksum", type: "VARCHAR" },
    { name: "content", type: "VARCHAR" },
    { name: "tags", type: "VARCHAR[]" },
    { name: "tagParts", type: "VARCHAR[]" },
    { name: "tagHierarchy", type: "VARCHAR[]" },
    { name: "metadataText", type: "VARCHAR" },
  ],
};

export async function registerNotebookAppTablesSnapshot(
  service: NotebookAppTableRegistrar,
  snapshot: NotebookAppTablesSnapshot,
): Promise<void> {
  await service.registerJsonTable(
    "__lapis_notes.json",
    "lapis",
    "notes",
    snapshot.notes,
    NOTEBOOK_APP_TABLE_COLUMNS.notes,
  );
  await service.registerJsonTable(
    "__lapis_links.json",
    "lapis",
    "links",
    snapshot.links,
    NOTEBOOK_APP_TABLE_COLUMNS.links,
  );
  await service.registerJsonTable(
    "__lapis_search_documents.json",
    "lapis",
    "search_documents",
    snapshot.searchDocuments,
    NOTEBOOK_APP_TABLE_COLUMNS.searchDocuments,
  );
}
