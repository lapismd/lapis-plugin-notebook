import { createNotebookInputHost } from "./input-host";
import {
  normalizeTableRows,
  normalizeTableColumns,
  normalizeTableInputValue,
  normalizeTableSelection,
  normalizeTableSelectionFromIndexes,
  type NotebookTableOptions,
  type NotebookTableSelection,
} from "./table-model";

type Runtime = {
  mount: (...args: any[]) => any;
  unmount: (...args: any[]) => void;
  createControlProps: <T extends Record<string, unknown>>(props: T) => T;
  Table: unknown;
};
/** Mount once; model normalization always returns original host row objects. */
export function createTableInput(
  runtime: Runtime,
  data: unknown,
  rawOptions: Record<string, unknown> = {},
): HTMLElement {
  const rows = normalizeTableRows(data);
  const options = rawOptions as NotebookTableOptions;
  const columns = normalizeTableColumns(rows, options.columns).map((name) => ({
    name,
    type: "unknown" as const,
  }));
  const selectionOptions = {
    multiple: options.multiple !== false,
    required: options.required !== false,
    select: options.select !== false,
  };
  const limit =
    typeof options.rows === "number" && options.rows > 0
      ? Math.min(Math.ceil(options.rows), Math.max(1, rows.length)) * 36 + 80
      : 320;
  const height =
    typeof options.height === "number" && options.height > 0
      ? options.height
      : typeof options.maxHeight === "number" && options.maxHeight > 0
        ? Math.min(limit, options.maxHeight)
        : limit;
  return createNotebookInputHost<NotebookTableSelection>({
    inputType: "table",
    initialValue: normalizeTableInputValue(rows, options),
    onMount(_host, target, value, setValue, dispatchInput) {
      let selection = normalizeTableSelection(rows, value, selectionOptions);
      setValue(selection.value);
      const props = runtime.createControlProps({
        rows,
        columns,
        selectedRowIds: [...selection.indexes],
        rowSelection: selectionOptions.select
          ? {
              mode: selectionOptions.multiple ? "multiple" : "single",
              required: selectionOptions.required,
              disabled: options.disabled === true,
            }
          : false,
        height: height + "px",
        label:
          typeof options.label === "string" ? options.label : "Input table",
        onSelectedRowIdsChange(ids: number[]) {
          const next = normalizeTableSelectionFromIndexes(
            rows,
            new Set(ids),
            selectionOptions,
          );
          if (
            next.indexes.size === selection.indexes.size &&
            [...next.indexes].every((id) => selection.indexes.has(id))
          )
            return;
          selection = next;
          props.selectedRowIds = [...selection.indexes];
          setValue(selection.value);
          dispatchInput();
        },
      });
      const stopInput = (event: Event) => event.stopPropagation();
      target.addEventListener("input", stopInput);
      const component = runtime.mount(runtime.Table, { target, props });
      return {
        dispose: () => {
          target.removeEventListener("input", stopInput);
          runtime.unmount(component);
          target.replaceChildren();
        },
        updateValue(next: NotebookTableSelection) {
          selection = normalizeTableSelection(rows, next, selectionOptions);
          props.selectedRowIds = [...selection.indexes];
          setValue(selection.value);
        },
      };
    },
  });
}
