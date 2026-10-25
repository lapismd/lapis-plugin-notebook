import type { NotebookDocument } from "../model/notebook-document";
import type { NotebookCell } from "../model/notebook-cell";
import type {
  NotebookCellExecutionState,
  NotebookCellRuntimeState,
  NotebookExecutionCheckpoint,
  NotebookExecutionPhase,
  NotebookExecutionPhaseStatus,
  NotebookExecutionProgressEvent,
  NotebookExecutionRunState,
  NotebookOutput,
} from "@lapis-notes/notebook-core";
import type {
  AppDatabaseNotebookCellState,
  AppDatabaseNotebookExecutionPhaseState,
} from "@lapis-notes/api";
import {
  buildNotebookGraph,
  collectDependencyClosure,
  collectStaleDescendants,
  type NotebookGraph,
} from "./notebook-graph";

export type {
  NotebookCellExecutionState,
  NotebookCellRuntimeState,
  NotebookExecutionCheckpoint,
  NotebookExecutionPhase,
  NotebookExecutionPhaseStatus,
  NotebookExecutionProgressEvent,
  NotebookExecutionRunState,
} from "@lapis-notes/notebook-core";

export type NotebookSessionChangeReason = "document" | "execution";

export interface NotebookOutputStateSummary {
  kind: "none" | "restored" | "restored-stale" | "recomputed";
  cellCount: number;
  staleCellCount?: number;
}

export class NotebookSession {
  document: NotebookDocument;
  graph: NotebookGraph<NotebookCell>;
  private readonly cellState = new Map<string, NotebookCellRuntimeState>();
  private readonly cellInvalidations = new Map<string, Deferred<void>>();
  private readonly runtimeValues = new Map<
    string,
    { cellId: string; value: unknown }
  >();
  private executionState: NotebookExecutionRunState =
    createIdleExecutionState();
  private persistedStateHydrated = false;
  private outputStateSummary: NotebookOutputStateSummary = {
    kind: "none",
    cellCount: 0,
  };

  constructor(
    document: NotebookDocument,
    private readonly onChange?: (reason: NotebookSessionChangeReason) => void,
  ) {
    this.document = document;
    this.graph = buildNotebookGraph(document);
    for (const cell of document.cells) {
      this.cellState.set(cell.id, { state: "idle" });
    }
  }

  updateDocument(document: NotebookDocument): string[] {
    const changed = findChangedCellIds(this.document, document);
    const previousGraph = this.graph;
    const previousExecutionState = this.executionState;
    this.document = document;
    this.graph = buildNotebookGraph(document);

    // Mark changed cells themselves stale plus any cells that depend on them
    // (downstream consumers). Do NOT include upstream dependencies — they have
    // not changed and their outputs remain valid. collectDependencyClosure
    // returns the execution closure (cell + its dependencies), which is only
    // relevant when deciding what to re-run, not what to invalidate.
    const staleCellIds = new Set([
      ...changed,
      ...collectStaleDescendants(this.graph, changed),
    ]);
    const nextState = new Map<string, NotebookCellRuntimeState>();
    for (const cellId of staleCellIds) {
      this.clearRuntimeDefinitionsForCell(cellId);
    }
    let stateChanged =
      changed.size > 0 ||
      staleCellIds.size > 0 ||
      previousGraph.order.length !== this.graph.order.length ||
      previousGraph.cycles.length !== this.graph.cycles.length ||
      previousGraph.duplicateDefinitions.size !==
        this.graph.duplicateDefinitions.size;
    for (const cell of document.cells) {
      const previous = this.cellState.get(cell.id);
      const preserveTransientState = !staleCellIds.has(cell.id);
      const nextCellState = {
        state: staleCellIds.has(cell.id)
          ? "stale"
          : (previous?.state ?? "idle"),
        output: previous?.output,
        inputValues: previous?.inputValues,
        error: previous?.error,
        scheduledAt: preserveTransientState ? previous?.scheduledAt : undefined,
        startedAt: preserveTransientState ? previous?.startedAt : undefined,
        setupPhases: previous?.setupPhases,
        durationMs: previous?.durationMs,
        statusMessage: preserveTransientState
          ? previous?.statusMessage
          : undefined,
      } satisfies NotebookCellRuntimeState;
      nextState.set(cell.id, nextCellState);

      if (!stateChanged && !cellStateEquals(previous, nextCellState)) {
        stateChanged = true;
      }
    }

    this.cellState.clear();
    nextState.forEach((value, key) => this.cellState.set(key, value));
    if (
      !stateChanged &&
      !executionStateEquals(previousExecutionState, this.executionState)
    ) {
      stateChanged = true;
    }
    if (stateChanged) {
      this.notifyChange("document");
    }
    return Array.from(changed);
  }

