import { expect, test } from "vitest";
import { analyzeTsCell } from "./analyze-ts-cell";

test("attachment filenames do not create cell dependencies", () => {
  const analysis = analyzeTsCell(
    'const records = await lapis.FileAttachment("./system-guide-table.csv").csv({ typed: true });',
  );
  expect(analysis.refs).not.toContain("table");
});

test("template text is ignored while interpolation references remain", () => {
  const analysis = analyzeTsCell("const text = `table ${rows.length}`;");
  expect(analysis.refs).toContain("rows");
  expect(analysis.refs).not.toContain("table");
});

test("strings and comments cannot invent definitions or references", () => {
  const analysis = analyzeTsCell(
    'const text = "const imaginary = 1"; /* const hidden = table; */ // rows',
  );
  expect(analysis.defs).toEqual(["text"]);
  expect(analysis.refs).not.toContain("table");
  expect(analysis.refs).not.toContain("rows");
});

test("a member property does not hide an independent variable reference", () => {
  const analysis = analyzeTsCell("const box = source.rows + rows;");
  expect(analysis.refs).toContain("source");
  expect(analysis.refs).toContain("rows");
});
