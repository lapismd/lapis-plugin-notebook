// Reached only through ui-runtime's dynamic import after DOM capability checks.
import { mount, unmount } from "svelte";
import { createNotebookModelProps } from "./control-props.svelte";
import ExtraInputControl from "./ExtraInputControl.svelte";
import FileInputControl from "./FileInputControl.svelte";
import {
  createExtraInput,
  getExtraInputModel,
  type ExtraInputKind,
} from "./extra-model";
import { createFileInput, getNotebookFileModel } from "./file-model";
import { attachNotebookInputView, disposeNotebookInput } from "./input-state";
import type { NotebookInputHostContext } from "./host-context";

export function createExtraNotebookInputs(context: NotebookInputHostContext) {
  const create = (kind: ExtraInputKind | "file", args: any[]) => {
    if (context.signal?.aborted)
      throw new DOMException("Notebook input cancelled", "AbortError");
    const node = (
      kind === "file"
        ? createFileInput(args[0], context)
        : createExtraInput(kind, args, context)
    ) as HTMLElement;
    node.className = `lapis-notebook-input lapis-notebook-input--${kind}`;
    const target = document.createElement("div");
    target.className = "lapis-notebook-input__mount";
    node.append(target);
    // Models emit one input event from the owner. Native implementation events
    // must not escape as a second logical change (notably File input/change).
    target.addEventListener("input", (event) => event.stopPropagation());
    target.addEventListener("change", (event) => event.stopPropagation());
    const model =
      kind === "file" ? getNotebookFileModel(node)! : getExtraInputModel(node)!;
    const props = createNotebookModelProps(model);
    const component = mount(
      kind === "file" ? FileInputControl : (ExtraInputControl as any),
      { target, props: props as any },
    );
    const stop = model.subscribe(() => props.update());
    attachNotebookInputView(node, () => {
      stop();
      void unmount(component);
    });
    Object.defineProperty(node, "__lapisNotebookInputDispose", {
      value: () => disposeNotebookInput(node),
    });
    return node;
  };
  return Object.fromEntries(
    (
      [
        "markdown",
        "button",
        "checkbox",
        "radio",
        "select",
        "search",
        "form",
        "file",
      ] as const
    ).map((kind) => [kind, (...args: any[]) => create(kind, args)]),
  );
}
