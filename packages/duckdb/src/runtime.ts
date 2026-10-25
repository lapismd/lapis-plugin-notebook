import type { DuckDbQueryResult, DuckDbQueryRow } from "./query";

export interface NotebookDuckDbRuntime {
  ensureAppTables(register: () => Promise<void>): Promise<void>;
  query(sql: string): Promise<DuckDbQueryRow[]>;
  queryWithMeta(sql: string): Promise<DuckDbQueryResult>;
  registerJsonTable(
    fileName: string,
    schema: string,
    table: string,
    rows: unknown[],
    columns?: NotebookDuckDbColumnDefinition[],
  ): Promise<void>;
  registerFileBuffer(
    alias: string,
    data: ArrayBuffer | Uint8Array,
  ): Promise<void>;
  registerVaultFile?(
    alias: string,
    resolvedPath: string,
    sourcePath?: string,
  ): Promise<void>;
}

export type NotebookDuckDbRuntimeProvider =
  | NotebookDuckDbRuntime
  | (() => Promise<NotebookDuckDbRuntime>);

export type NotebookDuckDbColumnDefinition = {
  name: string;
  type: string;
};

export interface NotebookDuckDbJsonTableSqlOptions {
  fileName: string;
  schema: string;
  table: string;
  hasRows: boolean;
  columns?: NotebookDuckDbColumnDefinition[];
}

export function createDuckDbSchemaSql(schema: string): string {
  return `CREATE SCHEMA IF NOT EXISTS ${schema}`;
}

export function createDuckDbJsonTableSql(
  options: NotebookDuckDbJsonTableSqlOptions,
): string {
  const tableRef = `${quoteDuckDbIdentifier(options.schema)}.${quoteDuckDbIdentifier(options.table)}`;
  if (!options.hasRows && options.columns && options.columns.length > 0) {
    return `CREATE OR REPLACE TABLE ${tableRef} (${options.columns
      .map((column) => `${quoteDuckDbIdentifier(column.name)} ${column.type}`)
      .join(", ")})`;
  }

  return `CREATE OR REPLACE TABLE ${tableRef} AS SELECT * FROM read_json_auto(${quoteDuckDbStringLiteral(options.fileName)})`;
}

function quoteDuckDbIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function quoteDuckDbStringLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}
