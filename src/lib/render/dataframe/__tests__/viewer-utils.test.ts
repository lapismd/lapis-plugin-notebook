import { describe, expect, test } from "vitest";
import { mapDuckDBType } from "../duckdb-types";
import { formatCellValue } from "../utils/format";
import { clientFilter, matchesFilter } from "../utils/filter";
import { clientSort } from "../utils/sort";

describe("dataframe viewer helpers", () => {
  test("maps duckdb types to viewer types", () => {
    expect(mapDuckDBType("DECIMAL(10,2)")).toBe("decimal");
    expect(mapDuckDBType("TIMESTAMPTZ")).toBe("timestamp");
    expect(mapDuckDBType("Utf8")).toBe("varchar");
    expect(mapDuckDBType("Int32")).toBe("integer");
    expect(mapDuckDBType("Float64")).toBe("double");
    expect(mapDuckDBType("Bool")).toBe("boolean");
    expect(mapDuckDBType("Timestamp<MICROSECOND>")).toBe("timestamp");
    expect(mapDuckDBType("mystery")).toBe("unknown");
  });

  test("sorts rows by multiple columns", () => {
    expect(
      clientSort(
        [
          { name: "b", score: 2 },
          { name: "a", score: 2 },
          { name: "c", score: 1 },
        ],
        [
          { column: "score", direction: "desc", priority: 1 },
          { column: "name", direction: "asc", priority: 2 },
        ],
      ),
    ).toEqual([
      { name: "a", score: 2 },
      { name: "b", score: 2 },
      { name: "c", score: 1 },
    ]);
  });

  test("filters rows using typed operators", () => {
    expect(
      clientFilter(
        [
          { name: "Alpha", score: 5 },
          { name: "Beta", score: 2 },
          { name: "Gamma", score: null },
        ],
        [
          { column: "name", operator: "contains", value: "a" },
          { column: "score", operator: "gte", value: 3 },
        ],
      ),
    ).toEqual([{ name: "Alpha", score: 5 }]);

    expect(matchesFilter(null, { column: "score", operator: "is_null" })).toBe(
      true,
    );
  });

  test("formats numeric and null values", () => {
    expect(formatCellValue(1234.5678, "double")).toMatchObject({
      text: "1,234.5678",
      align: "right",
    });

    expect(formatCellValue(null, "varchar")).toMatchObject({
      text: "null",
      isNull: true,
    });
  });
});
