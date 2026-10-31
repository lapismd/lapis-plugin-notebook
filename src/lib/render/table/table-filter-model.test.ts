import { describe, expect, it } from "vitest";
import {
  createFilterState,
  type FilterCondition,
  type FilterType,
} from "@lapismd/design-core/shadcn/filter-builder";
import {
  filterTableRows,
  inferTableTypes,
  matchesTableCondition,
  tableFilterFields,
} from "./table-filter-model";
import { compareTableNumbers } from "./table-values";
import { identifyTableRows } from "./table-identity";
const condition = (
  operator: string,
  value: FilterCondition["value"],
): FilterCondition => ({
  id: "condition",
  kind: "condition",
  field: "value",
  operator,
  value,
});
describe("typed Notebook filters", () => {
  it.each([
    [null, "is_null", "", "text", true],
    ["", "is_null", "", "text", false],
    ["", "empty", "", "text", true],
    [null, "neq", "x", "text", false],
    [false, "eq", false, "boolean", true],
    ["unknown", "neq", true, "boolean", false],
    ["2026-02-01", "gte", "2026-01-31", "date", true],
    ["2026-02-30", "neq", "2026-01-31", "date", false],
    ["Ada", "regex", "^ad", "text", true],
    ["Ada", "regex", "[", "text", false],
    [
      "10.000000000000000001",
      "between",
      ["10.000000000000000001", "10.000000000000000002"],
      "number",
      true,
    ],
    [0, "eq", 0, "number", true],
    ["", "eq", 0, "number", false],
  ])("preserves %s %s %s (%s)", (raw, op, value, type, expected) => {
    expect(
      matchesTableCondition(
        raw,
        condition(String(op), value as FilterCondition["value"]),
        type as FilterType,
      ),
    ).toBe(expected);
  });
  it("compares exact decimals and bigint without Number coercion", () => {
    expect(compareTableNumbers(9007199254740993n, "9007199254740992")).toBe(1);
    expect(compareTableNumbers("1e400", "9e399")).toBe(1);
    expect(compareTableNumbers("0.100000000000000001", "0.1")).toBe(1);
    expect(compareTableNumbers("-12.5", "-12.50")).toBe(0);
  });
  it("bounds inference at 100 source rows and retains identifiers/blanks", () => {
    const rows = Array.from({ length: 101 }, (_, index) => ({
      value: index < 100 ? "0012" : "2026-01-01",
      empty: "",
      mixed: index % 2 ? "true" : "5",
    }));
    expect(
      inferTableTypes(
        rows,
        ["value", "empty", "mixed"].map((name) => ({ name, type: "unknown" })),
      ),
    ).toEqual(["text", "text", "text"]);
    let read = false;
    Object.defineProperty(rows[100], "value", {
      get() {
        read = true;
        return "late";
      },
    });
    inferTableTypes(rows, [{ name: "value", type: "unknown" }]);
    expect(read).toBe(false);
  });
  it("combines nested All/Any/None groups and ignores empty groups", () => {
    const state = createFilterState();
    state.root.children = [
      {
        id: "any",
        kind: "group",
        match: "any",
        children: [
          condition("eq", "Ada"),
          { ...condition("eq", "Grace"), id: "grace" },
        ],
      },
      { id: "empty", kind: "group", match: "none", children: [] },
    ];
    const fields = tableFilterFields(
      [{ name: "value", type: "text" }],
      ["text"],
      state,
    );
    expect(
      filterTableRows(
        [{ value: "Ada" }, { value: "Grace" }, { value: "Katherine" }],
        state,
        fields,
      ),
    ).toEqual([{ value: "Ada" }, { value: "Grace" }]);
  });
  it("rejects invalid regex and reversed ranges while locking declared types", () => {
    const state = createFilterState();
    state.root.children = [condition("regex", "[")];
    expect(
      filterTableRows(
        [{ value: "Ada" }],
        state,
        tableFilterFields([{ name: "value", type: "text" }], ["text"], state),
      ),
    ).toEqual([]);
    state.root.children = [condition("between", ["12", "2"])];
    const fields = tableFilterFields(
      [{ name: "value", type: "bigint" }],
      ["text"],
      state,
    );
    expect(fields[0].allowTypeOverride).toBe(false);
    expect(filterTableRows([{ value: 10 }], state, fields)).toEqual([]);
  });
  it("keeps source IDs through filter/sort before pagination, including duplicates", () => {
    const a = { value: "Ada" },
      b = { value: "Grace" };
    expect(identifyTableRows([a, b, a], [b, a, a])).toEqual([1, 0, 2]);
    expect(identifyTableRows([a, b], [b])).toEqual([1]);
  });
});