  getCellState(cellId: string): NotebookCellRuntimeState {
    return this.cellState.get(cellId) ?? { state: "idle" };
  }

  getExecutionState(): NotebookExecutionRunState {
    return {
      ...this.executionState,
      scheduledCellIds: [...this.executionState.scheduledCellIds],
      completedCellIds: [...this.executionState.completedCellIds],
      phases: this.executionState.phases.map((phase) => ({ ...phase })),
    };
  }

  getOutputStateSummary(): NotebookOutputStateSummary {
    return { ...this.outputStateSummary };
  }

  createExecutionCheckpoint(cellIds?: string[]): NotebookExecutionCheckpoint {
    const checkpointCellIds =
      cellIds ?? this.document.cells.map((cell) => cell.id);
    const cellStates: Record<string, NotebookCellRuntimeState> = {};

    for (const cellId of checkpointCellIds) {
      cellStates[cellId] = cloneCellState(this.getCellState(cellId));
    }

    return {
      executionState: cloneExecutionState(this.executionState),
      cellStates,
    };
  }

  restoreExecutionCheckpoint(checkpoint: NotebookExecutionCheckpoint): void {
    this.executionState = cloneExecutionState(checkpoint.executionState);
    for (const [cellId, state] of Object.entries(checkpoint.cellStates)) {
      this.cellState.set(cellId, cloneCellState(state));
    }
    this.notifyChange("execution");
  }

  getRuntimeValues(): Record<string, unknown> {
    return Object.fromEntries(
      Array.from(this.runtimeValues.entries()).map(([name, entry]) => [
        name,
        entry.value,
      ]),
    );
  }

  setRuntimeDefinitions(
    cellId: string,
    definitions: Array<[string, unknown]>,
  ): void {
    this.clearRuntimeDefinitionsForCell(cellId, {
      preserveInputValues: true,
      preserveNames: new Set(definitions.map(([name]) => name)),
    });
    for (const [name, value] of definitions) {
      this.runtimeValues.set(name, { cellId, value });
    }
  }

  setInputValue(cellId: string, name: string, value: unknown): void {
    const previous = this.getCellState(cellId);
    const inputValues = {
      ...(previous.inputValues ?? {}),
      [name]: value,
    };
    this.cellState.set(cellId, {
      ...previous,
      inputValues,
    });
    this.runtimeValues.set(name, { cellId, value });
    this.notifyChange("execution");
  }

  getInputValue(name: string): unknown {
    return this.runtimeValues.get(name)?.value;
  }

  beginCellInvalidation(cellId: string): Promise<void> {
    this.invalidateCell(cellId);
    const deferred = createDeferred<void>();
    this.cellInvalidations.set(cellId, deferred);
    return deferred.promise;
  }

  invalidateCell(cellId: string): void {
    const deferred = this.cellInvalidations.get(cellId);
    if (!deferred) {
      return;
    }

    this.cellInvalidations.delete(cellId);
    deferred.resolve();
  }

  invalidateAllCells(): void {
    for (const deferred of this.cellInvalidations.values()) {
      deferred.resolve();
    }
    this.cellInvalidations.clear();
  }

