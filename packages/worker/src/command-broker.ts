import type {
  NotebookWorkerCommandMessage,
  NotebookWorkerCommandType,
  NotebookWorkerExecuteRequest,
} from "./protocol";

export interface NotebookWorkerCommandBrokerOptions {
  createId?: () => string;
}

export interface NotebookWorkerPendingCommand<TValue, TContext> {
  context: TContext;
  resolve: (value: TValue) => void;
  reject: (reason?: unknown) => void;
}

export interface NotebookWorkerQueuedCommand<
  TValue,
  TContext,
  TDocument,
  TExecutionOptions,
> {
  id: string;
  message: NotebookWorkerCommandMessage<TDocument, TExecutionOptions>;
  promise: Promise<TValue>;
  context: TContext;
}

export class NotebookWorkerCommandBroker<TValue, TContext = undefined> {
  private nextCommandId = 0;
  private readonly pendingCommands = new Map<
    string,
    NotebookWorkerPendingCommand<TValue, TContext>
  >();

  constructor(
    private readonly options: NotebookWorkerCommandBrokerOptions = {},
  ) {}

  get pendingCount(): number {
    return this.pendingCommands.size;
  }

  create<TDocument, TExecutionOptions>(
    type: NotebookWorkerCommandType,
    data: NotebookWorkerExecuteRequest<TDocument, TExecutionOptions>,
    context: TContext,
  ): NotebookWorkerQueuedCommand<
    TValue,
    TContext,
    TDocument,
    TExecutionOptions
  > {
    const id = this.options.createId?.() ?? this.createId();
    const message: NotebookWorkerCommandMessage<TDocument, TExecutionOptions> =
      {
        channel: "command",
        id,
        type,
        data,
      };

    let resolveCommand!: (value: TValue) => void;
    let rejectCommand!: (reason?: unknown) => void;
    const promise = new Promise<TValue>((resolve, reject) => {
      resolveCommand = resolve;
      rejectCommand = reject;
    });
    this.pendingCommands.set(id, {
      context,
      resolve: resolveCommand,
      reject: rejectCommand,
    });

    return { id, message, promise, context };
  }

  contextFor(id: string): TContext | undefined {
    return this.pendingCommands.get(id)?.context;
  }

  take(id: string): NotebookWorkerPendingCommand<TValue, TContext> | null {
    const pending = this.pendingCommands.get(id);
    if (!pending) {
      return null;
    }

    this.pendingCommands.delete(id);
    return pending;
  }

  rejectAll(reason?: unknown): void {
    this.pendingCommands.forEach(({ reject }) => reject(reason));
    this.pendingCommands.clear();
  }

  private createId(): string {
    return `cmd_${++this.nextCommandId}_${Date.now()}`;
  }
}
