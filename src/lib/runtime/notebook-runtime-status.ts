import type { NotebookWorkerRuntimePolicyInput } from "@lapis-notes/notebook-worker";
import type { NotebookOutputStateSummary } from "./notebook-session";

export interface NotebookRuntimeStatusPresentation {
  mode: "worker" | "in-process";
  label: string;
  detail: string;
  fallbackReason?: string;
}

export interface NotebookOutputStatusPresentation {
  kind: NotebookOutputStateSummary["kind"];
  label: string;
  detail?: string;
}

export interface NotebookViewStatus {
  runtime: NotebookRuntimeStatusPresentation;
  executionDisabled: boolean;
}

export function describeNotebookRuntimeStatus(
  input: NotebookWorkerRuntimePolicyInput,
): NotebookRuntimeStatusPresentation {
  const fallbackReason = describeNotebookFallbackReason(input);
  if (!fallbackReason) {
    return {
      mode: "worker",
      label: "Worker runtime",
      detail: "This notebook can run in the dedicated notebook worker.",
    };
  }

  return {
    mode: "in-process",
    label: "In-process runtime",
    detail: fallbackReason,
    fallbackReason,
  };
}

export function describeNotebookOutputStatus(
  state: NotebookOutputStateSummary,
): NotebookOutputStatusPresentation | null {
  if (state.kind === "none" || state.cellCount === 0) {
    return null;
  }

  if (state.kind === "restored") {
    return {
      kind: state.kind,
      label: "Restored generated outputs",
      detail: `Showing ${formatCellCount(state.cellCount)} restored from generated state.`,
    };
  }

  if (state.kind === "restored-stale") {
    const staleCount = state.staleCellCount ?? 0;
    return {
      kind: state.kind,
      label: "Restored outputs need rerun",
      detail: `Restored ${formatCellCount(state.cellCount)}; ${formatCellCount(staleCount)} ${staleCount === 1 ? "is" : "are"} stale after this note changed.`,
    };
  }

  return {
    kind: state.kind,
    label: "Outputs recomputed",
    detail: `Ran ${formatCellCount(state.cellCount)} in this session.`,
  };
}

function describeNotebookFallbackReason(
  input: NotebookWorkerRuntimePolicyInput,
): string | undefined {
  if (!input.workerAvailable) {
    return "Running in process because this host does not expose a notebook worker.";
  }

  if (input.usesDuckDb) {
    return "Running in process because this notebook uses DuckDB queries.";
  }

  if (input.requiresLiveDom) {
    return "Running in process because this notebook uses live DOM outputs or inputs.";
  }

  if (input.hasRuntimeDependencyLoader) {
    return "Running in process because this notebook loads runtime packages through the main app session.";
  }

  if (input.hasUnsupportedRuntimeDependency) {
    return "Running in process because a configured notebook package uses a non-worker resolver.";
  }

  if (input.hasHostOnlyProvider) {
    return "Running in process because this notebook needs a host-only execution provider.";
  }

  return undefined;
}

function formatCellCount(count: number): string {
  return `${count} ${count === 1 ? "cell output" : "cell outputs"}`;
}