  getCellInputValues(cellId: string): Record<string, unknown> | undefined {
    const values = this.getCellState(cellId).inputValues;
    return values ? { ...values } : undefined;
  }

  restoreInputValues(
    cellId: string,
    inputValues?: Record<string, unknown>,
  ): void {
    if (!inputValues || Object.keys(inputValues).length === 0) {
      return;
    }
    const previous = this.getCellState(cellId);
    this.cellState.set(cellId, {
      ...previous,
      inputValues: { ...inputValues },
    });
    for (const [name, value] of Object.entries(inputValues)) {
      this.runtimeValues.set(name, { cellId, value });
    }
  }

  applyProgressEvent(event: NotebookExecutionProgressEvent): void {
    switch (event.type) {
      case "execution-started":
        this.beginExecution(event.cellIds, event.statusMessage);
        return;
      case "cell-running":
        this.markRunning(event.cellId, event.statusMessage);
        return;
      case "cell-completed":
        this.setCellOutput(event.cellId, event.outputs);
        return;
      case "cell-error":
        this.setCellError(event.cellId, event.error);
        return;
      case "status":
        this.setStatusMessage(event.message, event.cellId);
        return;
      case "phase-started":
        this.startPhase(event.key, event.label, event.cellId, event.detail);
        return;
      case "phase-completed":
        this.finishPhase(event.key, event.cellId, event.detail, event.error);
        return;
    }
  }

  beginExecution(cellIds: string[], statusMessage?: string): void {
    const queuedAt = Date.now();
    const nextCellIds = Array.from(new Set(cellIds));
    this.executionState = {
      state: nextCellIds.length > 0 ? "running" : "idle",
      startedAt: nextCellIds.length > 0 ? queuedAt : undefined,
      scheduledCellIds: [...nextCellIds],
      runningCellId: undefined,
      completedCellIds: [],
      statusMessage,
      phases: [],
    };

    for (const cellId of nextCellIds) {
      const previous = this.getCellState(cellId);
      this.cellState.set(cellId, {
        ...previous,
        state: "scheduled",
        error: undefined,
        scheduledAt: queuedAt,
        startedAt: undefined,
        statusMessage: statusMessage ?? "Scheduled",
      });
    }

    this.notifyChange("execution");
  }

  setCellOutput(cellId: string, output: NotebookOutput[]): void {
    const previous = this.getCellState(cellId);
    this.cellState.set(cellId, {
      state: "completed",
      output,
      inputValues: previous.inputValues,
      setupPhases: finalizePhases(previous.setupPhases),
      durationMs: resolveDurationMs(previous),
    });
    this.markCellTerminal(cellId);
  }

  setCellError(cellId: string, error: string): void {
    const previous = this.getCellState(cellId);
    this.clearRuntimeDefinitionsForCell(cellId, { preserveInputValues: true });
    this.cellState.set(cellId, {
      state: "error",
      inputValues: previous.inputValues,
      error,
      setupPhases: finalizePhases(previous.setupPhases),
      durationMs: resolveDurationMs(previous),
    });
    this.markCellTerminal(cellId, error);
  }

  hydrateCellState(cellId: string, state: AppDatabaseNotebookCellState): void {
    this.cellState.set(cellId, {
      state: state.state as NotebookCellExecutionState,
      output: state.outputs as NotebookOutput[],
      inputValues: state.inputValues,
      error: state.error,
      durationMs: state.durationMs,
      setupPhases: hydratePhases(state.setupPhases),
    });
    this.notifyChange("execution");
  }

  hasHydratedPersistedState(): boolean {
    return this.persistedStateHydrated;
  }

