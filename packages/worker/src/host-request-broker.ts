import type {
  NotebookWorkerHostRequestMessage,
  NotebookWorkerHostRequestType,
  NotebookWorkerHostResponseMessage,
} from "./protocol";

export interface NotebookWorkerHostRequestBrokerOptions {
  createId?: () => string;
}

export type NotebookWorkerHostRequestPoster = (
  message: NotebookWorkerHostRequestMessage,
) => void;

export class NotebookWorkerHostRequestBroker {
  private nextHostRequestId = 0;
  private readonly pendingHostRequests = new Map<
    string,
    { resolve: (value: unknown) => void; reject: (reason?: unknown) => void }
  >();

  constructor(
    private readonly postRequest: NotebookWorkerHostRequestPoster,
    private readonly options: NotebookWorkerHostRequestBrokerOptions = {},
  ) {}

  get pendingCount(): number {
    return this.pendingHostRequests.size;
  }

  request<T>(
    type: NotebookWorkerHostRequestType,
    data: Record<string, unknown>,
  ): Promise<T> {
    const id = this.options.createId?.() ?? this.createId();
    const request: NotebookWorkerHostRequestMessage = {
      channel: "host-request",
      id,
      type,
      data,
    };

    this.postRequest(request);
    return new Promise<T>((resolve, reject) => {
      this.pendingHostRequests.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
      });
    });
  }

  settle(message: NotebookWorkerHostResponseMessage): boolean {
    const pending = this.pendingHostRequests.get(message.id);
    if (!pending) {
      return false;
    }

    this.pendingHostRequests.delete(message.id);
    if (message.success) {
      pending.resolve(message.result);
      return true;
    }

    pending.reject(new Error(message.error ?? "Notebook host request failed"));
    return true;
  }

  rejectAll(reason?: unknown): void {
    this.pendingHostRequests.forEach(({ reject }) => reject(reason));
    this.pendingHostRequests.clear();
  }

  private createId(): string {
    return `host_${++this.nextHostRequestId}_${Date.now()}`;
  }
}
