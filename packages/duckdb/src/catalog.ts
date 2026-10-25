import type { DuckDbQueryRow } from "./query";

export type NotebookDuckDbCatalogColumn = {
  name: string;
  dataType: string;
  nullable: boolean;
};

export type NotebookDuckDbCatalogTable = {
  name: string;
  type: "table" | "view";
  rowCount: number | null;
  columns: NotebookDuckDbCatalogColumn[];
};

export type NotebookDuckDbCatalogSchema = {
  name: string;
  tables: NotebookDuckDbCatalogTable[];
};

export type NotebookDuckDbCatalog = {
  schemas: NotebookDuckDbCatalogSchema[];
};

export type NotebookDuckDbTablePreview = {
  columns: string[];
  rows: DuckDbQueryRow[];
};

export interface CreateNotebookDuckDbTablePreviewOptions {
  rows: DuckDbQueryRow[];
  columns?: string[];
}

export type NotebookDuckDbTableRowCountProvider = (
  schemaName: string,
  tableName: string,
) => number | null | Promise<number | null>;

export interface CreateNotebookDuckDbCatalogOptions {
  tables: DuckDbQueryRow[];
  columns: DuckDbQueryRow[];
  getRowCount?: NotebookDuckDbTableRowCountProvider;
}

export async function createNotebookDuckDbCatalog(
  options: CreateNotebookDuckDbCatalogOptions,
): Promise<NotebookDuckDbCatalog> {
  const schemaMap = new Map<string, NotebookDuckDbCatalogSchema>();

  for (const tableRow of options.tables) {
    const schemaName = String(tableRow.schema_name ?? "main");
    const schema = schemaMap.get(schemaName) ?? {
      name: schemaName,
      tables: [],
    };
    schemaMap.set(schemaName, schema);
    schema.tables.push({
      name: String(tableRow.table_name ?? "table"),
      type: normalizeDuckDbTableType(tableRow.table_type),
      rowCount: null,
      columns: [],
    });
  }

  const tableIndex = new Map<string, NotebookDuckDbCatalogTable>();
  for (const schema of schemaMap.values()) {
    for (const table of schema.tables) {
      tableIndex.set(`${schema.name}.${table.name}`, table);
    }
  }

  for (const columnRow of options.columns) {
    const schemaName = String(columnRow.schema_name ?? "main");
    const tableName = String(columnRow.table_name ?? "table");
    const table = tableIndex.get(`${schemaName}.${tableName}`);
    if (!table) {
      continue;
    }
    table.columns.push({
      name: String(columnRow.column_name ?? "column"),
      dataType: String(columnRow.data_type ?? "unknown"),
      nullable: String(columnRow.is_nullable ?? "YES").toUpperCase() === "YES",
    });
  }

  if (options.getRowCount) {
    await Promise.all(
      Array.from(schemaMap.values()).flatMap((schema) =>
        schema.tables.map(async (table) => {
          table.rowCount = await options.getRowCount!(schema.name, table.name);
        }),
      ),
    );
  }

  return {
    schemas: Array.from(schemaMap.values()),
  };
}

export function createNotebookDuckDbTablePreview(
  options: CreateNotebookDuckDbTablePreviewOptions,
): NotebookDuckDbTablePreview {
  const columns = options.columns ?? [];
  return {
    columns:
      columns.length > 0
        ? columns
        : options.rows.length > 0
          ? Object.keys(options.rows[0])
          : [],
    rows: options.rows,
  };
}

export function createDuckDbCatalogTablesSql(): string {
  return `SELECT table_schema AS schema_name, table_name, table_type
         FROM information_schema.tables
         WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
         ORDER BY table_schema, table_name`;
}

export function createDuckDbCatalogColumnsSql(): string {
  return `SELECT table_schema AS schema_name, table_name, column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema NOT IN ('information_schema', 'pg_catalog')
         ORDER BY table_schema, table_name, ordinal_position`;
}

export function createDuckDbTablePreviewSql(
  schemaName: string,
  tableName: string,
  limit: number = 5,
): string {
  return `SELECT * FROM ${quoteDuckDbIdentifier(schemaName)}.${quoteDuckDbIdentifier(tableName)} LIMIT ${normalizeDuckDbPreviewLimit(limit)}`;
}

export function createDuckDbTableRowCountSql(
  schemaName: string,
  tableName: string,
): string {
  return `SELECT COUNT(*) AS row_count FROM ${quoteDuckDbIdentifier(schemaName)}.${quoteDuckDbIdentifier(tableName)}`;
}

export function normalizeDuckDbPreviewLimit(limit: number): number {
  return Math.max(1, Math.floor(limit));
}

export function normalizeDuckDbRowCount(rows: DuckDbQueryRow[]): number | null {
  const value = rows[0]?.row_count;
  return typeof value === "number"
    ? value
    : Number.isFinite(Number(value))
      ? Number(value)
      : null;
}

export function normalizeDuckDbTableType(value: unknown): "table" | "view" {
  return String(value ?? "BASE TABLE")
    .toUpperCase()
    .includes("VIEW")
    ? "view"
    : "table";
}

export function quoteDuckDbIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}
