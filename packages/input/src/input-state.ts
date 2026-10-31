export interface NotebookInputSnapshotOptions {
  transient?: boolean;
}

export interface NotebookInputState {
  restore(value: unknown): void;
  ready?(): Promise<void>;
  snapshot(options?: NotebookInputSnapshotOptions): unknown;
  dispose(): void;
}

const states = new WeakMap<object, NotebookInputState>();
const disposed = new WeakSet<object>();

export function registerNotebookInputState(
  node: object,
  state: NotebookInputState,
) {
  states.set(node, state);
}

export function attachNotebookInputView(node: object, destroy: () => void) {
  const state = states.get(node);
  if (!state) throw new Error("Input view has no owner");
  states.set(node, {
    ...state,
    dispose() {
      state.dispose();
      destroy();
    },
  });
}

export function restoreNotebookInputState(
  node: object,
  value: unknown,
): boolean {
  const state = states.get(node);
  if (!state) return false;
  state.restore(value);
  return true;
}

/** Wait for private asynchronous restoration without assigning a native FileList. */
export async function settleNotebookInputState(node: object): Promise<void> {
  await states.get(node)?.ready?.();
}

export function snapshotNotebookInputState(
  node: Node,
  options?: NotebookInputSnapshotOptions,
): unknown {
  return (
    states.get(node)?.snapshot(options) ??
    (node as Node & { value?: unknown }).value
  );
}

export function disposeNotebookInput(node: Node): void {
  if (disposed.has(node)) return;
  disposed.add(node);
  const state = states.get(node);
  if (state) state.dispose();
  else
    (
      node as Node & { __lapisNotebookInputDispose?: () => void }
    ).__lapisNotebookInputDispose?.();
}

export type NotebookInputSnapshot = {
  __notebookInputState: 1;
  factory: string;
  value?: unknown;
  ids?: string[];
  query?: string;
  children?: unknown[] | Record<string, unknown>;
};

export function isNotebookInputSnapshot(
  value: unknown,
): value is NotebookInputSnapshot {
  return Boolean(
    value &&
      typeof value === "object" &&
      (value as NotebookInputSnapshot).__notebookInputState === 1,
  );
}
