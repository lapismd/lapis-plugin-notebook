import type { NotebookCellExecutionState } from "../runtime/notebook-session";

type NotebookCellCodeActionState = {
  mode: "run" | "stop";
  disabled: boolean;
  ariaLabel: string;
};

type NotebookCellCodeActionParams = {
  executionState: NotebookCellExecutionState;
  savingSource: boolean;
  canRun: boolean;
  hasRunHandler: boolean;
  hasStopHandler: boolean;
};

export function getNotebookCellCodeActionState({
  executionState,
  savingSource,
  canRun,
  hasRunHandler,
  hasStopHandler,
}: NotebookCellCodeActionParams): NotebookCellCodeActionState {
  if (executionState === "running") {
    return {
      mode: "stop",
      disabled: savingSource || !hasStopHandler,
      ariaLabel: "Stop notebook execution",
    };
  }

  const busy = executionState === "scheduled";

  return {
    mode: "run",
    disabled: savingSource || busy || !canRun || !hasRunHandler,
    ariaLabel: "Run notebook cell",
  };
}
