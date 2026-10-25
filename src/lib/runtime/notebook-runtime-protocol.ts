import type { AppDatabaseNotebookCellState } from "@lapis-notes/api";
import type {
  NotebookWorkerCommandMessage as BaseNotebookWorkerCommandMessage,
  NotebookWorkerCommandResponseMessage as BaseNotebookWorkerCommandResponseMessage,
  NotebookWorkerExecuteRequest as BaseNotebookWorkerExecuteRequest,
  NotebookWorkerExecuteResponse as BaseNotebookWorkerExecuteResponse,
  NotebookWorkerHostRequestMessage,
  NotebookWorkerHostRequestType,
  NotebookWorkerHostResponseMessage,
  NotebookWorkerIncomingMessage as BaseNotebookWorkerIncomingMessage,
  NotebookWorkerOutgoingMessage as BaseNotebookWorkerOutgoingMessage,
  NotebookWorkerProgressMessage as BaseNotebookWorkerProgressMessage,
} from "@lapis-notes/notebook-worker";
import type { NotebookDocument } from "../model/notebook-document";
import type {
  NotebookExecutionOptions,
  NotebookExecutionResult,
} from "./notebook-worker";
import type { NotebookExecutionProgressEvent } from "./notebook-session";

export type NotebookWorkerExecuteRequest = BaseNotebookWorkerExecuteRequest<
  NotebookDocument,
  NotebookExecutionOptions
>;
export type NotebookWorkerExecuteResponse = BaseNotebookWorkerExecuteResponse<
  NotebookExecutionResult,
  AppDatabaseNotebookCellState
>;
export type NotebookWorkerCommandMessage = BaseNotebookWorkerCommandMessage<
  NotebookDocument,
  NotebookExecutionOptions
>;
export type NotebookWorkerCommandResponseMessage =
  BaseNotebookWorkerCommandResponseMessage<
    NotebookExecutionResult,
    AppDatabaseNotebookCellState
  >;
export type NotebookWorkerProgressMessage =
  BaseNotebookWorkerProgressMessage<NotebookExecutionProgressEvent>;
export type {
  NotebookWorkerHostRequestMessage,
  NotebookWorkerHostRequestType,
  NotebookWorkerHostResponseMessage,
};
export type NotebookWorkerIncomingMessage = BaseNotebookWorkerIncomingMessage<
  NotebookDocument,
  NotebookExecutionOptions
>;
export type NotebookWorkerOutgoingMessage = BaseNotebookWorkerOutgoingMessage<
  NotebookExecutionResult,
  AppDatabaseNotebookCellState,
  NotebookExecutionProgressEvent
>;
