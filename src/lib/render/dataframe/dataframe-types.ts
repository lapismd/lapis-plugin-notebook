export type DataFrameValue = unknown;

export type DataFrameRow = Record<string, DataFrameValue>;

export type ColumnType =
  | "integer"
  | "bigint"
  | "float"
  | "double"
  | "decimal"
  | "varchar"
  | "text"
  | "boolean"
  | "date"
  | "timestamp"
  | "interval"
  | "json"
  | "list"
  | "struct"
  | "blob"
  | "string"
  | "number"
  | "null"
  | "unknown";

export type DataFrameColumnType = ColumnType;

export type Column = {
  name: string;
  type: ColumnType;
  nullable?: boolean;
  label?: string;
  displayType?: string;
};

export type DataFrameSchema = {
  columns: Column[];
  rowCount: number;
  truncated?: boolean;
  queryTimeMs?: number;
  sourceSql?: string;
};

export type SortDirection = "asc" | "desc";

export type SortState = {
  column: string;
  direction: SortDirection;
  priority: number;
};

export type FilterOperator =
  | "contains"
  | "starts_with"
  | "ends_with"
  | "equals"
  | "regex"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "between"
  | "is_null"
  | "is_not_null";

export type FilterState = {
  column: string;
  operator: FilterOperator;
  value?: unknown;
  valueTo?: unknown;
};

export type DataFrameColumn = {
  key: string;
  label?: string;
  type?: DataFrameColumnType;
  displayType?: string;
  nullable?: boolean;
};

export type DataFrameOptions = {
  pageSize?: number;
  searchable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  downloadable?: boolean;
  showColumnSummaries?: boolean;
};

export type DataFrameProps = {
  schema: DataFrameSchema;
  rows: DataFrameRow[];
  title?: string;
  options?: DataFrameOptions;
  onSort?: (sorts: SortState[]) => void;
  onFilter?: (filters: FilterState[]) => void;
  onExport?: (format: "csv" | "json" | "parquet") => void;
  onColumnClick?: (column: Column) => void;
  pageSize?: number;
  maxHeight?: string;
  loading?: boolean;
  error?: string;
};

export type HistogramBucket = {
  start: number;
  end: number;
  count: number;
};

export type ValueCount = {
  value: string;
  count: number;
};

type ColumnSummaryBase = {
  key: string;
  label: string;
  type: DataFrameColumnType;
  rowCount: number;
  nonNullCount: number;
  nullCount: number;
  distinctCount: number;
};

export type NumberColumnSummary = ColumnSummaryBase & {
  type: "number";
  min: number | null;
  max: number | null;
  mean: number | null;
  median: number | null;
  stddev: number | null;
  histogram: HistogramBucket[];
};

export type StringColumnSummary = ColumnSummaryBase & {
  type: "string";
  avgLength: number | null;
  topValues: ValueCount[];
};

export type BooleanColumnSummary = ColumnSummaryBase & {
  type: "boolean";
  trueCount: number;
  falseCount: number;
};

export type DateColumnSummary = ColumnSummaryBase & {
  type: "date";
  min: string | null;
  max: string | null;
  histogram: HistogramBucket[];
};

export type JsonColumnSummary = ColumnSummaryBase & {
  type: Exclude<DataFrameColumnType, "string" | "number" | "boolean" | "date">;
};

export type ColumnSummary =
  | NumberColumnSummary
  | StringColumnSummary
  | BooleanColumnSummary
  | DateColumnSummary
  | JsonColumnSummary;
