export const NOTEBOOK_WORKER_CHANNELS = [
  "command",
  "command-response",
  "progress",
  "host-request",
  "host-response",
] as const;

export interface NotebookWorkerExecuteRequest<
  TDocument = unknown,
  TExecutionOptions = unknown,
> {
  document: TDocument;
  cellIds?: string[];
  options?: TExecutionOptions;
}

export type NotebookWorkerExecuteResponse<
  TExecutionResult extends object = Record<string, unknown>,
  TCellState = unknown,
> = TExecutionResult & {
  cellStates: Record<string, TCellState>;
};

export type NotebookWorkerCommandType = "execute";

export interface NotebookWorkerCommandMessage<
  TDocument = unknown,
  TExecutionOptions = unknown,
> {
  channel: "command";
  id: string;
  type: NotebookWorkerCommandType;
  data: NotebookWorkerExecuteRequest<TDocument, TExecutionOptions>;
}

export interface NotebookWorkerCommandResponseMessage<
  TExecutionResult extends object = Record<string, unknown>,
  TCellState = unknown,
> {
  channel: "command-response";
  id: string;
  success: boolean;
  result?: NotebookWorkerExecuteResponse<TExecutionResult, TCellState>;
  error?: string;
}

export interface NotebookWorkerProgressMessage<TProgressEvent = unknown> {
  channel: "progress";
  id: string;
  event: TProgressEvent;
}

export type NotebookWorkerHostRequestType =
  | "get-app-tables"
  | "read-vault-file"
  | "resolve-plugin-asset-url";

export interface NotebookWorkerHostRequestMessage {
  channel: "host-request";
  id: string;
  type: NotebookWorkerHostRequestType;
  data: Record<string, unknown>;
}

export interface NotebookWorkerHostResponseMessage {
  channel: "host-response";
  id: string;
  success: boolean;
  result?: unknown;
  error?: string;
}

export type NotebookWorkerIncomingMessage<
  TDocument = unknown,
  TExecutionOptions = unknown,
> =
  | NotebookWorkerCommandMessage<TDocument, TExecutionOptions>
  | NotebookWorkerHostResponseMessage;

export type NotebookWorkerOutgoingMessage<
  TExecutionResult extends object = Record<string, unknown>,
  TCellState = unknown,
  TProgressEvent = unknown,
> =
  | NotebookWorkerCommandResponseMessage<TExecutionResult, TCellState>
  | NotebookWorkerProgressMessage<TProgressEvent>
  | NotebookWorkerHostRequestMessage;
