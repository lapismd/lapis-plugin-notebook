import { describe, expect, test, vi } from "vitest";
import { createNotebookFileAttachment, createNotebookVaultRuntime } from "..";

describe("notebook file attachments", () => {
  test("loads CSV attachments with optional typed parsing", async () => {
    const readVaultFile = vi.fn(async () =>
      new TextEncoder().encode("name,count\nAda,2\nGrace,3\n").buffer.slice(0),
    );
    const attachment = createNotebookFileAttachment(
      "./assets/data.csv",
      createNotebookVaultRuntime(readVaultFile, "Notebook.notebook.md"),
    );

    const rows = await attachment.csv({ typed: true });

    expect(Array.from(rows)).toEqual([
      { name: "Ada", count: 2 },
      { name: "Grace", count: 3 },
    ]);
    expect((rows as { columns?: string[] }).columns).toEqual(["name", "count"]);
    expect(readVaultFile).toHaveBeenCalledWith(
      "./assets/data.csv",
      "Notebook.notebook.md",
    );
  });

  test("loads TSV attachments", async () => {
    const readVaultFile = vi.fn(async () =>
      new TextEncoder().encode("name\tscore\nAda\t7\n").buffer.slice(0),
    );
    const attachment = createNotebookFileAttachment(
      "./assets/data.tsv",
      createNotebookVaultRuntime(readVaultFile, "Notebook.notebook.md"),
    );

    const rows = await attachment.tsv({ typed: true });

    expect(Array.from(rows)).toEqual([{ name: "Ada", score: 7 }]);
    expect((rows as { columns?: string[] }).columns).toEqual(["name", "score"]);
  });
});
