import type {
  NotebookChartLibrary,
  NotebookChartOutput,
  NotebookCodeOutput,
  NotebookDomOutput,
  NotebookErrorOutput,
  NotebookHtmlOutput,
  NotebookImageOutput,
  NotebookInputOutput,
  NotebookMarkdownOutput,
  NotebookTableColumnarData,
  NotebookTableOutput,
  NotebookTableRecord,
  NotebookTextOutput,
} from "@lapis-notes/notebook-core";

export function text(value: string): NotebookTextOutput {
  return {
    kind: "text",
    text: value,
  };
}

export function code(
  value: string,
  language = "plaintext",
  options: { title?: string } = {},
): NotebookCodeOutput {
  return {
    kind: "code",
    code: value,
    language,
    ...(options.title ? { title: options.title } : {}),
  };
}

export function markdown(value: string): NotebookMarkdownOutput {
  return {
    kind: "markdown",
    markdown: value,
  };
}

export function html(value: string): NotebookHtmlOutput {
  return {
    kind: "html",
    html: value,
  };
}

export function input(
  cellId: string,
  variableName: string,
  inputType: string,
  value: unknown,
  options: {
    label?: string;
    config?: Record<string, unknown>;
    reconstructable?: boolean;
    source?: NotebookInputOutput["source"];
  } = {},
): NotebookInputOutput {
  return {
    kind: "input",
    cellId,
    variableName,
    inputType,
    value,
    label: options.label,
    config: options.config,
    reconstructable: options.reconstructable ?? true,
    source: options.source,
  };
}

export function dom(
  outputId: string,
  cellId: string,
  options: { label?: string; role?: NotebookDomOutput["role"] } = {},
): NotebookDomOutput {
  return {
    kind: "dom",
    outputId,
    cellId,
    label: options.label,
    role: options.role ?? "dom",
    persist: false,
  };
}

export function table(
  data: readonly NotebookTableRecord[],
): NotebookTableOutput;
export function table(data: NotebookTableColumnarData): NotebookTableOutput;
export function table(
  columns: readonly string[],
  rows: readonly (readonly unknown[])[],
): NotebookTableOutput;
export function table(
  input:
    | readonly NotebookTableRecord[]
    | NotebookTableColumnarData
    | readonly string[],
  rows?: readonly (readonly unknown[])[],
): NotebookTableOutput {
  if (Array.isArray(input) && rows) {
    return fromColumnar({ columns: input, rows });
  }

  if (Array.isArray(input)) {
    if (input.some((value) => typeof value !== "object" || value === null)) {
      throw new TypeError(
        "lapis.table requires row data when called with a column list",
      );
    }

    return fromRecords(input);
  }

  if (!isColumnarData(input)) {
    throw new TypeError("lapis.table received an unsupported table payload");
  }

  return fromColumnar(input);
}

export function chart(
  library: NotebookChartLibrary,
  spec: unknown,
): NotebookChartOutput {
  return {
    kind: "chart",
    library,
    spec,
  };
}

export function image(mime: string, data: string): NotebookImageOutput {
  return {
    kind: "image",
    mime,
    data,
  };
}

export function error(
  message: string,
  options: { stack?: string } = {},
): NotebookErrorOutput {
  return {
    kind: "error",
    message,
    stack: options.stack,
  };
}

export const lapis = Object.freeze({
  code,
  text,
  markdown,
  html,
  input,
  dom,
  table,
  chart,
  image,
  error,
});

function fromColumnar(data: NotebookTableColumnarData): NotebookTableOutput {
  return {
    kind: "table",
    columns: [...data.columns],
    rows: data.rows.map((row) => [...row]),
    title: data.title,
    columnMeta: data.columnMeta ? [...data.columnMeta] : undefined,
    options: data.options,
    schema: data.schema,
  };
}

function fromRecords(
  records: readonly NotebookTableRecord[],
): NotebookTableOutput {
  const columns = getRecordColumns(records);

  return {
    kind: "table",
    columns,
    rows: records.map((record) => columns.map((column) => record[column])),
  };
}

function getRecordColumns(records: readonly NotebookTableRecord[]): string[] {
  const dsvColumns = (records as { columns?: unknown }).columns;
  if (
    Array.isArray(dsvColumns) &&
    dsvColumns.every((column) => typeof column === "string")
  ) {
    return [...dsvColumns];
  }

  return Array.from(
    records.reduce((set, record) => {
      Object.keys(record).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );
}

function isColumnarData(value: unknown): value is NotebookTableColumnarData {
  return (
    typeof value === "object" &&
    value !== null &&
    "columns" in value &&
    "rows" in value
  );
}
