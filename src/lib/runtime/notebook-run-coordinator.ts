import type { NotebookDocument } from "../model/notebook-document";
import type {
  NotebookSession,
  NotebookExecutionPhase,
} from "./notebook-session";
import {
  resolveExecutionOrder,
  type NotebookExecutionOptions,
} from "./notebook-worker";
import {
  awaitNotebookTask,
  NotebookExecutionCancelledError,
  throwIfNotebookAborted,
} from "./notebook-cancellation";

export type NotebookRunOutcome =
  | "running"
  | "succeeded"
  | "failed"
  | "cancelled";
export interface NotebookRunSummary {
  id: number;
  sourcePath: string;
  outcome: NotebookRunOutcome;
  plannedCellIds: string[];
  completedCellIds: string[];
  runningCellId?: string;
  startedAt: number;
  endedAt?: number;
  phases: NotebookExecutionPhase[];
  errors: { cellId?: string; message: string }[];
}
type ActiveRun = {
  id: number;
  controller: AbortController;
  session: NotebookSession;
  promise: Promise<unknown>;
};
type Executor = (
  document: NotebookDocument,
  session: NotebookSession,
  options: NotebookExecutionOptions,
) => Promise<unknown>;

/** One execution lease per notebook. Terminal feedback outlives transient cell state. */
export class NotebookRunCoordinator {
  private sequence = 0;
  private readonly active = new Map<string, ActiveRun>();
  private readonly summaries = new Map<string, NotebookRunSummary>();
  private readonly listeners = new Set<
    (summary?: NotebookRunSummary) => void
  >();
  constructor(
    private readonly execute: Executor,
    private readonly terminate: (path: string) => Promise<void>,
  ) {}

  get(path: string): NotebookRunSummary | undefined {
    return this.summaries.get(path);
  }
  isRunning(path: string): boolean {
    return this.active.has(path);
  }
  subscribe(listener: (summary?: NotebookRunSummary) => void): () => void {
    this.listeners.add(listener);
    listener();
    return () => {
      this.listeners.delete(listener);
    };
  }
  private publish(summary: NotebookRunSummary): void {
    this.summaries.set(summary.sourcePath, summary);
    for (const listener of this.listeners) listener(summary);
  }
  update(path: string): void {
    const active = this.active.get(path),
      summary = this.get(path);
    if (!active || !summary || active.controller.signal.aborted) return;
    const execution = active.session.getExecutionState();
    const states = summary.plannedCellIds.map((cellId) => ({
      cellId,
      state: active.session.getCellState(cellId),
    }));
    this.publish({
      ...summary,
      completedCellIds: states
        .filter(
          ({ state }) => state.state === "completed" || state.state === "error",
        )
        .map(({ cellId }) => cellId),
      runningCellId: execution.runningCellId,
      phases: execution.phases.length ? execution.phases : summary.phases,
      errors: states
        .filter(({ state }) => Boolean(state.error))
        .map(({ cellId, state }) => ({ cellId, message: state.error! })),
    });
  }
  run(
    document: NotebookDocument,
    session: NotebookSession,
    options: NotebookExecutionOptions = {},
  ): Promise<unknown> {
    const path = document.sourcePath ?? "__untitled__";
    const existing = this.active.get(path);
    if (existing) return existing.promise;
    const id = ++this.sequence,
      controller = new AbortController();
    const plannedCellIds = resolveExecutionOrder(document, session, options);
    const active: ActiveRun = {
      id,
      controller,
      session,
      promise: Promise.resolve(),
    };
    this.active.set(path, active);
    this.publish({
      id,
      sourcePath: path,
      outcome: "running",
      plannedCellIds,
      completedCellIds: [],
      startedAt: Date.now(),
      phases: [],
      errors: [],
    });
    active.promise = awaitNotebookTask(
      Promise.resolve().then(() => {
        throwIfNotebookAborted(controller.signal);
        return this.execute(document, session, {
          ...options,
          signal: controller.signal,
        });
      }),
      controller.signal,
    )
      .then((result) => {
        throwIfNotebookAborted(controller.signal);
        this.update(path);
        const summary = this.get(path)!;
        this.publish({
          ...summary,
          runningCellId: undefined,
          endedAt: Date.now(),
          outcome: summary.errors.length ? "failed" : "succeeded",
        });
        return result;
      })
      .catch((error: unknown) => {
        this.update(path);
        const summary = this.get(path)!;
        const cancelled =
          controller.signal.aborted ||
          error instanceof NotebookExecutionCancelledError;
        this.publish({
          ...summary,
          runningCellId: undefined,
          endedAt: Date.now(),
          outcome: cancelled ? "cancelled" : "failed",
          errors: cancelled
            ? []
            : [
                ...summary.errors,
                {
                  message:
                    error instanceof Error ? error.message : String(error),
                },
              ],
        });
        throw error;
      })
      .finally(() => {
        if (this.active.get(path)?.id === id) this.active.delete(path);
      });
    return active.promise;
  }
  async cancel(path: string): Promise<boolean> {
    const run = this.active.get(path);
    if (!run) return false;
    run.controller.abort();
    run.session.invalidateAllCells();
    // A slow resource shutdown must not keep an unresolved cell promise alive.
    void this.terminate(path).catch(() => undefined);
    await run.promise.catch(() => undefined);
    return true;
  }
  destroy(): void {
    this.listeners.clear();
    void Promise.all(
      [...this.active.keys()].map((path) => this.cancel(path)),
    ).then(() => this.summaries.clear());
  }
}
