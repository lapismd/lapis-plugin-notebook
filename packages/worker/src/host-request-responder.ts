import type {
  NotebookWorkerHostRequestMessage,
  NotebookWorkerHostResponseMessage,
} from "./protocol";

export type NotebookWorkerHostRequestResolver = (
  message: NotebookWorkerHostRequestMessage,
) => unknown | Promise<unknown>;

export type NotebookWorkerHostResponsePoster = (
  response: NotebookWorkerHostResponseMessage,
  transfer: Transferable[],
) => void;

export interface NotebookWorkerResolvedHostResponse {
  response: NotebookWorkerHostResponseMessage;
  transfer: Transferable[];
}

export interface NotebookWorkerHostRequestResponderOptions {
  resolve: NotebookWorkerHostRequestResolver;
  getTransferList?: (result: unknown) => Transferable[];
}

export class NotebookWorkerHostRequestResponder {
  constructor(
    private readonly options: NotebookWorkerHostRequestResponderOptions,
  ) {}

  async createResponse(
    message: NotebookWorkerHostRequestMessage,
  ): Promise<NotebookWorkerResolvedHostResponse> {
    const response: NotebookWorkerHostResponseMessage = {
      channel: "host-response",
      id: message.id,
      success: true,
    };

    try {
      response.result = await this.options.resolve(message);
    } catch (error) {
      response.success = false;
      response.error = error instanceof Error ? error.message : String(error);
    }

    return {
      response,
      transfer: response.success ? this.getTransferList(response.result) : [],
    };
  }

  async respond(
    message: NotebookWorkerHostRequestMessage,
    postResponse: NotebookWorkerHostResponsePoster,
  ): Promise<void> {
    const { response, transfer } = await this.createResponse(message);
    postResponse(response, transfer);
  }

  private getTransferList(result: unknown): Transferable[] {
    return (
      this.options.getTransferList?.(result) ??
      getNotebookWorkerTransferList(result)
    );
  }
}

export function getNotebookWorkerTransferList(result: unknown): Transferable[] {
  return result instanceof ArrayBuffer ? [result] : [];
}
