import {
  filterOperators,
  validateFilterState,
  type FilterCondition,
  type FilterField,
  type FilterGroup,
  type FilterType,
  type StructuredFilterState,
} from "@lapismd/design-core/shadcn/filter-builder";
import { inferCanvasTableColumnTypes } from "@lapismd/design-core/shadcn/canvas-table";
import type { Column, DataFrameRow } from "../dataframe/dataframe-types";
import ValueEditor from "./TableFilterValue.svelte";
import {
  compareTableNumbers,
  isTableNumber,
  tableDate,
  tableText,
} from "./table-values";

export function inferTableTypes(
  rows: readonly DataFrameRow[],
  columns: readonly Column[],
): FilterType[] {
  return inferCanvasTableColumnTypes(
    rows.slice(0, 100).map((row, id) => ({
      id,
      cells: columns.map((column) => tableText(row[column.name])),
    })),
    { columnCount: columns.length, headerRow: false, sampleSize: 100 },
  );
}
export function declaredTableType(type: string): FilterType | null {
  if (
    ["integer", "bigint", "float", "double", "decimal", "number"].includes(type)
  )
    return "number";
  if (type === "boolean" || type === "date") return type;
  if (type === "timestamp") return "datetime";
  if (["unknown", "null"].includes(type)) return null;
  return "text";
}
export function tableFilterFields(
  columns: readonly Column[],
  inferred: readonly FilterType[],
  state: StructuredFilterState,
): FilterField[] {
  return columns.map((column, index) => {
    const fixed = declaredTableType(column.type);
    const type = fixed ?? inferred[index] ?? "text";
    const active = fixed ?? state.types[column.name] ?? type;
    const operators = filterOperators(active).map((operator) => ({
      ...operator,
    }));
    if (active === "number")
      operators.forEach((operator) => {
        if (operator.value !== "none")
          Object.assign(operator, {
            validation: "custom",
            validate: (value: unknown) =>
              isTableNumber(value) ? null : "Enter a valid decimal number.",
          });
      });
    if (["number", "date", "datetime"].includes(active))
      operators.push({
        id: "between",
        label: "between",
        value: "multiple",
        validate: (value) => {
          if (
            !Array.isArray(value) ||
            value.length !== 2 ||
            value.some((item) => !item.trim())
          )
            return "Enter both range bounds.";
          const compared =
            active === "number"
              ? compareTableNumbers(value[0], value[1])
              : (() => {
                  const a = tableDate(value[0], active === "datetime"),
                    b = tableDate(value[1], active === "datetime");
                  return a == null || b == null ? null : a - b;
                })();
          return compared == null
            ? "Enter valid range bounds."
            : compared > 0
              ? "The lower bound must not exceed the upper bound."
              : null;
        },
      });
    if (active === "text")
      operators.push({
        id: "regex",
        label: "matches regex",
        value: "single",
        validate: (value) => {
          try {
            new RegExp(String(value), "i");
            return String(value) ? null : "Enter a pattern.";
          } catch {
            return "Enter a valid regular expression.";
          }
        },
      });
    operators.push(
      { id: "is_null", label: "is null", value: "none" },
      { id: "is_not_null", label: "is not null", value: "none" },
    );
    return {
      id: column.name,
      label: column.label ?? column.name,
      type,
      allowTypeOverride: !fixed,
      operators,
      ValueEditor,
    };
  });
}
function compare(
  raw: unknown,
  value: unknown,
  type: FilterType,
): number | null {
  if (type === "number") return compareTableNumbers(raw, value);
  if (type === "date" || type === "datetime") {
    const a = tableDate(raw, type === "datetime"),
      b = tableDate(value, type === "datetime");
    return a == null || b == null ? null : a - b;
  }
  if (type === "boolean") {
    const boolean = (item: unknown) =>
      item === true || (typeof item === "string" && item.toLowerCase() === "true")
        ? true
        : item === false || (typeof item === "string" && item.toLowerCase() === "false")
          ? false
          : null;
    const a = boolean(raw),
      b = boolean(value);
    return a == null || b == null ? null : Number(a) - Number(b);
  }
  return tableText(raw)
    .toLowerCase()
    .localeCompare(String(value).toLowerCase());
}
export function matchesTableCondition(
  raw: unknown,
  node: FilterCondition,
  type: FilterType,
): boolean {
  const op = node.operator;
  if (op === "is_null") return raw == null;
  if (op === "is_not_null") return raw != null;
  const empty = raw == null || (typeof raw === "string" && !raw.trim());
  if (op === "empty") return empty;
  if (op === "not-empty") return !empty;
  if (raw == null) return false;
  if (op === "regex") {
    try {
      return new RegExp(String(node.value), "i").test(tableText(raw));
    } catch {
      return false;
    }
  }
  if (op === "between") {
    if (!Array.isArray(node.value) || node.value.length !== 2) return false;
    const low = compare(raw, node.value[0], type),
      high = compare(raw, node.value[1], type);
    return low != null && high != null && low >= 0 && high <= 0;
  }
  const x = compare(raw, node.value, type);
  if (["eq", "neq", "lt", "lte", "gt", "gte"].includes(op)) {
    if (x == null) return false;
    return (
      {
        eq: x === 0,
        neq: x !== 0,
        lt: x < 0,
        lte: x <= 0,
        gt: x > 0,
        gte: x >= 0,
      } as Record<string, boolean>
    )[op];
  }
  const text = tableText(raw).toLowerCase(),
    value = String(node.value).toLowerCase();
  const values = Array.isArray(node.value)
    ? node.value.map((item) => item.toLowerCase())
    : [];
  const positive = op.replace(/^not-/, "");
  const result =
    positive === "contains"
      ? text.includes(value)
      : positive === "starts-with"
        ? text.startsWith(value)
        : positive === "ends-with"
          ? text.endsWith(value)
          : positive === "contains-any"
            ? values.some((item) => text.includes(item))
            : positive === "contains-all"
              ? values.every((item) => text.includes(item))
              : false;
  return op.startsWith("not-") ? !result : result;
}
export function filterTableRows(
  rows: readonly DataFrameRow[],
  state: StructuredFilterState,
  fields: readonly FilterField[],
): DataFrameRow[] {
  if (Object.keys(validateFilterState(state, fields)).length) return [];
  const byId = new Map(fields.map((field) => [field.id, field]));
  function matches(row: DataFrameRow, group: FilterGroup): boolean {
    const nonempty = (group: FilterGroup): boolean => group.children.some(child => child.kind === "condition" || nonempty(child));
    const children = group.children.filter(child => child.kind === "condition" || nonempty(child));
    if (!children.length) return true;
    const test = (node: (typeof children)[number]) =>
      node.kind === "group"
        ? matches(row, node)
        : matchesTableCondition(
            row[node.field],
            node,
            (byId.get(node.field)?.allowTypeOverride &&
              state.types[node.field]) ||
              byId.get(node.field)?.type ||
              "text",
          );
    return group.match === "all"
      ? children.every(test)
      : group.match === "any"
        ? children.some(test)
        : !children.some(test);
  }
  return rows.filter((row) => matches(row, state.root));
}
