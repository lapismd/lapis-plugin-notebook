import { EventDispatcher, type EventRef } from "@lapis-notes/api";
import type { NotebookDocument } from "../model/notebook-document";
import {
  createIdleExecutionState,
  type NotebookCellRuntimeState,
  type NotebookExecutionCheckpoint,
  type NotebookExecutionRunState,
  type NotebookOutputStateSummary,
  type NotebookSessionChangeReason,
  type NotebookSession,
} from "./notebook-session";
import { NotebookSessionManager } from "./notebook-session-manager";
import { collectStaleDescendants, type NotebookGraph } from "./notebook-graph";
import {
  describeExecutionStart,
  resolveExecutionOrder,
  type NotebookExecutionOptions,
} from "./notebook-worker";

export interface NotebookRuntimeSnapshot {
  readonly sourcePath: string;
  readonly session?: NotebookSession;
  readonly executionState: NotebookExecutionRunState;
  readonly outputState: NotebookOutputStateSummary;
}

export interface NotebookPreparedExecution {
  readonly sourcePath: string;
  readonly session: NotebookSession;
  readonly executionOrder: string[];
  readonly checkpoint: NotebookExecutionCheckpoint | null;
}

export interface NotebookRuntimeGraphSnapshot {
  readonly sourcePath: string;
  readonly graph: NotebookGraph;
  getCellState(cellId: string): NotebookCellRuntimeState;
}

export class NotebookRuntimeController extends EventDispatcher<{
  changed: [
    sourcePath: string,
    reason: NotebookSessionChangeReason,
    snapshot: NotebookRuntimeSnapshot,
  ];
}> {
  private readonly sessionChangeRef: EventRef<
    { changed: [sourcePath: string, reason: NotebookSessionChangeReason] },
    "changed"
  >;

  constructor(private readonly sessions = new NotebookSessionManager()) {
    super();
    this.sessionChangeRef = this.sessions.on(
      "changed",
      (sourcePath, reason) => {
        this.trigger(
          "changed",
          sourcePath,
          reason,
          this.getSnapshot(sourcePath),
        );
      },
    );
  }

  getOrCreateSession(document: NotebookDocument): NotebookSession {
    return this.sessions.getOrCreate(document);
  }

  getSession(sourcePath: string): NotebookSession | undefined {
    return this.sessions.get(sourcePath);
  }

  getExecutionState(sourcePath: string): NotebookExecutionRunState {
    return this.sessions.getExecutionState(sourcePath);
  }

  updateInputValue(
    sourcePath: string | undefined,
    cellId: string,
    name: string,
    value: unknown,
  ): string[] {
    if (!sourcePath) {
      return [];
    }

    const session = this.getSession(sourcePath);
    if (!session) {
      return [];
    }

    session.setInputValue(cellId, name, value);
    return collectStaleDescendants(session.graph, [cellId]);
  }

  prepareExecution(
    document: NotebookDocument,
    options: Pick<
      NotebookExecutionOptions,
      "cellIds" | "skipDependencyClosure"
    > = {},
  ): NotebookPreparedExecution {
    const sourcePath = document.sourcePath ?? "__untitled__";
    const session = this.getOrCreateSession(document);
    const executionOrder = resolveExecutionOrder(document, session, options);
    const checkpoint =
      executionOrder.length > 0
        ? session.createExecutionCheckpoint(executionOrder)
        : null;

    if (executionOrder.length > 0) {
      session.beginExecution(
        executionOrder,
        describeExecutionStart(executionOrder.length),
      );
      session.markRunning(executionOrder[0], `Preparing ${executionOrder[0]}`);
    }

    return {
      sourcePath,
      session,
      executionOrder,
      checkpoint,
    };
  }

  restoreExecutionCheckpoint(
    sourcePath: string,
    checkpoint: NotebookExecutionCheckpoint | null | undefined,
  ): void {
    if (!checkpoint) {
      return;
    }

    this.getSession(sourcePath)?.restoreExecutionCheckpoint(checkpoint);
  }

  clearOutputs(sourcePath: string): void {
    this.getSession(sourcePath)?.clearOutputs();
  }

  clearCellOutput(document: NotebookDocument, cellId: string): void {
    this.getOrCreateSession(document).clearCellOutput(cellId);
  }

  hasOutputs(document: NotebookDocument): boolean {
    return this.getOrCreateSession(document).hasOutputs();
  }

  getCellState(
    document: NotebookDocument,
    cellId: string,
  ): NotebookCellRuntimeState {
    return this.getOrCreateSession(document).getCellState(cellId);
  }

  getInputValue(sourcePath: string, name: string): unknown {
    return this.getSession(sourcePath)?.getInputValue(name);
  }

  getStaleCellIds(document: NotebookDocument): string[] {
    const session = this.getOrCreateSession(document);
    return document.cells
      .filter((cell) => session.getCellState(cell.id).state === "stale")
      .map((cell) => cell.id);
  }

  getOrCreateGraphSnapshot(
    document: NotebookDocument,
  ): NotebookRuntimeGraphSnapshot {
    const sourcePath = document.sourcePath ?? "__untitled__";
    const session = this.getOrCreateSession(document);
    return {
      sourcePath,
      graph: session.graph,
      getCellState: (cellId) => session.getCellState(cellId),
    };
  }

  getOrCreateSnapshot(document: NotebookDocument): NotebookRuntimeSnapshot {
    const session = this.getOrCreateSession(document);
    return createNotebookRuntimeSnapshot(
      document.sourcePath ?? "__untitled__",
      session,
    );
  }

  getSnapshot(sourcePath: string): NotebookRuntimeSnapshot {
    return createNotebookRuntimeSnapshot(
      sourcePath,
      this.getSession(sourcePath),
    );
  }

  subscribe(
    sourcePath: string,
    listener: (snapshot: NotebookRuntimeSnapshot) => void,
    options: { emitCurrent?: boolean } = {},
  ): () => void {
    const ref = this.on("changed", (changedSourcePath, _reason, snapshot) => {
      if (changedSourcePath !== sourcePath) {
        return;
      }
      listener(snapshot);
    });
    if (options.emitCurrent !== false) {
      listener(this.getSnapshot(sourcePath));
    }
    return () => this.offref(ref);
  }

  delete(sourcePath: string): void {
    this.sessions.delete(sourcePath);
  }

  destroy(): void {
    this.sessions.offref(this.sessionChangeRef);
  }
}

function createNotebookRuntimeSnapshot(
  sourcePath: string,
  session?: NotebookSession,
): NotebookRuntimeSnapshot {
  return {
    sourcePath,
    session,
    executionState: session?.getExecutionState() ?? createIdleExecutionState(),
    outputState: session?.getOutputStateSummary() ?? {
      kind: "none",
      cellCount: 0,
    },
  };
}
