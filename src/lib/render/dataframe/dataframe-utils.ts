import type {
  ColumnSummary,
  DataFrameColumn,
  DataFrameColumnType,
  DataFrameRow,
  HistogramBucket,
  ValueCount,
} from "./dataframe-types";

const DEFAULT_SAMPLE_SIZE = 100;
const DEFAULT_HISTOGRAM_BUCKETS = 12;
const DEFAULT_TOP_VALUES_LIMIT = 10;
const ISO_DATE_PATTERN =
  /^\d{4}-\d{2}-\d{2}(?:[tT ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:[zZ]|[+-]\d{2}:?\d{2})?)?$/;

export function humanizeColumnName(key: string): string {
  const trimmed = key.trim();
  if (!trimmed) {
    return key;
  }

  return trimmed
    .replace(/[_-]+/g, " ")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .replace(/^./, (value) => value.toUpperCase());
}

export function normalizeColumnarRows(
  columns: readonly string[],
  rows: readonly (readonly unknown[])[],
): DataFrameRow[] {
  return rows.map((row) => {
    const normalizedRow: DataFrameRow = {};
    columns.forEach((column, index) => {
      normalizedRow[column] = row[index];
    });
    return normalizedRow;
  });
}

export function inferColumns(
  rows: readonly DataFrameRow[],
  sampleSize = DEFAULT_SAMPLE_SIZE,
): DataFrameColumn[] {
  const orderedKeys: string[] = [];
  const seenKeys = new Set<string>();
  const sample = rows.slice(0, sampleSize);

  for (const row of sample) {
    for (const key of Object.keys(row)) {
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        orderedKeys.push(key);
      }
    }
  }

  return orderedKeys.map((key) => {
    const values = sample.map((row) => row[key]);
    return {
      key,
      label: humanizeColumnName(key),
      type: inferColumnType(values),
      displayType: inferDisplayType(values),
      nullable: values.some((value) => value == null),
    } satisfies DataFrameColumn;
  });
}

export function inferDisplayType(values: readonly unknown[]): string {
  const type = inferColumnType(values);
  const nonNullValues = values.filter((value) => value != null);

  if (!nonNullValues.length) {
    return "null";
  }

  if (type === "number") {
    return nonNullValues.every(
      (value) => typeof value === "number" && Number.isInteger(value),
    )
      ? "i64"
      : "f64";
  }

  if (type === "string") {
    return "str";
  }

  if (type === "boolean") {
    return "bool";
  }

  if (type === "date") {
    return "datetime";
  }

  return type;
}

export function inferColumnType(
  values: readonly unknown[],
): DataFrameColumnType {
  const nonNullValues = values.filter((value) => value != null);
  if (!nonNullValues.length) {
    return "null";
  }

  if (
    nonNullValues.every(
      (value) => typeof value === "number" && Number.isFinite(value),
    )
  ) {
    return "number";
  }

  if (nonNullValues.every((value) => typeof value === "boolean")) {
    return "boolean";
  }

  if (
    nonNullValues.every(
      (value) => value instanceof Date || isIsoDateString(value),
    )
  ) {
    return "date";
  }

  if (
    nonNullValues.every((value) => Array.isArray(value) || isPlainObject(value))
  ) {
    return "json";
  }

  if (nonNullValues.every((value) => typeof value === "string")) {
    return "string";
  }

  return "unknown";
}

export function summarizeColumn(
  rows: readonly DataFrameRow[],
  column: DataFrameColumn,
): ColumnSummary {
  const label = column.label ?? humanizeColumnName(column.key);
  const values = rows.map((row) => row[column.key]);
  const nonNullValues = values.filter((value) => value != null);
  const type = column.type ?? inferColumnType(values);
  const distinctCount = countDistinctValues(nonNullValues);
  const base = {
    key: column.key,
    label,
    type,
    rowCount: rows.length,
    nonNullCount: nonNullValues.length,
    nullCount: rows.length - nonNullValues.length,
    distinctCount,
  };

  if (type === "number") {
    const numbers = nonNullValues.filter(
      (value): value is number =>
        typeof value === "number" && Number.isFinite(value),
    );
    const sorted = [...numbers].sort((left, right) => left - right);

    return {
      ...base,
      type,
      min: sorted[0] ?? null,
      max: sorted.at(-1) ?? null,
      mean: numbers.length
        ? numbers.reduce((sum, value) => sum + value, 0) / numbers.length
        : null,
      median: numbers.length ? median(sorted) : null,
      stddev: numbers.length > 1 ? standardDeviation(numbers) : null,
      histogram: buildNumberHistogram(numbers),
    };
  }

  if (type === "boolean") {
    const booleans = nonNullValues.filter(
      (value): value is boolean => typeof value === "boolean",
    );

    return {
      ...base,
      type,
      trueCount: booleans.filter(Boolean).length,
      falseCount: booleans.filter((value) => !value).length,
    };
  }

  if (type === "date") {
    const timestamps = nonNullValues
      .map(toTimestamp)
      .filter((value): value is number => value != null)
      .sort((left, right) => left - right);

    return {
      ...base,
      type,
      min: timestamps[0] == null ? null : new Date(timestamps[0]).toISOString(),
      max:
        timestamps.at(-1) == null
          ? null
          : new Date(timestamps.at(-1)!).toISOString(),
      histogram: buildNumberHistogram(timestamps),
    };
  }

  if (type === "string") {
    return {
      ...base,
      type,
      avgLength: nonNullValues.length
        ? nonNullValues.reduce<number>(
            (sum, value) => sum + String(value).length,
            0,
          ) / nonNullValues.length
        : null,
      topValues: topValues(nonNullValues),
    };
  }

  return {
    ...base,
    type,
  };
}

export function buildNumberHistogram(
  values: readonly number[],
  bucketCount = DEFAULT_HISTOGRAM_BUCKETS,
): HistogramBucket[] {
  if (!values.length) {
    return [];
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [{ start: min, end: max, count: values.length }];
  }

  const size = (max - min) / bucketCount;
  const buckets = Array.from(
    { length: bucketCount },
    (_, index) =>
      ({
        start: min + size * index,
        end: index === bucketCount - 1 ? max : min + size * (index + 1),
        count: 0,
      }) satisfies HistogramBucket,
  );

  for (const value of values) {
    const bucketIndex = Math.min(
      Math.floor((value - min) / size),
      buckets.length - 1,
    );
    buckets[bucketIndex].count += 1;
  }

  return buckets;
}

export function topValues(
  values: readonly unknown[],
  limit = DEFAULT_TOP_VALUES_LIMIT,
): ValueCount[] {
  const counts = new Map<string, number>();
  for (const value of values) {
    const key = valueToKey(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }
      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

function countDistinctValues(values: readonly unknown[]): number {
  return new Set(values.map((value) => valueToKey(value))).size;
}

function valueToKey(value: unknown): string {
  if (value == null) {
    return "null";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function median(values: readonly number[]): number {
  const middle = Math.floor(values.length / 2);
  if (values.length % 2 === 0) {
    return (values[middle - 1] + values[middle]) / 2;
  }
  return values[middle];
}

function standardDeviation(values: readonly number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function toTimestamp(value: unknown): number | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.getTime();
  }

  if (typeof value !== "string" || !isIsoDateString(value)) {
    return null;
  }

  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

function isIsoDateString(value: unknown): value is string {
  return (
    typeof value === "string" &&
    ISO_DATE_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
