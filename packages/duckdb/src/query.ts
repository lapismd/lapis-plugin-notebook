import type {
  NotebookTableColumn,
  NotebookTableSchemaMeta,
} from "@lapis-notes/notebook-core/outputs";

export type DuckDbQueryRow = Record<string, unknown>;

export type DuckDbQueryResult = {
  rows: DuckDbQueryRow[];
  columns: string[];
  columnMeta: NotebookTableColumn[];
  schema: NotebookTableSchemaMeta;
};

export type DuckDbMappedType =
  | "integer"
  | "bigint"
  | "float"
  | "double"
  | "decimal"
  | "number"
  | "varchar"
  | "text"
  | "string"
  | "date"
  | "timestamp"
  | "boolean"
  | "json"
  | "list"
  | "struct"
  | "null"
  | "interval"
  | "blob"
  | "unknown";

export const DUCKDB_TYPE_MAP: Record<string, DuckDbMappedType> = {
  INTEGER: "integer",
  INT: "integer",
  INT2: "integer",
  INT16: "integer",
  INT4: "integer",
  INT32: "integer",
  UINT8: "integer",
  UINT16: "integer",
  UINT32: "integer",
  BIGINT: "bigint",
  INT8: "bigint",
  INT64: "bigint",
  UINT64: "bigint",
  HUGEINT: "bigint",
  FLOAT: "float",
  FLOAT4: "float",
  FLOAT16: "float",
  FLOAT32: "float",
  DOUBLE: "double",
  FLOAT8: "double",
  FLOAT64: "double",
  DECIMAL: "decimal",
  NUMERIC: "decimal",
  VARCHAR: "varchar",
  TEXT: "text",
  STRING: "varchar",
  UTF8: "varchar",
  LARGEUTF8: "text",
  BOOLEAN: "boolean",
  BOOL: "boolean",
  DATE: "date",
  DATEDAY: "date",
  DATEMILLISECOND: "date",
  TIMESTAMP: "timestamp",
  "TIMESTAMP WITH TIME ZONE": "timestamp",
  TIMESTAMPTZ: "timestamp",
  INTERVAL: "interval",
  JSON: "json",
  BLOB: "blob",
  BINARY: "blob",
  LARGEBINARY: "blob",
  BYTEA: "blob",
  LIST: "list",
  FIXEDSIZELIST: "list",
  STRUCT: "struct",
  MAP: "struct",
};

export function mapDuckDBType(raw: string): DuckDbMappedType {
  const upper = raw.toUpperCase().split(/[<(]/)[0].trim();
  return DUCKDB_TYPE_MAP[upper] ?? "unknown";
}

export function normalizeDuckDbRows(rows: unknown[]): DuckDbQueryRow[] {
  return rows.map((row) =>
    typeof row === "object" && row !== null
      ? { ...(row as DuckDbQueryRow) }
      : { value: row },
  );
}

export function normalizeDuckDbQueryResult(
  result: {
    toArray: () => unknown[];
    schema?: {
      fields?: Array<{
        name?: string;
        type?: { toString?: () => string } | string | null;
      }>;
    } | null;
    numRows?: number;
  },
  sql: string,
  startedAt: number,
): DuckDbQueryResult {
  const rows = normalizeDuckDbRows(result.toArray());
  const fields = result.schema?.fields ?? [];
  const columns = fields.length
    ? fields.map((field) => field.name ?? "value")
    : rows.length
      ? Object.keys(rows[0])
      : [];

  const metadataFields: Array<{
    name?: string;
    type?: { toString?: () => string } | string | null;
  }> = fields.length ? fields : columns.map((name) => ({ name, type: null }));

  const columnMeta = metadataFields.map((field) => {
    const rawType =
      typeof field.type === "string"
        ? field.type
        : typeof field.type?.toString === "function"
          ? field.type.toString()
          : "unknown";
    const mappedType = mapDuckDBType(rawType);

    return {
      key: field.name ?? "value",
      label: field.name ?? "value",
      type: toNotebookTableColumnType(mappedType),
      displayType: rawType,
      nullable: true,
    } satisfies NotebookTableColumn;
  });

  return {
    rows,
    columns,
    columnMeta,
    schema: {
      rowCount: result.numRows ?? rows.length,
      queryTimeMs: Math.max(0, Math.round(performance.now() - startedAt)),
      sourceSql: sql,
    },
  };
}

function toNotebookTableColumnType(
  rawType: DuckDbMappedType,
): NotebookTableColumn["type"] {
  switch (rawType) {
    case "integer":
    case "bigint":
    case "float":
    case "double":
    case "decimal":
    case "number":
      return "number";
    case "varchar":
    case "text":
    case "string":
      return "string";
    case "date":
    case "timestamp":
      return "date";
    case "boolean":
      return "boolean";
    case "json":
    case "list":
    case "struct":
      return "json";
    case "null":
      return "null";
    default:
      return "unknown";
  }
}