  restorePersistedState(
    state: Record<string, AppDatabaseNotebookCellState>,
    options: {
      trustAll?: boolean;
      getCellSourceHash?: (cell: NotebookDocument["cells"][number]) => string;
    } = {},
  ): void {
    let changed = false;
    const changedCellIds = new Set<string>();
    let restoredCellCount = 0;
    let staleRestoredCellCount = 0;

    if (!options.trustAll && options.getCellSourceHash) {
      for (const cell of this.document.cells) {
        const persistedCellState = state[cell.id];
        if (!persistedCellState?.sourceHash) {
          continue;
        }
        if (persistedCellState.sourceHash !== options.getCellSourceHash(cell)) {
          changedCellIds.add(cell.id);
        }
      }
    }

    const staleCellIds = new Set([
      ...changedCellIds,
      ...collectStaleDescendants(this.graph, changedCellIds),
    ]);

    for (const cell of this.document.cells) {
      const cellState = state[cell.id];
      if (!cellState) {
        continue;
      }
      const sourceHash = options.getCellSourceHash?.(cell);
      const canRestore = Boolean(
        options.trustAll ||
          !options.getCellSourceHash ||
          (cellState.sourceHash &&
            sourceHash &&
            cellState.sourceHash === sourceHash) ||
          staleCellIds.has(cell.id),
      );
      if (!canRestore) {
        continue;
      }

      const nextState = {
        state: staleCellIds.has(cell.id)
          ? "stale"
          : (cellState.state as NotebookCellExecutionState),
        output: cellState.outputs as NotebookOutput[],
        inputValues: staleCellIds.has(cell.id)
          ? undefined
          : cellState.inputValues,
        error: cellState.error,
        durationMs: cellState.durationMs,
        setupPhases: hydratePhases(cellState.setupPhases),
      } satisfies NotebookCellRuntimeState;

      const restoredOutput =
        (nextState.output?.length ?? 0) > 0 || Boolean(nextState.error);
      if (restoredOutput) {
        restoredCellCount += 1;
        if (staleCellIds.has(cell.id)) {
          staleRestoredCellCount += 1;
        }
      }

      if (
        !changed &&
        !cellStateEquals(this.cellState.get(cell.id), nextState)
      ) {
        changed = true;
      }

      this.cellState.set(cell.id, nextState);
      if (!staleCellIds.has(cell.id)) {
        this.restoreInputValues(cell.id, cellState.inputValues);
      }
    }

    this.persistedStateHydrated = true;
    this.outputStateSummary =
      restoredCellCount === 0
        ? { kind: "none", cellCount: 0 }
        : staleRestoredCellCount > 0
          ? {
              kind: "restored-stale",
              cellCount: restoredCellCount,
              staleCellCount: staleRestoredCellCount,
            }
          : { kind: "restored", cellCount: restoredCellCount };
    if (changed) {
      this.notifyChange("execution");
    }
  }

  markRunning(cellId: string, statusMessage?: string): void {
    const previous = this.getCellState(cellId);
    const startedAt = previous.startedAt ?? Date.now();
    this.cellState.set(cellId, {
      ...previous,
      state: "running",
      error: undefined,
      startedAt,
      scheduledAt: previous.scheduledAt ?? startedAt,
      statusMessage: statusMessage ?? previous.statusMessage,
    });
    this.executionState = {
      ...this.executionState,
      state: "running",
      runningCellId: cellId,
      scheduledCellIds: this.executionState.scheduledCellIds.filter(
        (id) => id !== cellId,
      ),
      statusMessage: statusMessage ?? this.executionState.statusMessage,
    };
    this.notifyChange("execution");
  }

  // Like markRunning but preserves existing outputs so the UI does not flash
  // blank while the cell is queued to run (e.g. during a full-notebook run
  // where cells are pre-marked before the worker starts executing).
  preMarkRunning(cellId: string): void {
    this.markRunning(cellId);
  }

  setStatusMessage(message?: string, cellId?: string): void {
    if (cellId) {
      const previous = this.getCellState(cellId);
      this.cellState.set(cellId, {
        ...previous,
        statusMessage: message,
      });
    }

    this.executionState = {
      ...this.executionState,
      statusMessage: message,
    };
    this.notifyChange("execution");
  }

