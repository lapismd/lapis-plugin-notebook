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
      return Number(value) > Number(filterValue);
    case "gte":
      return Number(value) >= Number(filterValue);
    case "lt":
      return Number(value) < Number(filterValue);
    case "lte":
      return Number(value) <= Number(filterValue);
    case "between":
      return (
        Number(value) >= Number(filterValue) &&
        Number(value) <= Number(filter.valueTo)
      );
    default:
      return true;
  }
}
