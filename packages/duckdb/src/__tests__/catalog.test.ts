import { describe, expect, test } from "vitest";
import {
  createDuckDbCatalogColumnsSql,
  createDuckDbCatalogTablesSql,
  createDuckDbTablePreviewSql,
  createDuckDbTableRowCountSql,
  createNotebookDuckDbCatalog,
  createNotebookDuckDbTablePreview,
  normalizeDuckDbPreviewLimit,
  normalizeDuckDbRowCount,
  normalizeDuckDbTableType,
  quoteDuckDbIdentifier,
} from "..";

describe("duckdb catalog helpers", () => {
  test("normalizes information schema table types", () => {
    expect(normalizeDuckDbTableType("BASE TABLE")).toBe("table");
    expect(normalizeDuckDbTableType("VIEW")).toBe("view");
    expect(normalizeDuckDbTableType("LOCAL TEMPORARY VIEW")).toBe("view");
    expect(normalizeDuckDbTableType(null)).toBe("table");
  });

  test("quotes duckdb identifiers", () => {
    expect(quoteDuckDbIdentifier("notes")).toBe('"notes"');
    expect(quoteDuckDbIdentifier('note"name')).toBe('"note""name"');
  });

  test("creates catalog SQL", () => {
    expect(createDuckDbCatalogTablesSql()).toContain(
      "FROM information_schema.tables",
    );
    expect(createDuckDbCatalogTablesSql()).toContain(
      "ORDER BY table_schema, table_name",
    );
    expect(createDuckDbCatalogColumnsSql()).toContain(
      "FROM information_schema.columns",
    );
    expect(createDuckDbCatalogColumnsSql()).toContain("ordinal_position");
  });

  test("creates bounded preview and row-count SQL", () => {
    expect(createDuckDbTablePreviewSql("lapis", 'note"data', 2.8)).toBe(
      'SELECT * FROM "lapis"."note""data" LIMIT 2',
    );
    expect(createDuckDbTablePreviewSql("lapis", "notes", 0)).toBe(
      'SELECT * FROM "lapis"."notes" LIMIT 1',
    );
    expect(createDuckDbTableRowCountSql("lapis", "notes")).toBe(
      'SELECT COUNT(*) AS row_count FROM "lapis"."notes"',
    );
    expect(normalizeDuckDbPreviewLimit(4.9)).toBe(4);
    expect(normalizeDuckDbPreviewLimit(-10)).toBe(1);
  });

  test("normalizes row counts", () => {
    expect(normalizeDuckDbRowCount([{ row_count: 7 }])).toBe(7);
    expect(normalizeDuckDbRowCount([{ row_count: "9" }])).toBe(9);
    expect(normalizeDuckDbRowCount([{ row_count: "many" }])).toBeNull();
    expect(normalizeDuckDbRowCount([])).toBeNull();
  });

  test("creates table previews from query rows and optional columns", () => {
    const rows = [{ path: "A.md", size: 12 }];

    expect(
      createNotebookDuckDbTablePreview({ rows, columns: ["path"] }),
    ).toEqual({
      columns: ["path"],
      rows,
    });
    expect(createNotebookDuckDbTablePreview({ rows })).toEqual({
      columns: ["path", "size"],
      rows,
    });
    expect(createNotebookDuckDbTablePreview({ rows: [] })).toEqual({
      columns: [],
      rows: [],
    });
  });

  test("creates catalogs from information schema rows", async () => {
    await expect(
      createNotebookDuckDbCatalog({
        tables: [
          {
            schema_name: "lapis",
            table_name: "notes",
            table_type: "BASE TABLE",
          },
          {
            schema_name: "main",
            table_name: "recent_notes",
            table_type: "VIEW",
          },
        ],
        columns: [
          {
            schema_name: "lapis",
            table_name: "notes",
            column_name: "path",
            data_type: "VARCHAR",
            is_nullable: "NO",
          },
          {
            schema_name: "lapis",
            table_name: "notes",
            column_name: "mtime",
            data_type: "DOUBLE",
            is_nullable: "YES",
          },
          {
            schema_name: "unknown",
            table_name: "missing",
            column_name: "ignored",
          },
        ],
        getRowCount: async (schemaName, tableName) =>
          `${schemaName}.${tableName}` === "lapis.notes" ? 3 : null,
      }),
    ).resolves.toEqual({
      schemas: [
        {
          name: "lapis",
          tables: [
            {
              name: "notes",
              type: "table",
              rowCount: 3,
              columns: [
                { name: "path", dataType: "VARCHAR", nullable: false },
                { name: "mtime", dataType: "DOUBLE", nullable: true },
              ],
            },
          ],
        },
        {
          name: "main",
          tables: [
            {
              name: "recent_notes",
              type: "view",
              rowCount: null,
              columns: [],
            },
          ],
        },
      ],
    });
  });
});