  startPhase(
    key: string,
    label: string,
    cellId?: string,
    detail?: string,
  ): void {
    const startedAt = Date.now();
    const phase: NotebookExecutionPhase = {
      key,
      label,
      status: "running",
      startedAt,
      detail,
    };

    this.executionState = {
      ...this.executionState,
      statusMessage: detail ?? label,
      phases: upsertPhase(this.executionState.phases, phase),
    };

    if (cellId) {
      const previous = this.getCellState(cellId);
      this.cellState.set(cellId, {
        ...previous,
        statusMessage: detail ?? label,
        setupPhases: upsertPhase(previous.setupPhases ?? [], phase),
      });
    }

    this.notifyChange("execution");
  }

  finishPhase(
    key: string,
    cellId?: string,
    detail?: string,
    error?: string,
  ): void {
    const status: NotebookExecutionPhaseStatus = error ? "error" : "completed";
    this.executionState = {
      ...this.executionState,
      phases: completePhase(this.executionState.phases, key, status, detail),
      statusMessage: error ?? this.executionState.statusMessage,
    };

    if (cellId) {
      const previous = this.getCellState(cellId);
      this.cellState.set(cellId, {
        ...previous,
        setupPhases: completePhase(
          previous.setupPhases ?? [],
          key,
          status,
          detail,
        ),
        statusMessage: error ?? previous.statusMessage,
      });
    }

    this.notifyChange("execution");
  }

  clearCellOutput(cellId: string): void {
    this.invalidateCell(cellId);
    this.clearRuntimeDefinitionsForCell(cellId);
    this.cellState.set(cellId, { state: "idle" });
    if (!this.hasOutputs()) {
      this.outputStateSummary = { kind: "none", cellCount: 0 };
    }
    this.notifyChange("execution");
  }

  clearOutputs(): void {
    this.invalidateAllCells();
    this.runtimeValues.clear();
    for (const cell of this.document.cells) {
      this.cellState.set(cell.id, { state: "idle" });
    }
    this.executionState = createIdleExecutionState();
    this.outputStateSummary = { kind: "none", cellCount: 0 };
    this.notifyChange("execution");
  }

  hasOutputs(): boolean {
    return this.document.cells.some((cell) => {
      const state = this.getCellState(cell.id);
      return (state.output?.length ?? 0) > 0 || Boolean(state.error);
    });
  }

  private markCellTerminal(cellId: string, error?: string): void {
    const completedCellIds = this.executionState.completedCellIds.includes(
      cellId,
    )
      ? this.executionState.completedCellIds
      : [...this.executionState.completedCellIds, cellId];
    const nextState: NotebookExecutionRunState = {
      ...this.executionState,
      runningCellId:
        this.executionState.runningCellId === cellId
          ? undefined
          : this.executionState.runningCellId,
      completedCellIds,
      statusMessage: error ?? this.executionState.statusMessage,
    };

    if (shouldFinishExecution(nextState)) {
      this.executionState = createIdleExecutionState();
      this.outputStateSummary = {
        kind: "recomputed",
        cellCount: completedCellIds.length,
      };
    } else {
      this.executionState = nextState;
    }
    this.notifyChange("execution");
  }

  private notifyChange(reason: NotebookSessionChangeReason): void {
    this.onChange?.(reason);
  }

  private clearRuntimeDefinitionsForCell(
    cellId: string,
    options: {
      preserveInputValues?: boolean;
      preserveNames?: Set<string>;
    } = {},
  ): void {
    for (const [name, entry] of this.runtimeValues.entries()) {
      if (entry.cellId !== cellId || options.preserveNames?.has(name)) {
        continue;
      }
      this.runtimeValues.delete(name);
    }
    if (options.preserveInputValues) {
      return;
    }
    const previous = this.cellState.get(cellId);
    if (previous?.inputValues) {
      this.cellState.set(cellId, {
        ...previous,
        inputValues: undefined,
      });
    }
  }
}

function cellStateEquals(
  previous: NotebookCellRuntimeState | undefined,
  next: NotebookCellRuntimeState,
): boolean {
  return (
    stableStateStringify(previous ?? { state: "idle" }) ===
    stableStateStringify(next)
  );
}

