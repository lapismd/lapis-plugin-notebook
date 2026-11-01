export type NotebookTableRow = Record<string, unknown>;

export type NotebookTableData = NotebookTableRow[] & {
  columns?: string[];
};

export type NotebookTableSelection =
  | NotebookTableRow[]
  | NotebookTableRow
  | null;

export type NotebookTableSortDirection = "asc" | "desc";

export type NotebookTableSortState = {
  column: string;
  direction: NotebookTableSortDirection;
} | null;

export type NotebookTableOptions = Record<string, unknown> & {
  columns?: unknown;
  value?: unknown;
  multiple?: unknown;
  required?: unknown;
  select?: unknown;
  rows?: unknown;
  height?: unknown;
  maxHeight?: unknown;
  disabled?: unknown;
};

export function normalizeTableRows(data: unknown): NotebookTableData {
  if (!isIterable(data)) {
    throw new TypeError("Inputs.table expects an iterable of row objects.");
  }

  const rows = Array.from(data).map((row) => {
    if (!isNotebookTableRow(row)) {
      throw new TypeError("Inputs.table expects row values to be objects.");
    }
    return row;
  }) as NotebookTableData;

  const columns =
    data &&
    typeof data === "object" &&
    Array.isArray((data as { columns?: unknown }).columns)
      ? (data as unknown as { columns: unknown[] }).columns.filter(
          (column): column is string => typeof column === "string",
        )
      : undefined;
  if (columns && columns.length > 0) {
    rows.columns = columns;
  }

  return rows;
}

export function normalizeTableColumns(
  rows: NotebookTableData,
  columns: unknown,
): string[] {
  if (Array.isArray(columns)) {
    const normalizedColumns = columns.filter(
      (column): column is string => typeof column === "string",
    );
    if (normalizedColumns.length > 0) {
      return normalizedColumns;
    }
  }

  if (Array.isArray(rows.columns) && rows.columns.length > 0) {
    return [...rows.columns];
  }

  const inferred = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      inferred.add(key);
    }
  }
  return Array.from(inferred);
}

export function normalizeTableInputValue(
  rows: NotebookTableData,
  options: NotebookTableOptions,
): NotebookTableSelection {
  return normalizeTableSelection(rows, options.value, {
    multiple: options.multiple !== false,
    required: options.required !== false,
    select: options.select !== false,
  }).value;
}

export function normalizeTableSelection(
  rows: NotebookTableData,
  value: unknown,
  options: {
    multiple: boolean;
    required: boolean;
    select: boolean;
  },
): {
  indexes: Set<number>;
  value: NotebookTableSelection;
} {
  if (!options.select) {
    return {
      indexes: new Set(),
      value: [...rows],
    };
  }

  const requestedRows = Array.isArray(value)
    ? value.filter(isNotebookTableRow)
    : isNotebookTableRow(value)
      ? [value]
      : [];
  const matchedIndexes = new Set<number>();

  for (const requestedRow of requestedRows) {
    for (let index = 0; index < rows.length; index += 1) {
      if (matchedIndexes.has(index)) {
        continue;
      }
      if (areNotebookTableRowsEqual(rows[index], requestedRow)) {
        matchedIndexes.add(index);
        break;
      }
    }
  }

  if (matchedIndexes.size === 0 && options.required && rows.length > 0) {
    if (options.multiple) {
      rows.forEach((_row, index) => matchedIndexes.add(index));
    } else {
      matchedIndexes.add(0);
    }
  }

  if (!options.multiple && matchedIndexes.size > 1) {
    const firstIndex = Math.min(...matchedIndexes);
    matchedIndexes.clear();
    matchedIndexes.add(firstIndex);
  }

  return normalizeTableSelectionFromIndexes(rows, matchedIndexes, options);
}

export function normalizeTableSelectionFromIndexes(
  rows: NotebookTableData,
  indexes: Set<number>,
  options: {
    multiple: boolean;
    required: boolean;
    select: boolean;
  },
): {
  indexes: Set<number>;
  value: NotebookTableSelection;
} {
  const normalizedIndexes = new Set<number>();
  indexes.forEach((index) => {
    if (index >= 0 && index < rows.length) {
      normalizedIndexes.add(index);
    }
  });

  if (normalizedIndexes.size === 0 && options.required && rows.length > 0) {
    if (options.multiple) {
      rows.forEach((_row, index) => normalizedIndexes.add(index));
    } else {
      normalizedIndexes.add(0);
    }
  }

  if (!options.multiple && normalizedIndexes.size > 1) {
    const firstIndex = Math.min(...normalizedIndexes);
    normalizedIndexes.clear();
    normalizedIndexes.add(firstIndex);
  }

  if (options.multiple) {
    return {
      indexes: normalizedIndexes,
      value: Array.from(normalizedIndexes, (index) => rows[index]),
    };
  }

  const [firstIndex] = Array.from(normalizedIndexes);
  return {
    indexes: normalizedIndexes,
    value: firstIndex == null ? null : rows[firstIndex],
  };
}

function isNotebookTableRow(value: unknown): value is NotebookTableRow {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function areNotebookTableRowsEqual(
  left: NotebookTableRow,
  right: NotebookTableRow,
): boolean {
  if (left === right) {
    return true;
  }

  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}

function isIterable(value: unknown): value is Iterable<unknown> {
  return (
    value != null &&
    typeof (value as Iterable<unknown>)[Symbol.iterator] === "function"
  );
}
