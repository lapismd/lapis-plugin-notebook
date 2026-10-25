import { beforeEach, describe, expect, test, vi } from "vitest";

const { noticeSpy } = vi.hoisted(() => ({
  noticeSpy: vi.fn(),
}));

vi.mock("@lapis-notes/api", async () => {
  return {
    Notice: class Notice {
      constructor(message: string) {
        noticeSpy(message);
      }
    },
    joinPath: (...parts: string[]) => parts.join("/").replace(/\/{2,}/g, "/"),
  };
});

import { createDemoNotebooks } from "../create-demo-notebooks";

type StoredEntry =
  | { kind: "file"; path: string; extension: string; content: string }
  | { kind: "folder"; path: string };

function extensionFor(path: string): string {
  return path.split(".").at(-1) ?? "";
}

function createApp() {
  const entries = new Map<string, StoredEntry>();
  const createFolder = vi.fn(async (path: string) => {
    const existing = entries.get(path);
    if (existing?.kind === "file") {
      throw new Error(`${path} is a file`);
    }
    const folder = { kind: "folder" as const, path };
    entries.set(path, folder);
    return folder;
  });
  const create = vi.fn(async (path: string, content: string) => {
    const file = {
      kind: "file" as const,
      path,
      extension: extensionFor(path),
      content,
    };
    entries.set(path, file);
    return file;
  });
  const modify = vi.fn(async (file: { path: string }, content: string) => {
    const existing = entries.get(file.path);
    if (!existing || existing.kind !== "file") {
      throw new Error(`Missing file ${file.path}`);
    }
    existing.content = content;
    return existing;
  });

  return {
    entries,
    app: {
      vault: {
        createFolder,
        create,
        modify,
        getAbstractFileByPath: vi.fn(
          (path: string) => entries.get(path) ?? null,
        ),
      },
    },
  };
}

describe("createDemoNotebooks", () => {
  beforeEach(() => {
    noticeSpy.mockReset();
  });

  test("creates the demo-notebook folder with sample notebooks and assets", async () => {
    const ctx = createApp();

    const result = await createDemoNotebooks(ctx.app as any);

    expect(result).toBe("demo-notebook");
    expect(ctx.entries.get("demo-notebook")).toMatchObject({ kind: "folder" });
    expect(ctx.entries.get("demo-notebook/assets")).toMatchObject({
      kind: "folder",
    });
    expect(
      ctx.entries.get("demo-notebook/00-command-tour.notebook.md"),
    ).toMatchObject({
      kind: "file",
      extension: "md",
      content: expect.stringContaining(':::cell{#setup lang="ts"}'),
    });
    expect(
      ctx.entries.get("demo-notebook/01-app-tables-and-sql.notebook.md"),
    ).toMatchObject({
      kind: "file",
      content: expect.stringContaining("FROM lapis.search_documents"),
    });
    expect(
      ctx.entries.get("demo-notebook/02-relative-csv-and-duckdb.notebook.md"),
    ).toMatchObject({
      kind: "file",
      content: expect.stringContaining(
        'registerVaultFile("sales_csv", "./assets/demo-sales.csv")',
      ),
    });
    expect(
      ctx.entries.get("demo-notebook/03-output-gallery.notebook.md"),
    ).toMatchObject({
      kind: "file",
      content: expect.stringContaining('lapis.image("image/svg+xml"'),
    });
    const inputsDemo = ctx.entries.get(
      "demo-notebook/04-observable-inputs.notebook.md",
    );
    expect(inputsDemo).toMatchObject({
      kind: "file",
      content: expect.stringContaining("Observable Inputs Gallery"),
    });
    if (!inputsDemo || inputsDemo.kind !== "file") {
      throw new Error("Expected Observable inputs demo to be created");
    }
    for (const snippet of [
      "Inputs.toggle",
      "Inputs.range",
      "Inputs.number",
      "Inputs.text",
      "Inputs.email",
      "Inputs.tel",
      "Inputs.url",
      "Inputs.password",
      "Inputs.textarea",
      "Inputs.date",
      "Inputs.datetime",
      "Inputs.color",
      "return html`<section",
    ]) {
      expect(inputsDemo.content).toContain(snippet);
    }
    for (const removedSnippet of [
      "Inputs.button",
      "Inputs.checkbox",
      "Inputs.radio",
      "Inputs.select",
      "Inputs.file",
      "Inputs.search",
      "Inputs.table",
      "Inputs.form",
    ]) {
      expect(inputsDemo.content).not.toContain(removedSnippet);
    }
    expect(
      ctx.entries.get("demo-notebook/assets/demo-sales.csv"),
    ).toMatchObject({
      kind: "file",
      extension: "csv",
      content: expect.stringContaining("region,month,amount"),
    });
    expect(noticeSpy).toHaveBeenCalledWith(
      "Wrote notebook demo suite to demo-notebook",
    );
  });

  test("refreshes managed demo files when the command is run again", async () => {
    const ctx = createApp();

    await createDemoNotebooks(ctx.app as any);
    const existing = ctx.entries.get("demo-notebook/README.md");
    if (!existing || existing.kind !== "file") {
      throw new Error("Expected README to be created");
    }
    existing.content = "stale";
    noticeSpy.mockReset();

    await createDemoNotebooks(ctx.app as any);

    expect(ctx.app.vault.modify).toHaveBeenCalled();
    expect(ctx.entries.get("demo-notebook/README.md")).toMatchObject({
      kind: "file",
      content: expect.stringContaining("Notebook Demo Suite"),
    });
    expect(noticeSpy).toHaveBeenCalledWith(
      "Wrote notebook demo suite to demo-notebook",
    );
  });
});
