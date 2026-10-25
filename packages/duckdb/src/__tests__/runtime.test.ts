import { describe, expect, test } from "vitest";
import { createDuckDbJsonTableSql, createDuckDbSchemaSql } from "..";

describe("notebook DuckDB runtime SQL helpers", () => {
  test("creates schema SQL", () => {
    expect(createDuckDbSchemaSql("lapis")).toBe(
      "CREATE SCHEMA IF NOT EXISTS lapis",
    );
  });

  test("creates JSON table SQL for populated snapshots", () => {
    expect(
      createDuckDbJsonTableSql({
        fileName: "__lapis_notes.json",
        schema: "lapis",
        table: "notes",
        hasRows: true,
      }),
    ).toBe(
      'CREATE OR REPLACE TABLE "lapis"."notes" AS SELECT * FROM read_json_auto(\'__lapis_notes.json\')',
    );
  });

  test("creates typed empty tables when columns are available", () => {
    expect(
      createDuckDbJsonTableSql({
        fileName: "__lapis_links.json",
        schema: "lapis",
        table: "links",
        hasRows: false,
        columns: [
          { name: "sourcePath", type: "VARCHAR" },
          { name: "count", type: "BIGINT" },
        ],
      }),
    ).toBe(
      'CREATE OR REPLACE TABLE "lapis"."links" ("sourcePath" VARCHAR, "count" BIGINT)',
    );
  });

  test("quotes table identifiers and file names", () => {
    expect(
      createDuckDbJsonTableSql({
        fileName: "it's.json",
        schema: "lapis",
        table: 'quoted"table',
        hasRows: true,
      }),
    ).toBe(
      'CREATE OR REPLACE TABLE "lapis"."quoted""table" AS SELECT * FROM read_json_auto(\'it\'\'s.json\')',
    );
  });
});
