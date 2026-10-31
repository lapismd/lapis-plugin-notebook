import type { DataFrameRow } from "../dataframe/dataframe-types";
/** Resolve stable source ordinals before pagination, including repeated objects. */
export function identifyTableRows(
  source: readonly DataFrameRow[],
  ordered: readonly DataFrameRow[],
): number[] {
  const indexes = new Map<DataFrameRow, number[]>();
  source.forEach((row, index) => {
    const ids = indexes.get(row) ?? [];
    ids.push(index);
    indexes.set(row, ids);
  });
  const positions = new Map<DataFrameRow, number>();
  return ordered.flatMap((row) => {
    const position = positions.get(row) ?? 0;
    positions.set(row, position + 1);
    const id = indexes.get(row)?.[position];
    return id == null ? [] : [id];
  });
}
