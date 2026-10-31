import {
  getNotebookInputMetadata,
  type NotebookInputMetadata,
} from "./dom-runtime";
import {
  settleNotebookInputState,
  snapshotNotebookInputState,
} from "./input-state";
import { bindNotebookInputNode, getNotebookInputNodeValue } from "./input-node";

export interface NotebookViewInputChange {
  sourcePath?: string;
  cellId: string;
  name: string;
  value: unknown;
}

export interface NotebookViewDomOutputRegistration {
  outputId: string;
  sourcePath?: string;
  cellId: string;
  name: string;
  role: "input";
  node: Node;
  dispose: () => void;
}

export interface CreateNotebookViewRuntimeOptions<TOutput> {
  cellId?: string;
  sourcePath?: string;
  signal?: AbortSignal;
  getInputValue: (name: string) => unknown;
  setInputValue: (cellId: string, name: string, value: unknown) => void;
  emitInputChange: (event: NotebookViewInputChange) => void;
  createOutputId: (cellId: string, name: string) => string;
  registerOutput: (registration: NotebookViewDomOutputRegistration) => void;
  createOutput: (options: {
    outputId: string;
    cellId: string;
    label: string;
    role: "input";
    metadata?: NotebookInputMetadata;
  }) => TOutput;
  appendOutput: (output: TOutput) => void;
}

export function createNotebookViewRuntime<TOutput>(
  options: CreateNotebookViewRuntimeOptions<TOutput>,
): (name: string, input: unknown) => Promise<unknown> {
  return async (name: string, input: unknown) => {
    const cellId = options.cellId;
    if (!cellId) {
      throw new Error("Observable inputs require a notebook cell id");
    }

    const node = await Promise.resolve(input);
    if (!isNotebookDomNode(node)) {
      throw new TypeError(`view(${name}, ...) must resolve to a DOM node`);
    }

    const outputId = options.createOutputId(cellId, name);
    const metadata = getNotebookInputMetadata(node);
    const binding = bindNotebookInputNode(node, {
      initialValue: options.getInputValue(name),
      onChange: (value) => {
        if (options.signal?.aborted) return;
        options.setInputValue(cellId, name, value);
        options.emitInputChange({
          sourcePath: options.sourcePath,
          cellId,
          name,
          value,
        });
      },
    });
    await settleNotebookInputState(node);
    if (options.signal?.aborted) {
      binding.dispose();
      throw new DOMException("Notebook input cancelled", "AbortError");
    }
    binding.currentValue = getNotebookInputNodeValue(node);
    options.setInputValue(cellId, name, binding.currentValue);

    options.registerOutput({
      outputId,
      sourcePath: options.sourcePath,
      cellId,
      name,
      role: "input",
      node,
      dispose: binding.dispose,
    });

    const output = options.createOutput({
      outputId,
      cellId,
      label: name,
      role: "input",
      metadata: metadata
        ? {
            ...metadata,
            value: snapshotNotebookInputState(node),
          }
        : undefined,
    });
    options.appendOutput(output);
    return binding.currentValue;
  };
}

export function isNotebookDomNode(value: unknown): value is Node {
  return typeof Node !== "undefined" && value instanceof Node;
}
