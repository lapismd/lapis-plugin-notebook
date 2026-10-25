import { describe, expect, test, vi } from "vitest";
import {
  mapDuckDBType,
  normalizeDuckDbQueryResult,
  normalizeDuckDbRows,
} from "..";

describe("notebook DuckDB query helpers", () => {
  test("normalizes scalar and object rows", () => {
    expect(normalizeDuckDbRows([{ value: 1 }, "x"])).toEqual([
      { value: 1 },
      { value: "x" },
    ]);
  });

  test("maps DuckDB types to notebook table metadata", () => {
    vi.spyOn(performance, "now").mockReturnValue(15);

    const result = normalizeDuckDbQueryResult(
      {
        toArray: () => [{ total: 42, created: "2024-01-01" }],
        schema: {
          fields: [
            { name: "total", type: "BIGINT" },
            { name: "created", type: { toString: () => "TIMESTAMP" } },
          ],
        },
        numRows: 1,
      },
      "select total, created from sales",
      10,
    );

    expect(result.columns).toEqual(["total", "created"]);
    expect(result.columnMeta).toMatchObject([
      { key: "total", type: "number", displayType: "BIGINT" },
      { key: "created", type: "date", displayType: "TIMESTAMP" },
    ]);
    expect(result.schema).toMatchObject({ rowCount: 1, queryTimeMs: 5 });
  });

  test("normalizes DuckDB type spellings", () => {
    expect(mapDuckDBType("VARCHAR(255)")).toBe("varchar");
    expect(mapDuckDBType("TIMESTAMP WITH TIME ZONE")).toBe("timestamp");
    expect(mapDuckDBType("definitely_custom")).toBe("unknown");
  });
});