function executionStateEquals(
  previous: NotebookExecutionRunState,
  next: NotebookExecutionRunState,
): boolean {
  return stableStateStringify(previous) === stableStateStringify(next);
}

function stableStateStringify(value: unknown): string {
  return JSON.stringify(value, (_key, entryValue) => {
    if (typeof entryValue === "bigint") {
      return entryValue.toString();
    }
    return entryValue;
  });
}

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function cloneCellState(
  state: NotebookCellRuntimeState,
): NotebookCellRuntimeState {
  return {
    ...state,
    output: state.output ? [...state.output] : undefined,
    inputValues: state.inputValues ? { ...state.inputValues } : undefined,
    setupPhases: state.setupPhases?.map((phase) => ({ ...phase })),
  };
}

function cloneExecutionState(
  state: NotebookExecutionRunState,
): NotebookExecutionRunState {
  return {
    ...state,
    scheduledCellIds: [...state.scheduledCellIds],
    completedCellIds: [...state.completedCellIds],
    phases: state.phases.map((phase) => ({ ...phase })),
  };
}

function resolveDurationMs(
  state: NotebookCellRuntimeState,
): number | undefined {
  if (!state.startedAt) {
    return state.durationMs;
  }

  return Math.max(0, Date.now() - state.startedAt);
}

function finalizePhases(
  phases: NotebookExecutionPhase[] | undefined,
): NotebookExecutionPhase[] | undefined {
  if (!phases || phases.length === 0) {
    return phases;
  }

  return phases.map((phase) => {
    if (phase.status !== "running") {
      return phase;
    }

    const endedAt = Date.now();
    return {
      ...phase,
      status: "completed",
      endedAt,
      durationMs: Math.max(0, endedAt - phase.startedAt),
    };
  });
}

function hydratePhases(
  phases: AppDatabaseNotebookExecutionPhaseState[] | undefined,
): NotebookExecutionPhase[] | undefined {
  return phases?.map((phase) => ({
    key: phase.key,
    label: phase.label,
    status: phase.status as NotebookExecutionPhaseStatus,
    startedAt: 0,
    durationMs: phase.durationMs,
    detail: phase.detail,
  }));
}

function upsertPhase(
  phases: NotebookExecutionPhase[],
  phase: NotebookExecutionPhase,
): NotebookExecutionPhase[] {
  const existingIndex = phases.findIndex((entry) => entry.key === phase.key);
  if (existingIndex === -1) {
    return [...phases, phase];
  }

  return phases.map((entry, index) =>
    index === existingIndex ? phase : entry,
  );
}

function completePhase(
  phases: NotebookExecutionPhase[],
  key: string,
  status: NotebookExecutionPhaseStatus,
  detail?: string,
): NotebookExecutionPhase[] {
  return phases.map((phase) => {
    if (phase.key !== key) {
      return phase;
    }

    const endedAt = Date.now();
    return {
      ...phase,
      status,
      detail: detail ?? phase.detail,
      endedAt,
      durationMs: Math.max(0, endedAt - phase.startedAt),
    };
  });
}

function shouldFinishExecution(state: NotebookExecutionRunState): boolean {
  return (
    state.runningCellId === undefined && state.scheduledCellIds.length === 0
  );
}

export function createIdleExecutionState(): NotebookExecutionRunState {
  return {
    state: "idle",
    scheduledCellIds: [],
    completedCellIds: [],
    phases: [],
  };
}

function findChangedCellIds(
  previous: NotebookDocument,
  next: NotebookDocument,
): Set<string> {
  const previousById = new Map(previous.cells.map((cell) => [cell.id, cell]));
  const changed = new Set<string>();

  for (const cell of next.cells) {
    const earlier = previousById.get(cell.id);
    if (
      !earlier ||
      earlier.source !== cell.source ||
      earlier.lang !== cell.lang
    ) {
      changed.add(cell.id);
    }
  }

  return changed;
}
