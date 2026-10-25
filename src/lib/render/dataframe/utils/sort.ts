import type { DataFrameRow, SortState } from "../dataframe-types";

function toTimestamp(value: unknown): number {
  if (value instanceof Date) {
    return value.getTime();
  }

  if (typeof value === "string" || typeof value === "number") {
    return new Date(value).getTime();
  }

  return Number.NaN;
}

function compareValues(left: unknown, right: unknown): number {
  if (left == null && right == null) {
    return 0;
  }
  if (left == null) {
    return 1;
  }
  if (right == null) {
    return -1;
  }

  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  if (left instanceof Date || right instanceof Date) {
    return toTimestamp(left) - toTimestamp(right);
  }

  if (typeof left === "boolean" && typeof right === "boolean") {
    return Number(left) - Number(right);
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

export function clientSort(
  rows: readonly DataFrameRow[],
  sorts: readonly SortState[],
): DataFrameRow[] {
  if (!sorts.length) {
    return [...rows];
  }

  return [...rows].sort((leftRow, rightRow) => {
    for (const { column, direction } of sorts) {
      const compared = compareValues(leftRow[column], rightRow[column]);
      if (compared !== 0) {
        return direction === "asc" ? compared : -compared;
      }
    }

    return 0;
  });
}
