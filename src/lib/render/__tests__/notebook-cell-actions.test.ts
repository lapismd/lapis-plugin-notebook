import { describe, expect, test } from "vitest";
import { getNotebookCellCodeActionState } from "../notebook-cell-actions";

describe("getNotebookCellCodeActionState", () => {
  test("shows stop only for the actively running cell", () => {
    expect(
      getNotebookCellCodeActionState({
        executionState: "running",
        savingSource: false,
        canRun: true,
        hasRunHandler: true,
        hasStopHandler: true,
      }),
    ).toEqual({
      mode: "stop",
      disabled: false,
      ariaLabel: "Stop notebook execution",
    });

    expect(
      getNotebookCellCodeActionState({
        executionState: "scheduled",
        savingSource: false,
        canRun: true,
        hasRunHandler: true,
        hasStopHandler: true,
      }),
    ).toEqual({
      mode: "run",
      disabled: true,
      ariaLabel: "Run notebook cell",
    });
  });

  test("keeps run disabled when the source is saving or no run handler exists", () => {
    expect(
      getNotebookCellCodeActionState({
        executionState: "idle",
        savingSource: true,
        canRun: true,
        hasRunHandler: true,
        hasStopHandler: true,
      }).disabled,
    ).toBe(true);

    expect(
      getNotebookCellCodeActionState({
        executionState: "idle",
        savingSource: false,
        canRun: true,
        hasRunHandler: false,
        hasStopHandler: true,
      }).disabled,
    ).toBe(true);
  });
});
