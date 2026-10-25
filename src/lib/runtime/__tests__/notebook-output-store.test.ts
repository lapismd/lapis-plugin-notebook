import { describe, expect, test, vi } from "vitest";
import {
  deleteNotebookPersistedState,
  loadNotebookPersistedState,
  saveNotebookPersistedState,
} from "../notebook-output-store";

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
    const setNotebookState = vi.fn(async () => {});
    const app = {
      appDatabase: { setNotebookState },
    } as any;
    const file = {
      path: "Notebook Demo/Notebook Feature Tour.md",
      stat: { mtime: 123 },
    } as any;
    const session = {
      document: {
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

    expect(setNotebookState).toHaveBeenCalledWith(
      file.path,
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
    const setNotebookState = vi.fn(async () => {
      throw new Error(
        "Remote app database request timed out: setNotebookState",
      );
    });
    const app = {
      appDatabase: { setNotebookState },
    } as any;
    const file = {
      path: "Notebook Demo/Notebook Feature Tour.md",
      stat: { mtime: 123 },
    } as any;
    const session = {
      document: {
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
    expect(setNotebookState).toHaveBeenCalledTimes(1);
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
