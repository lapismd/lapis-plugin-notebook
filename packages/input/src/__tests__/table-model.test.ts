import { describe, expect, it } from "vitest";
import { normalizeTableRows, normalizeTableColumns, normalizeTableInputValue, normalizeTableSelectionFromIndexes, normalizeTableSelection } from "../table-model";
describe("retained Inputs.table model", () => {
  const rows = [{ name: "Ada", amount: 1n }, { name: "Grace", amount: 2n }];
  it("keeps original row identity and iterable metadata ordering", () => {
    const data = Object.assign([...rows], { columns: ["amount", "name"] });
    const normalized = normalizeTableRows(data);
    expect(normalized[0]).toBe(rows[0]);
    expect(normalizeTableColumns(normalized, undefined)).toEqual(["amount", "name"]);
    expect(normalizeTableColumns(normalized, ["name"])).toEqual(["name"]);
  });
  it("preserves multiple/single/optional defaults", () => {
    expect(normalizeTableInputValue(rows, {})).toEqual(rows);
    expect(normalizeTableInputValue(rows, { multiple: false })).toBe(rows[0]);
    expect(normalizeTableInputValue(rows, { multiple: false, required: false })).toBeNull();
    expect(normalizeTableInputValue(rows, { select: false })).toEqual(rows);
  });
  it("maps selection IDs back to original typed objects and prunes invalid IDs", () => {
    const selected = normalizeTableSelectionFromIndexes(rows, new Set([1, 100]), { multiple: true, required: false, select: true });
    expect(selected.value).toEqual([rows[1]]);
    expect((selected.value as unknown[])[0]).toBe(rows[1]);
  });
  it("matches externally replaced selection without changing source objects", () => {
    const selected = normalizeTableSelection(rows, [rows[1]], { multiple: false, required: true, select: true });
    expect(selected.value).toBe(rows[1]);
    expect(normalizeTableSelectionFromIndexes(rows, new Set(), { multiple: false, required: true, select: true }).value).toBe(rows[0]);
  });
});
