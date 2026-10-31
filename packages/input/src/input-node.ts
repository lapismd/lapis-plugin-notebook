import { disposeNotebookInput, restoreNotebookInputState } from "./input-state";

export interface NotebookInputNodeBinding {
  currentValue: unknown;
  dispose: () => void;
}

export interface BindNotebookInputNodeOptions {
  initialValue?: unknown;
  onChange?: (value: unknown) => void;
}

export function bindNotebookInputNode(
  node: Node,
  options: BindNotebookInputNodeOptions = {},
): NotebookInputNodeBinding {
  if (options.initialValue !== undefined) {
    setNotebookInputNodeValue(node, options.initialValue);
  }

  const listener = () => {
    options.onChange?.(getNotebookInputNodeValue(node));
  };

  node.addEventListener("input", listener);
  node.addEventListener("change", listener);

  return {
    currentValue: getNotebookInputNodeValue(node),
    dispose: () => {
      node.removeEventListener("input", listener);
      node.removeEventListener("change", listener);
      disposeNotebookInput(node);
    },
  };
}

export function getNotebookInputNodeValue(node: Node): unknown {
  return "value" in node ? (node as { value: unknown }).value : undefined;
}

export function setNotebookInputNodeValue(node: Node, value: unknown): void {
  if (restoreNotebookInputState(node, value)) return;
  if (!("value" in node)) {
    return;
  }

  try {
    (node as { value: unknown }).value = value;
  } catch {
    // Some native inputs, notably file inputs, reject programmatic values.
  }
}
