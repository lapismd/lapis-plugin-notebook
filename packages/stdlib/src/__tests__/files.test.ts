import { describe, expect, test, vi } from "vitest";
import { createNotebookFileAttachment, createNotebookVaultRuntime } from "..";
import * as fileHelpers from "../files";

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
test("reader-backed attachments share binary and CSV parsing without eager reads", async () => {
  const read = vi.fn(
    async () => new TextEncoder().encode("name,count\nAda,2").buffer,
  );
  const attachment = (
    fileHelpers as any
  ).createNotebookFileAttachmentFromReader("data.csv", read);
  expect(read).not.toHaveBeenCalled();
  expect(Array.from(await attachment.csv({ typed: true }))).toEqual([
    { name: "Ada", count: 2 },
  ]);
  expect(await attachment.blob("text/csv")).toBeInstanceOf(Blob);
});
