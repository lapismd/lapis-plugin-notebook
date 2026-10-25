export type NotebookDomOutputRole = "input" | "html" | "svg" | "dom";

export interface NotebookDomOutputRegistration {
  outputId: string;
  sourcePath?: string;
  cellId: string;
  name?: string;
  role: NotebookDomOutputRole;
  node: Node;
  dispose?: () => void;
}

export interface NotebookInputChangeEvent {
  sourcePath?: string;
  cellId: string;
  name: string;
  value: unknown;
}

const domOutputs = new Map<string, NotebookDomOutputRegistration>();
const inputChangeListeners = new Set<
  (event: NotebookInputChangeEvent) => void | Promise<void>
>();
let nextDomOutputId = 0;

export function createNotebookDomOutputId(
  cellId: string,
  name?: string,
): string {
  nextDomOutputId += 1;
  return `dom_${sanitizeIdPart(cellId)}_${sanitizeIdPart(name ?? "output")}_${nextDomOutputId}`;
}

export function registerNotebookDomOutput(
  registration: NotebookDomOutputRegistration,
): void {
  domOutputs.get(registration.outputId)?.dispose?.();
  domOutputs.set(registration.outputId, registration);
}

export function claimNotebookDomOutput(outputId: string): Node | null {
  return domOutputs.get(outputId)?.node ?? null;
}

export function claimNotebookInputDomOutput(
  sourcePath: string | undefined,
  cellId: string,
  name: string,
): Node | null {
  let claimedNode: Node | null = null;
  for (const registration of domOutputs.values()) {
    if (
      registration.sourcePath !== sourcePath ||
      registration.cellId !== cellId ||
      registration.name !== name ||
      registration.role !== "input"
    ) {
      continue;
    }
    claimedNode = registration.node;
  }
  return claimedNode;
}

export function clearNotebookDomOutputsForCell(
  sourcePath: string | undefined,
  cellId: string,
  options: { exceptOutputIds?: ReadonlySet<string> } = {},
): void {
  for (const [outputId, registration] of domOutputs.entries()) {
    if (
      registration.cellId !== cellId ||
      registration.sourcePath !== sourcePath
    ) {
      continue;
    }
    if (options.exceptOutputIds?.has(outputId)) {
      continue;
    }
    registration.dispose?.();
    domOutputs.delete(outputId);
  }
}

export function clearNotebookDomOutputsForSource(sourcePath: string): void {
  for (const [outputId, registration] of domOutputs.entries()) {
    if (registration.sourcePath !== sourcePath) {
      continue;
    }
    registration.dispose?.();
    domOutputs.delete(outputId);
  }
}

export function subscribeNotebookInputChanges(
  listener: (event: NotebookInputChangeEvent) => void | Promise<void>,
): () => void {
  inputChangeListeners.add(listener);
  return () => {
    inputChangeListeners.delete(listener);
  };
}

export function emitNotebookInputChange(event: NotebookInputChangeEvent): void {
  for (const listener of inputChangeListeners) {
    void listener(event);
  }
}

function sanitizeIdPart(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "_");
}
