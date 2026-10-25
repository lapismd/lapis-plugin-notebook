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
  };
});

import { appendCellTemplate } from "../append-cell-template";

function createFile(path = "Notebook.md", extension = "md") {
  return {
    path,
    extension,
    basename: path.split("/").at(-1) ?? path,
    baseName: path.replace(/\.[^.]+$/, ""),
  };
}

function createApp({
  data = "# Notebook\n",
}: {
  data?: string;
} = {}) {
  const file = createFile("Notebook.notebook.md");
  let dataState = data;

  return {
    file,
    getData: () => dataState,
    app: {
      workspace: {
        getActiveFile: vi.fn<() => typeof file | null>(() => file),
      },
      vault: {
        process: vi.fn(async (_file, mutate) => {
          dataState = mutate(dataState);
          return dataState;
        }),
      },
    },
  };
}

describe("appendCellTemplate", () => {
  beforeEach(() => {
    noticeSpy.mockReset();
  });

  test("appends a SQL cell to an active notebook file", async () => {
    const ctx = createApp();

    const result = await appendCellTemplate(ctx.app as any, "sql");

    expect(result).toBe(ctx.file);
    expect(ctx.getData()).toContain(":::cell{#sql-");
    expect(ctx.getData()).toContain('lang="sql"');
    expect(ctx.getData()).toContain("FROM lapis.notes");
    expect(noticeSpy).toHaveBeenCalledWith("Inserted notebook SQL cell");
  });

  test("returns null when there is no active notebook note", async () => {
    const ctx = createApp();
    ctx.app.workspace.getActiveFile = vi.fn<() => typeof ctx.file | null>(
      () => null,
    );

    const result = await appendCellTemplate(ctx.app as any, "ts");

    expect(result).toBeNull();
    expect(ctx.app.vault.process).not.toHaveBeenCalled();
    expect(noticeSpy).toHaveBeenCalledWith(
      "Notebook cells can only be inserted into notebook notes",
    );
  });
});
