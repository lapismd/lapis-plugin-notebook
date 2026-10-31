import type { DataFrameRow, FilterState } from "../dataframe-types";

export function clientFilter(
  rows: readonly DataFrameRow[],
  filters: readonly FilterState[],
): DataFrameRow[] {
  if (!filters.length) {
    return [...rows];
  }

  return rows.filter((row) =>
    filters.every((filter) => matchesFilter(row[filter.column], filter)),
  );
}

function orderedValue(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}(?:$|[T ])/.test(value)) {
    return Date.parse(value);
  }
  return Number(value);
}

export function matchesFilter(value: unknown, filter: FilterState): boolean {
  if (filter.operator === "is_null") {
    return value == null;
  }
  if (filter.operator === "is_not_null") {
    return value != null;
  }
  if (value == null) {
    return false;
  }

  const raw = String(value);
  const normalized = raw.toLowerCase();
  const filterValue = filter.value;
  const normalizedFilter = String(filterValue ?? "").toLowerCase();

  switch (filter.operator) {
    case "contains":
      return normalized.includes(normalizedFilter);
    case "starts_with":
      return normalized.startsWith(normalizedFilter);
    case "ends_with":
      return normalized.endsWith(normalizedFilter);
    case "equals":
      return value === filterValue;
    case "regex":
      return new RegExp(String(filterValue ?? ""), "i").test(raw);
    case "gt":
      return orderedValue(value) > orderedValue(filterValue);
    case "gte":
      return orderedValue(value) >= orderedValue(filterValue);
    case "lt":
      return orderedValue(value) < orderedValue(filterValue);
    case "lte":
      return orderedValue(value) <= orderedValue(filterValue);
    case "between":
      return (
        orderedValue(value) >= orderedValue(filterValue) &&
        orderedValue(value) <= orderedValue(filter.valueTo)
      );
    default:
      return true;
  }
}
