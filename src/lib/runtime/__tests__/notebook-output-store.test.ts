import { describe, expect, test, vi } from "vitest";
import {
  deleteNotebookPersistedState,
  loadNotebookPersistedState,
  saveNotebookPersistedState,
} from "../notebook-output-store";

const UUID = "8e627840-f468-4d72-912e-6136c21317ba";
const stateKey = `plugin:lapis-notebook:state:v1:${UUID}`;

vi.mock("@lapis-notes/api", async () => {
  const noop = () => undefined;
  const mockLogger = { debug: noop, info: noop, warn: noop, error: noop };
  return {
    logging: {
      getLogger() {
        return mockLogger;
      },
    },
  };
});

describe("saveNotebookPersistedState", () => {
  test("normalizes generated values before saving notebook state", async () => {
    const setMeta = vi.fn(async () => {});
    const app = {
      appDatabase: { setMeta, getMeta: vi.fn(async () => undefined) },
    } as any;
    const file = {
      path: "Notebook Demo/Notebook Feature Tour.md",
      stat: { mtime: 123 },
    } as any;
    const session = {
      document: {
        frontmatter: { id: UUID },
        cells: [{ id: "query" }],
      },
      getCellState: () => ({
        state: "success",
        output: [
          {
            kind: "dom",
            outputId: "dom_controls_gain_1",
            cellId: "query",
            role: "input",
            persist: false,
          },
          {
            kind: "table",
            rows: [{ count: 12n, huge: 9007199254740993n }],
          },
        ],
        inputValues: { gain: 5n },
        error: null,
      }),
      getCellInputValues: () => ({
        gain: 5n,
        dueDate: new Date("2026-05-08T00:00:00.000Z"),
      }),
    } as any;

    await saveNotebookPersistedState(app, file, session);

    expect(setMeta).toHaveBeenCalledWith(
      stateKey,
      expect.objectContaining({
        cells: {
          query: {
            state: "success",
            sourceHash: expect.any(String),
            outputs: [
              {
                kind: "table",
                rows: [{ count: 12, huge: "9007199254740993" }],
              },
            ],
            inputValues: { gain: 5, dueDate: "2026-05-08T00:00:00.000Z" },
            error: null,
          },
        },
      }),
    );
  });

  test("swallows persisted-state save errors", async () => {
    const setMeta = vi.fn(async () => {
      throw new Error("Remote app database request timed out: setMeta");
    });
    const app = {
      appDatabase: { setMeta, getMeta: vi.fn(async () => undefined) },
    } as any;
    const file = {
      path: "Notebook Demo/Notebook Feature Tour.md",
      stat: { mtime: 123 },
    } as any;
    const session = {
      document: {
        frontmatter: { id: UUID },
        cells: [{ id: "query" }],
      },
      getCellState: () => ({
        state: "success",
        output: [],
      }),
      getCellInputValues: () => undefined,
    } as any;

    await expect(
      saveNotebookPersistedState(app, file, session),
    ).resolves.toBeUndefined();
    expect(setMeta).toHaveBeenCalledTimes(1);
  });
});

describe("notebook persisted state access", () => {
  test("returns undefined when loading persisted state times out", async () => {
    const getNotebookState = vi.fn(async () => {
      throw new Error(
        "Remote app database request timed out: getNotebookState",
      );
    });
    const app = {
      appDatabase: { getNotebookState },
    } as any;

    await expect(
      loadNotebookPersistedState(app, "Notebook Demo/Notebook Feature Tour.md"),
    ).resolves.toBeUndefined();
    expect(getNotebookState).toHaveBeenCalledTimes(1);
  });

  test("swallows persisted-state delete errors", async () => {
    const deleteNotebookState = vi.fn(async () => {
      throw new Error(
        "Remote app database request timed out: deleteNotebookState",
      );
    });
    const app = {
      appDatabase: { deleteNotebookState },
    } as any;

    await expect(
      deleteNotebookPersistedState(
        app,
        "Notebook Demo/Notebook Feature Tour.md",
      ),
    ).resolves.toBeUndefined();
    expect(deleteNotebookState).toHaveBeenCalledTimes(1);
  });
});

test("persists upload markers and vault references without live readers or bytes", async () => {
  const { createFileInput, getNotebookFileModel } = await import(
    "../../../../packages/input/src/file-model"
  );
  const { registerNotebookDomOutput, clearNotebookDomOutputsForSource } =
    await import("../notebook-dom-registry");
  class FakeNode extends EventTarget {}
  vi.stubGlobal("Node", FakeNode);
  const node = createFileInput({ multiple: true });
  const model = getNotebookFileModel(node)!;
  model.addUploads([
    {
      name: "private.json",
      type: "application/json",
      size: 2,
      lastModified: 1,
      arrayBuffer: async () => new TextEncoder().encode("secret bytes").buffer,
    } as File,
  ]);
  model.addVault([
    { path: "data.csv", name: "data.csv", size: 8, lastModified: 2 },
  ]);
  const path = "Files.notebook.md";
  registerNotebookDomOutput({
    outputId: "file-persistence",
    sourcePath: path,
    cellId: "files",
    name: "files",
    role: "input",
    node,
  });
  const setMeta = vi.fn();
  try {
    await saveNotebookPersistedState(
      {
        appDatabase: { setMeta, getMeta: vi.fn(async () => undefined) },
      } as any,
      { path, stat: { mtime: 1 } } as any,
      {
        document: {
          frontmatter: { id: UUID },
          cells: [{ id: "files", source: "", lang: "js" }],
        },
        getCellState: () => ({ state: "success", output: [] }),
        getCellInputValues: () => ({ files: model.value }),
      } as any,
    );
    const saved = setMeta.mock.lastCall![1];
    expect(saved.cells.files.inputValues.files.value).toEqual([
      expect.objectContaining({ source: "upload", needsReselection: true }),
      expect.objectContaining({ source: "vault", path: "data.csv" }),
    ]);
    const serialized = JSON.stringify(saved);
    expect(serialized).not.toContain("secret bytes");
    expect(serialized).not.toContain("arrayBuffer");
  } finally {
    clearNotebookDomOutputsForSource(path);
    vi.unstubAllGlobals();
  }
});
