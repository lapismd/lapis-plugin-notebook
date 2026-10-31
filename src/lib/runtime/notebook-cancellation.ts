/** A cancelled run is not a failed cell. */
export class NotebookExecutionCancelledError extends Error {
  constructor() {
    super("Notebook execution cancelled");
    this.name = "AbortError";
  }
}
export function throwIfNotebookAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw new NotebookExecutionCancelledError();
}
/** Observe both settlement paths even after abort, so late rejections are handled. */
export function awaitNotebookTask<T>(
  task: Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (!signal) return task;
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new NotebookExecutionCancelledError());
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
    task
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}
