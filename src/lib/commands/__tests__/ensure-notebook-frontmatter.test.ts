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

import { ensureNotebookFrontmatter } from "../ensure-notebook-frontmatter";

function createFile(path = "Notebook.md", extension = "md") {
  return {
    path,
    extension,
    basename: path.split("/").at(-1) ?? path,
    baseName: path.replace(/\.[^.]+$/, ""),
  };
}

function createApp(initialFrontmatter: Record<string, unknown> = {}) {
  const file = createFile();
  let frontmatterState = structuredClone(initialFrontmatter);

  return {
    file,
    getFrontmatter: () => frontmatterState,
    app: {
      workspace: {
        getActiveFile: vi.fn(() => file),
      },
      metadataCache: {
        getFileCache: vi.fn(() => ({ frontmatter: frontmatterState })),
      },
      fileManager: {
        processFrontMatter: vi.fn(async (_file, mutate) => {
          const next = structuredClone(frontmatterState);
          mutate(next);
          frontmatterState = next;
        }),
      },
    },
  };
}

describe("ensureNotebookFrontmatter", () => {
  beforeEach(() => {
    noticeSpy.mockReset();
  });

  test("adds notebook frontmatter to the active markdown note", async () => {
    const ctx = createApp();

    const result = await ensureNotebookFrontmatter(ctx.app as any, {
      notify: false,
    });

    expect(result).toBe(ctx.file);
    expect(ctx.app.fileManager.processFrontMatter).toHaveBeenCalledWith(
      ctx.file,
      expect.any(Function),
    );
    expect(ctx.getFrontmatter()).toEqual({
      notebook: { version: 1 },
    });
    expect(noticeSpy).not.toHaveBeenCalled();
  });

  test("preserves existing notebook fields while backfilling version", async () => {
    const ctx = createApp({ notebook: { mode: "lazy" } });

    await ensureNotebookFrontmatter(ctx.app as any, { notify: false });

    expect(ctx.getFrontmatter()).toEqual({
      notebook: { version: 1, mode: "lazy" },
    });
  });
});
