import { NotebookWorkerHostRequestBroker } from "./host-request-broker";
import type {
  NotebookWorkerCommandMessage,
  NotebookWorkerCommandResponseMessage,
  NotebookWorkerExecuteRequest,
  NotebookWorkerExecuteResponse,
  NotebookWorkerIncomingMessage,
  NotebookWorkerOutgoingMessage,
} from "./protocol";

export type NotebookWorkerShellPoster<
  TExecutionResult extends object = Record<string, unknown>,
  TCellState = unknown,
  TProgressEvent = unknown,
> = (
  message: NotebookWorkerOutgoingMessage<
    TExecutionResult,
    TCellState,
    TProgressEvent
  >,
) => void;

export interface NotebookWorkerShellCommandContext<TProgressEvent = unknown> {
  commandId: string;
  hostRequests: NotebookWorkerHostRequestBroker;
  postProgress: (event: TProgressEvent) => void;
}

export type NotebookWorkerShellExecute<
  TDocument = unknown,
  TExecutionOptions = unknown,
  TExecutionResult extends object = Record<string, unknown>,
  TCellState = unknown,
  TProgressEvent = unknown,
> = (
  request: NotebookWorkerExecuteRequest<TDocument, TExecutionOptions>,
  context: NotebookWorkerShellCommandContext<TProgressEvent>,
) =>
  | NotebookWorkerExecuteResponse<TExecutionResult, TCellState>
  | Promise<NotebookWorkerExecuteResponse<TExecutionResult, TCellState>>;

export interface NotebookWorkerShellOptions<
  TDocument = unknown,
  TExecutionOptions = unknown,
  TExecutionResult extends object = Record<string, unknown>,
  TCellState = unknown,
  TProgressEvent = unknown,
> {
  postMessage: NotebookWorkerShellPoster<
    TExecutionResult,
    TCellState,
    TProgressEvent
  >;
  execute: NotebookWorkerShellExecute<
    TDocument,
    TExecutionOptions,
    TExecutionResult,
    TCellState,
    TProgressEvent
  >;
  createHostRequestId?: () => string;
}

export class NotebookWorkerShell<
  TDocument = unknown,
  TExecutionOptions = unknown,
  TExecutionResult extends object = Record<string, unknown>,
  TCellState = unknown,
  TProgressEvent = unknown,
> {
  readonly hostRequests: NotebookWorkerHostRequestBroker;

  constructor(
    private readonly options: NotebookWorkerShellOptions<
      TDocument,
      TExecutionOptions,
      TExecutionResult,
      TCellState,
      TProgressEvent
    >,
  ) {
    this.hostRequests = new NotebookWorkerHostRequestBroker(
      (request) => this.options.postMessage(request),
      options.createHostRequestId
        ? { createId: options.createHostRequestId }
        : {},
    );
  }

  async handleMessage(
    message: NotebookWorkerIncomingMessage<TDocument, TExecutionOptions>,
  ): Promise<boolean> {
    if (message.channel === "host-response") {
      return this.hostRequests.settle(message);
    }

    if (message.channel === "command") {
      await this.handleCommand(message);
      return true;
    }

    return false;
  }

  private async handleCommand(
    message: NotebookWorkerCommandMessage<TDocument, TExecutionOptions>,
  ): Promise<void> {
    const response: NotebookWorkerCommandResponseMessage<
      TExecutionResult,
      TCellState
    > = {
      channel: "command-response",
      id: message.id,
      success: true,
    };

    try {
      switch (message.type) {
        case "execute":
          response.result = await this.options.execute(
            message.data,
            this.createCommandContext(message.id),
          );
          break;
        default:
          throw new Error(
            `Unsupported notebook worker command: ${message.type}`,
          );
      }
    } catch (error) {
      response.success = false;
      response.error = error instanceof Error ? error.message : String(error);
    }

    this.options.postMessage(response);
  }

  private createCommandContext(
    commandId: string,
  ): NotebookWorkerShellCommandContext<TProgressEvent> {
    return {
      commandId,
      hostRequests: this.hostRequests,
      postProgress: (event) => {
        this.options.postMessage({
          channel: "progress",
          id: commandId,
          event,
        });
      },
    };
  }
}
