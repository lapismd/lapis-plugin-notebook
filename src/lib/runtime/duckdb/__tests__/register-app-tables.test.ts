import { describe, expect, test, vi } from "vitest";
import {
  collectAppTablesSnapshot,
  registerAppTables,
} from "../register-app-tables";

describe("registerAppTables", () => {
  test("materializes notebook app tables into duckdb", async () => {
    const registerJsonTable = vi.fn(async () => {});
    const registerFileBuffer = vi.fn(async () => {});
    const service = { registerJsonTable, registerFileBuffer } as any;
    const app = {
      vault: {
        getMarkdownFiles: () => [
          {
            path: "Notes/A.md",
            baseName: "A",
            extension: "md",
            stat: { size: 10, ctime: 1, mtime: 2 },
          },
        ],
      },
      metadataCache: {
        getFileCache: () => ({
          tags: [{ tag: "#project" }],
          frontmatter: { notebook: true },
        }),
        resolvedLinks: { "Notes/A.md": { "Notes/B.md": 1 } },
        unresolvedLinks: {},
      },
      appDatabase: {
        listSearchDocuments: vi.fn(async () => [
          {
            path: "Notes/A.md",
            name: "A",
            extension: "md",
            checksum: "x",
            content: "A",
            tags: [],
            tagParts: [],
            tagHierarchy: [],
          },
        ]),
      },
    } as any;

    await registerAppTables(service, app);

    expect(registerJsonTable).toHaveBeenCalledTimes(3);
    expect(registerJsonTable).toHaveBeenCalledWith(
      "__lapis_notes.json",
      "lapis",
      "notes",
      expect.arrayContaining([
        expect.objectContaining({ path: "Notes/A.md", tags: ["#project"] }),
      ]),
      expect.arrayContaining([
        expect.objectContaining({ name: "path", type: "VARCHAR" }),
        expect.objectContaining({ name: "frontmatter", type: "JSON" }),
      ]),
    );
  });

  test("declares link columns even when the link snapshot is empty", async () => {
    const registerJsonTable = vi.fn(async () => {});
    const service = {
      registerJsonTable,
      registerFileBuffer: vi.fn(async () => {}),
    } as any;
    const app = {
      vault: {
        getMarkdownFiles: () => [],
      },
      metadataCache: {
        getFileCache: () => null,
        resolvedLinks: {},
        unresolvedLinks: {},
      },
      appDatabase: {
        listSearchDocuments: vi.fn(async () => []),
      },
    } as any;

    await registerAppTables(service, app);

    expect(registerJsonTable).toHaveBeenCalledWith(
      "__lapis_links.json",
      "lapis",
      "links",
      [],
      [
        { name: "sourcePath", type: "VARCHAR" },
        { name: "targetText", type: "VARCHAR" },
        { name: "resolvedTargetPath", type: "VARCHAR" },
        { name: "count", type: "BIGINT" },
        { name: "kind", type: "VARCHAR" },
      ],
    );
  });

  test("normalizes note frontmatter for worker transport", async () => {
    const app = {
      vault: {
        getMarkdownFiles: () => [
          {
            path: "Notes/A.md",
            baseName: "A",
            extension: "md",
            stat: { size: 10, ctime: 1, mtime: 2 },
          },
        ],
      },
      metadataCache: {
        getFileCache: () => ({
          tags: [{ tag: "#project" }],
          frontmatter: {
            notebook: { version: 1 },
            helper: () => true,
          },
        }),
        resolvedLinks: {},
        unresolvedLinks: {},
      },
      appDatabase: {
        listSearchDocuments: vi.fn(async () => []),
      },
    } as any;

    const snapshot = await collectAppTablesSnapshot(app);

    expect(() => structuredClone(snapshot.notes[0])).not.toThrow();
    expect(snapshot.notes[0]).toMatchObject({
      frontmatter: { notebook: { version: 1 } },
    });
    expect(snapshot.notes[0]).not.toHaveProperty("frontmatter.helper");
  });
});
