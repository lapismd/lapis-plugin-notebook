export type NotebookOutputKind =
  | "code"
  | "text"
  | "markdown"
  | "html"
  | "input"
  | "dom"
  | "table"
  | "chart"
  | "image"
  | "error";

export type NotebookChartLibrary = "vega-lite" | "plot" | (string & {});

export type NotebookTableColumnType =
  | "string"
  | "number"
  | "date"
  | "boolean"
  | "json"
  | "null"
  | "unknown";

export type NotebookTableColumn = {
  key: string;
  label?: string;
  type?: NotebookTableColumnType;
  displayType?: string;
  nullable?: boolean;
};

export type NotebookTableOptions = {
  pageSize?: number;
  searchable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  downloadable?: boolean;
  showColumnSummaries?: boolean;
};

export type NotebookTableSchemaMeta = {
  rowCount?: number;
  truncated?: boolean;
  queryTimeMs?: number;
  sourceSql?: string;
};

export type NotebookTableRecord = Record<string, unknown>;

export type NotebookTableColumnarData = {
  columns: readonly string[];
  rows: readonly (readonly unknown[])[];
  title?: string;
  columnMeta?: NotebookTableColumn[];
  options?: NotebookTableOptions;
  schema?: NotebookTableSchemaMeta;
};

export type NotebookTextOutput = {
  kind: "text";
  text: string;
};

export type NotebookCodeOutput = {
  kind: "code";
  code: string;
  language: string;
  title?: string;
};

export type NotebookMarkdownOutput = {
  kind: "markdown";
  markdown: string;
};

export type NotebookHtmlOutput = {
  kind: "html";
  html: string;
};

export type NotebookInputOutputSource = {
  library?: string;
  factory: string;
  version?: string;
};

export type NotebookInputOutput = {
  kind: "input";
  cellId: string;
  variableName: string;
  inputType: string;
  value: unknown;
  label?: string;
  config?: Record<string, unknown>;
  reconstructable: boolean;
  source?: NotebookInputOutputSource;
};

export type NotebookDomOutput = {
  kind: "dom";
  outputId: string;
  cellId: string;
  label?: string;
  role: "input" | "html" | "svg" | "dom";
  persist?: false;
};

export type NotebookTableOutput = {
  kind: "table";
  columns: string[];
  rows: unknown[][];
  title?: string;
  columnMeta?: NotebookTableColumn[];
  options?: NotebookTableOptions;
  schema?: NotebookTableSchemaMeta;
};

export type NotebookChartOutput = {
  kind: "chart";
  library: NotebookChartLibrary;
  spec: unknown;
};

export type NotebookImageOutput = {
  kind: "image";
  mime: string;
  data: string;
};

export type NotebookErrorOutput = {
  kind: "error";
  message: string;
  stack?: string;
};

export type NotebookOutput =
  | NotebookCodeOutput
  | NotebookTextOutput
  | NotebookMarkdownOutput
  | NotebookHtmlOutput
  | NotebookInputOutput
  | NotebookDomOutput
  | NotebookTableOutput
  | NotebookChartOutput
  | NotebookImageOutput
  | NotebookErrorOutput;
