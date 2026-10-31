import type { NotebookOutput } from "./outputs";

export type NotebookCellExecutionState =
  | "idle"
  | "stale"
  | "scheduled"
  | "running"
  | "completed"
  | "error";

export type NotebookExecutionPhaseStatus = "running" | "completed" | "error";

export interface NotebookExecutionPhase {
  key: string;
  label: string;
  status: NotebookExecutionPhaseStatus;
  startedAt: number;
  endedAt?: number;
  durationMs?: number;
  detail?: string;
}

export interface NotebookExecutionRunState {
  state: "idle" | "running";
  startedAt?: number;
  scheduledCellIds: string[];
  runningCellId?: string;
  completedCellIds: string[];
  statusMessage?: string;
  phases: NotebookExecutionPhase[];
}

export type NotebookExecutionProgressEvent =
  | {
      type: "execution-started";
      cellIds: string[];
      statusMessage?: string;
    }
  | {
      type: "cell-running";
      cellId: string;
      statusMessage?: string;
    }
  | {
      type: "cell-output";
      cellId: string;
      outputs: NotebookOutput[];
    }
  | {
      type: "cell-completed";
      cellId: string;
      outputs: NotebookOutput[];
    }
  | {
      type: "cell-error";
      cellId: string;
      error: string;
    }
  | {
      type: "status";
      message?: string;
      cellId?: string;
    }
  | {
      type: "phase-started";
      key: string;
      label: string;
      cellId?: string;
      detail?: string;
    }
  | {
      type: "phase-completed";
      key: string;
      cellId?: string;
      detail?: string;
      error?: string;
    };

export interface NotebookCellRuntimeState {
  state: NotebookCellExecutionState;
  output?: NotebookOutput[];
  inputValues?: Record<string, unknown>;
  error?: string;
  scheduledAt?: number;
  startedAt?: number;
  durationMs?: number;
  setupPhases?: NotebookExecutionPhase[];
  statusMessage?: string;
}

export interface NotebookExecutionCheckpoint {
  executionState: NotebookExecutionRunState;
  cellStates: Record<string, NotebookCellRuntimeState>;
}
