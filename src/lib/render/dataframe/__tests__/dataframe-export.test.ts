import { describe, expect, test } from "vitest";
import { exportRowsAsCsv, exportRowsAsJson } from "../dataframe-export";

describe("dataframe export", () => {
  test("exports rows as escaped csv", () => {
    expect(
      exportRowsAsCsv([
        {
          title: "Project, plan",
          notes: "Line 1\nLine 2",
          score: 0.82,
          meta: { archived: false },
          nullable: null,
        },
      ]),
    ).toBe(
      [
        "title,notes,score,meta,nullable",
        '"Project, plan","Line 1\nLine 2",0.82,"{""archived"":false}",',
      ].join("\n"),
    );
  });

  test("exports rows as formatted json", () => {
    expect(exportRowsAsJson([{ title: "Project plan", score: 0.82 }])).toBe(
      JSON.stringify([{ title: "Project plan", score: 0.82 }], null, 2),
    );
  });
});
