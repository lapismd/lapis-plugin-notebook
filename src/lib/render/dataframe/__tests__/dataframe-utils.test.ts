import { describe, expect, test } from "vitest";
import {
  buildNumberHistogram,
  humanizeColumnName,
  inferColumns,
  normalizeColumnarRows,
  summarizeColumn,
  topValues,
} from "../dataframe-utils";

describe("dataframe utils", () => {
  test("humanizes column names", () => {
    expect(humanizeColumnName("updatedAt")).toBe("Updated At");
    expect(humanizeColumnName("word_count")).toBe("Word count");
  });

  test("normalizes columnar rows into record rows", () => {
    expect(normalizeColumnarRows(["title", "count"], [["Alpha", 2]])).toEqual([
      { title: "Alpha", count: 2 },
    ]);
  });

  test("infers ordered columns and types from mixed rows", () => {
    const rows = [
      {
        title: "Project plan",
        folder: "work",
        wordCount: 1234,
        updatedAt: "2026-05-03T12:00:00Z",
        archived: false,
        tags: ["work", "planning"],
        score: 0.82,
      },
      {
        title: "Retro",
        folder: "work",
        wordCount: null,
        updatedAt: "2026-05-04T10:00:00Z",
        archived: true,
        tags: ["work"],
        score: 0.65,
        extra_field: "later",
      },
    ];

    expect(inferColumns(rows)).toEqual([
      {
        key: "title",
        label: "Title",
        type: "string",
        displayType: "str",
        nullable: false,
      },
      {
        key: "folder",
        label: "Folder",
        type: "string",
        displayType: "str",
        nullable: false,
      },
      {
        key: "wordCount",
        label: "Word Count",
        type: "number",
        displayType: "i64",
        nullable: true,
      },
      {
        key: "updatedAt",
        label: "Updated At",
        type: "date",
        displayType: "datetime",
        nullable: false,
      },
      {
        key: "archived",
        label: "Archived",
        type: "boolean",
        displayType: "bool",
        nullable: false,
      },
      {
        key: "tags",
        label: "Tags",
        type: "json",
        displayType: "json",
        nullable: false,
      },
      {
        key: "score",
        label: "Score",
        type: "number",
        displayType: "f64",
        nullable: false,
      },
      {
        key: "extra_field",
        label: "Extra field",
        type: "string",
        displayType: "str",
        nullable: true,
      },
    ]);
  });

  test("summarizes number columns with histogram and median", () => {
    const rows = [{ score: 1 }, { score: 3 }, { score: 5 }, { score: null }];

    expect(
      summarizeColumn(rows, { key: "score", type: "number" }),
    ).toMatchObject({
      key: "score",
      type: "number",
      rowCount: 4,
      nonNullCount: 3,
      nullCount: 1,
      distinctCount: 3,
      min: 1,
      max: 5,
      mean: 3,
      median: 3,
      stddev: expect.closeTo(1.632993, 5),
    });
  });

  test("summarizes string columns with top values", () => {
    const rows = [
      { folder: "work" },
      { folder: "work" },
      { folder: "home" },
      { folder: null },
    ];

    expect(summarizeColumn(rows, { key: "folder", type: "string" })).toEqual({
      key: "folder",
      label: "Folder",
      type: "string",
      rowCount: 4,
      nonNullCount: 3,
      nullCount: 1,
      distinctCount: 2,
      avgLength: 4,
      topValues: [
        { value: "work", count: 2 },
        { value: "home", count: 1 },
      ],
    });
  });

  test("builds stable top values and histograms", () => {
    expect(topValues(["b", "a", "a", "c"], 2)).toEqual([
      { value: "a", count: 2 },
      { value: "b", count: 1 },
    ]);

    expect(buildNumberHistogram([1, 2, 3, 4], 2)).toEqual([
      { start: 1, end: 2.5, count: 2 },
      { start: 2.5, end: 4, count: 2 },
    ]);
  });
});
