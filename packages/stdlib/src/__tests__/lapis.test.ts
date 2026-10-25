import { describe, expect, test } from "vitest";
import { lapis } from "..";

describe("lapis output builders", () => {
  test("builds reconstructable input outputs", () => {
    expect(
      lapis.input("controls", "gain", "range", 5, {
        label: "Gain",
        config: { min: 0, max: 10, step: 1 },
        source: {
          library: "@lapis-notes/notebook-input",
          factory: "range",
        },
      }),
    ).toEqual({
      kind: "input",
      cellId: "controls",
      variableName: "gain",
      inputType: "range",
      value: 5,
      label: "Gain",
      config: { min: 0, max: 10, step: 1 },
      reconstructable: true,
      source: {
        library: "@lapis-notes/notebook-input",
        factory: "range",
      },
    });
  });

  test("builds table output from records", () => {
    const output = lapis.table([
      { path: "Notes/A.md", size: 12 },
      { path: "Notes/B.md", size: 5 },
    ]);

    expect(output).toEqual({
      kind: "table",
      columns: ["path", "size"],
      rows: [
        ["Notes/A.md", 12],
        ["Notes/B.md", 5],
      ],
    });
  });

  test("preserves DSV attachment column order in table output", () => {
    const rows = Object.assign([{ second: 2, first: 1 }], {
      columns: ["first", "second"],
    });

    expect(lapis.table(rows)).toEqual({
      kind: "table",
      columns: ["first", "second"],
      rows: [[1, 2]],
    });
  });

  test("builds table output from explicit columns and rows", () => {
    const output = lapis.table(["path", "size"], [["Notes/A.md", 12]]);

    expect(output).toEqual({
      kind: "table",
      columns: ["path", "size"],
      rows: [["Notes/A.md", 12]],
    });
  });

  test("preserves additive table schema metadata from columnar inputs", () => {
    const output = lapis.table({
      columns: ["path", "size"],
      rows: [["Notes/A.md", 12]],
      columnMeta: [
        { key: "path", type: "string", displayType: "VARCHAR" },
        { key: "size", type: "number", displayType: "INTEGER" },
      ],
      schema: {
        rowCount: 10,
        queryTimeMs: 42,
        sourceSql: "select * from notes",
      },
    });

    expect(output).toEqual({
      kind: "table",
      columns: ["path", "size"],
      rows: [["Notes/A.md", 12]],
      columnMeta: [
        { key: "path", type: "string", displayType: "VARCHAR" },
        { key: "size", type: "number", displayType: "INTEGER" },
      ],
      schema: {
        rowCount: 10,
        queryTimeMs: 42,
        sourceSql: "select * from notes",
      },
    });
  });

  test("rejects a column list without row data", () => {
    expect(() =>
      (lapis.table as (...args: unknown[]) => unknown)(["path", "size"]),
    ).toThrow("lapis.table requires row data when called with a column list");
  });

  test("builds chart and error outputs", () => {
    expect(lapis.chart("vega-lite", { mark: "bar" })).toEqual({
      kind: "chart",
      library: "vega-lite",
      spec: { mark: "bar" },
    });

    expect(lapis.error("Notebook failed", { stack: "trace" })).toEqual({
      kind: "error",
      message: "Notebook failed",
      stack: "trace",
    });
  });
});
