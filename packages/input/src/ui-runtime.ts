const UI_BACKED_NOTEBOOK_INPUT_FACTORIES = new Set([
  "range",
  "number",
  "toggle",
  "text",
  "textarea",
  "date",
  "datetime",
  "color",
  "email",
  "tel",
  "url",
  "password",
  "table",
]);

const UNSUPPORTED_NOTEBOOK_INPUT_FACTORIES = [
  "button",
  "checkbox",
  "radio",
  "select",
  "file",
  "search",
  "form",
] as const;

const SUPPORTED_NOTEBOOK_INPUT_LIST = Array.from(
  UI_BACKED_NOTEBOOK_INPUT_FACTORIES,
).join(", ");

type SvelteRuntimeModule = {
  mount: (...args: any[]) => any;
  unmount: (...args: any[]) => void;
};

type NotebookUiRuntimeModules = SvelteRuntimeModule & {
  Input: unknown;
  Slider: unknown;
  Switch: unknown;
  Textarea: unknown;
};

let notebookUiRuntimeModulesPromise: Promise<NotebookUiRuntimeModules> | null =
  null;

type NotebookTableRow = Record<string, unknown>;

type NotebookTableData = NotebookTableRow[] & {
  columns?: string[];
};

type NotebookTableSelection = NotebookTableRow[] | NotebookTableRow | null;

type NotebookTableSortDirection = "asc" | "desc";

type NotebookTableSortState = {
  column: string;
  direction: NotebookTableSortDirection;
} | null;

type NotebookTableOptions = Record<string, unknown> & {
  columns?: unknown;
  value?: unknown;
  multiple?: unknown;
  required?: unknown;
  select?: unknown;
  rows?: unknown;
  height?: unknown;
  maxHeight?: unknown;
  disabled?: unknown;
};

let notebookTableInputId = 0;

export async function loadUiBackedNotebookInputs(): Promise<{
  inputs: Record<string, unknown>;
}> {
  if (!canUseUiBackedNotebookInputs()) {
    return {
      inputs: createHeadlessNotebookInputs(),
    };
  }

  const runtime = await loadNotebookUiRuntimeModules();

  return {
    inputs: {
      ...createUnsupportedNotebookInputs(),
      range: (
        extent: unknown,
        options?: Record<string, unknown>,
      ): HTMLElement => createRangeInput(runtime, extent, options),
      number: (
        extent: unknown,
        options?: Record<string, unknown>,
      ): HTMLElement => createNumberInput(runtime, extent, options),
      toggle: (options?: Record<string, unknown>): HTMLElement =>
        createToggleInput(runtime, options),
      text: (options?: Record<string, unknown>): HTMLElement =>
        createTextInput(runtime, "text", options),
      textarea: (options?: Record<string, unknown>): HTMLElement =>
        createTextareaInput(runtime, options),
      date: (options?: Record<string, unknown>): HTMLElement =>
        createTextInput(runtime, "date", options),
      datetime: (options?: Record<string, unknown>): HTMLElement =>
        createTextInput(runtime, "datetime-local", options),
      color: (options?: Record<string, unknown>): HTMLElement =>
        createTextInput(runtime, "color", options),
      email: (options?: Record<string, unknown>): HTMLElement =>
        createTextInput(runtime, "email", options),
      tel: (options?: Record<string, unknown>): HTMLElement =>
        createTextInput(runtime, "tel", options),
      url: (options?: Record<string, unknown>): HTMLElement =>
        createTextInput(runtime, "url", options),
      password: (options?: Record<string, unknown>): HTMLElement =>
        createTextInput(runtime, "password", options),
      table: (data: unknown, options?: Record<string, unknown>): HTMLElement =>
        createTableInput(data, options),
    },
  };
}

export function isUiBackedNotebookInputFactory(factory: string): boolean {
  return UI_BACKED_NOTEBOOK_INPUT_FACTORIES.has(factory);
}

function canUseUiBackedNotebookInputs(): boolean {
  return typeof document !== "undefined" && typeof HTMLElement !== "undefined";
}

function createHeadlessNotebookInputs(): Record<string, unknown> {
  return {
    ...createUnsupportedNotebookInputs(),
    range: (extent: unknown, options?: Record<string, unknown>): Node => {
      const [min] = normalizeExtent(extent);
      return createHeadlessNotebookInputNode(coerceNumber(options?.value, min));
    },
    number: (extent: unknown, options?: Record<string, unknown>): Node => {
      normalizeExtent(extent);
      return createHeadlessNotebookInputNode(
        coerceOptionalNumber(options?.value),
      );
    },
    toggle: (options?: Record<string, unknown>): Node =>
      createHeadlessNotebookInputNode(Boolean(options?.value)),
    text: (options?: Record<string, unknown>): Node =>
      createHeadlessNotebookInputNode(stringifyValue(options?.value)),
    textarea: (options?: Record<string, unknown>): Node =>
      createHeadlessNotebookInputNode(stringifyValue(options?.value)),
    date: (options?: Record<string, unknown>): Node =>
      createHeadlessNotebookInputNode(stringifyValue(options?.value)),
    datetime: (options?: Record<string, unknown>): Node =>
      createHeadlessNotebookInputNode(stringifyValue(options?.value)),
    color: (options?: Record<string, unknown>): Node =>
      createHeadlessNotebookInputNode(stringifyValue(options?.value)),
    email: (options?: Record<string, unknown>): Node =>
      createHeadlessNotebookInputNode(stringifyValue(options?.value)),
    tel: (options?: Record<string, unknown>): Node =>
      createHeadlessNotebookInputNode(stringifyValue(options?.value)),
    url: (options?: Record<string, unknown>): Node =>
      createHeadlessNotebookInputNode(stringifyValue(options?.value)),
    password: (options?: Record<string, unknown>): Node =>
      createHeadlessNotebookInputNode(stringifyValue(options?.value)),
    table: (data: unknown, options?: Record<string, unknown>): Node =>
      createHeadlessNotebookInputNode(
        normalizeTableInputValue(
          normalizeTableRows(data),
          options as NotebookTableOptions,
        ),
      ),
  };
}

function createUnsupportedNotebookInputs(): Record<string, unknown> {
  return Object.fromEntries(
    UNSUPPORTED_NOTEBOOK_INPUT_FACTORIES.map((factory) => [
      factory,
      createUnsupportedNotebookInputFactory(factory),
    ]),
  );
}

function createUnsupportedNotebookInputFactory(factory: string) {
  return () => {
    throw new Error(
      `Inputs.${factory} is not supported. Supported notebook inputs: ${SUPPORTED_NOTEBOOK_INPUT_LIST}.`,
    );
  };
}

function createHeadlessNotebookInputNode(value: unknown): Node {
  if (typeof Node !== "function") {
    throw new Error("Notebook inputs require a DOM-capable runtime.");
  }

  const node = new (Node as unknown as {
    new (): Node & { value: unknown };
  })();
  (node as Node & { value: unknown }).value = value;
  return node;
}

async function loadNotebookUiRuntimeModules(): Promise<NotebookUiRuntimeModules> {
  if (!notebookUiRuntimeModulesPromise) {
    notebookUiRuntimeModulesPromise = Promise.all([
      import("svelte"),
      import("@lapismd/design-core/shadcn/input"),
      import("@lapismd/design-core/shadcn/slider"),
      import("@lapismd/design-core/shadcn/switch"),
      import("@lapismd/design-core/shadcn/textarea"),
    ]).then(
      ([svelte, input, slider, toggleSwitch, textarea]) =>
        ({
          mount: svelte.mount,
          unmount: svelte.unmount,
          Input: input.Input,
          Slider: slider.Slider,
          Switch: toggleSwitch.Switch,
          Textarea: textarea.Textarea,
        }) as NotebookUiRuntimeModules,
    );
  }

  return notebookUiRuntimeModulesPromise as Promise<NotebookUiRuntimeModules>;
}

function createRangeInput(
  runtime: NotebookUiRuntimeModules,
  extent: unknown,
  options: Record<string, unknown> = {},
): HTMLElement {
  const [min, max] = normalizeExtent(extent);
  const step = typeof options.step === "number" ? options.step : 1;
  const disabled = options.disabled === true;
  let mounted: unknown;

  const hiddenInput = document.createElement("input");
  hiddenInput.type = "range";
  hiddenInput.min = String(min);
  hiddenInput.max = String(max);
  hiddenInput.step = String(step);
  hiddenInput.disabled = disabled;
  hiddenInput.className = "sr-only";
  hiddenInput.tabIndex = -1;
  hiddenInput.setAttribute("aria-hidden", "true");

  const host = createNotebookInputHost<number>({
    inputType: "range",
    initialValue: coerceNumber(options.value, min),
    onMount: (
      host,
      mountTarget,
      currentValue,
      setCurrentValue,
      dispatchInput,
    ) => {
      hiddenInput.value = String(currentValue);
      const syncFromHiddenInput = () => {
        const nextValue = coerceNumber(hiddenInput.value, min);
        setCurrentValue(nextValue);
        render();
      };

      hiddenInput.addEventListener("input", syncFromHiddenInput);
      hiddenInput.addEventListener("change", syncFromHiddenInput);

      host.replaceChildren(mountTarget, hiddenInput);

      const render = () => {
        if (mounted) {
          runtime.unmount(mounted);
          mounted = null;
          mountTarget.replaceChildren();
        }

        mounted = runtime.mount(runtime.Slider, {
          target: mountTarget,
          props: {
            min,
            max,
            step,
            disabled,
            value: [currentValue],
            onValueChange(values: unknown) {
              const nextValue = coerceNumber(
                Array.isArray(values) ? values[0] : values,
                min,
              );
              setCurrentValue(nextValue);
              hiddenInput.value = String(nextValue);
              dispatchInput();
            },
          },
        });
      };

      render();

      return () => {
        hiddenInput.removeEventListener("input", syncFromHiddenInput);
        hiddenInput.removeEventListener("change", syncFromHiddenInput);
        if (mounted) {
          runtime.unmount(mounted);
          mounted = null;
        }
        mountTarget.replaceChildren();
      };
    },
  });

  return host;
}

function createNumberInput(
  runtime: NotebookUiRuntimeModules,
  extent: unknown,
  options: Record<string, unknown> = {},
): HTMLElement {
  const [min, max] = normalizeExtent(extent);
  const step =
    typeof options.step === "number" || typeof options.step === "string"
      ? options.step
      : undefined;

  return createNotebookInputHost<number | undefined>({
    inputType: "number",
    initialValue: coerceOptionalNumber(options.value),
    onMount: (_host, mountTarget, currentValue, setCurrentValue) => {
      const mounted = runtime.mount(runtime.Input, {
        target: mountTarget,
        props: {
          type: "number",
          value: stringifyOptionalValue(currentValue),
          min,
          max,
          step,
          disabled: options.disabled === true,
          placeholder:
            typeof options.placeholder === "string"
              ? options.placeholder
              : undefined,
          oninput(event: Event) {
            setCurrentValue(
              coerceOptionalNumber(
                (event.currentTarget as HTMLInputElement).value,
              ),
            );
          },
          onchange(event: Event) {
            setCurrentValue(
              coerceOptionalNumber(
                (event.currentTarget as HTMLInputElement).value,
              ),
            );
          },
        },
      });

      return () => {
        runtime.unmount(mounted);
        mountTarget.replaceChildren();
      };
    },
  });
}

function createTextInput(
  runtime: NotebookUiRuntimeModules,
  type: string,
  options: Record<string, unknown> = {},
): HTMLElement {
  return createNotebookInputHost<string>({
    inputType: type,
    initialValue: stringifyValue(options.value),
    onMount: (_host, mountTarget, currentValue, setCurrentValue) => {
      const mounted = runtime.mount(runtime.Input, {
        target: mountTarget,
        props: {
          type,
          value: currentValue,
          disabled: options.disabled === true,
          placeholder:
            typeof options.placeholder === "string"
              ? options.placeholder
              : undefined,
          oninput(event: Event) {
            setCurrentValue((event.currentTarget as HTMLInputElement).value);
          },
          onchange(event: Event) {
            setCurrentValue((event.currentTarget as HTMLInputElement).value);
          },
        },
      });

      return () => {
        runtime.unmount(mounted);
        mountTarget.replaceChildren();
      };
    },
  });
}

function createTextareaInput(
  runtime: NotebookUiRuntimeModules,
  options: Record<string, unknown> = {},
): HTMLElement {
  return createNotebookInputHost<string>({
    inputType: "textarea",
    initialValue: stringifyValue(options.value),
    onMount: (_host, mountTarget, currentValue, setCurrentValue) => {
      const mounted = runtime.mount(runtime.Textarea, {
        target: mountTarget,
        props: {
          value: currentValue,
          disabled: options.disabled === true,
          placeholder:
            typeof options.placeholder === "string"
              ? options.placeholder
              : undefined,
          rows: typeof options.rows === "number" ? options.rows : undefined,
          oninput(event: Event) {
            setCurrentValue((event.currentTarget as HTMLTextAreaElement).value);
          },
          onchange(event: Event) {
            setCurrentValue((event.currentTarget as HTMLTextAreaElement).value);
          },
        },
      });

      return () => {
        runtime.unmount(mounted);
        mountTarget.replaceChildren();
      };
    },
  });
}

function createToggleInput(
  runtime: NotebookUiRuntimeModules,
  options: Record<string, unknown> = {},
): HTMLElement {
  return createNotebookInputHost<boolean>({
    inputType: "toggle",
    initialValue: Boolean(options.value),
    onMount: (
      _host,
      mountTarget,
      currentValue,
      setCurrentValue,
      dispatchInput,
    ) => {
      const mounted = runtime.mount(runtime.Switch, {
        target: mountTarget,
        props: {
          checked: currentValue,
          disabled: options.disabled === true,
          onCheckedChange(checked: unknown) {
            setCurrentValue(Boolean(checked));
            dispatchInput();
          },
        },
      });

      return () => {
        runtime.unmount(mounted);
        mountTarget.replaceChildren();
      };
    },
  });
}

function createTableInput(
  data: unknown,
  rawOptions: Record<string, unknown> = {},
): HTMLElement {
  const rows = normalizeTableRows(data);
  const options = rawOptions as NotebookTableOptions;
  const columns = normalizeTableColumns(rows, options.columns);
  const select = options.select !== false;
  const multiple = options.multiple !== false;
  const required = options.required !== false;
  const disabled = options.disabled === true;
  const radioGroupName = `lapis-notebook-input-table-${++notebookTableInputId}`;
  let sortState: NotebookTableSortState = null;

  return createNotebookInputHost<NotebookTableSelection>({
    inputType: "table",
    initialValue: normalizeTableInputValue(rows, options),
    onMount: (
      _host,
      mountTarget,
      currentValue,
      setCurrentValue,
      dispatchInput,
    ) => {
      const tableContainer = document.createElement("div");
      tableContainer.className = "lapis-notebook-input__table";
      applyTableHeight(tableContainer, options, rows.length);

      const selection = normalizeTableSelection(rows, currentValue, {
        multiple,
        required,
        select,
      });
      if (selection.value !== currentValue) {
        setCurrentValue(selection.value);
      }

      const render = () => {
        tableContainer.replaceChildren();

        if (rows.length === 0) {
          const empty = document.createElement("div");
          empty.className = "lapis-notebook-input__table-empty";
          empty.textContent = "No rows";
          tableContainer.replaceChildren(empty);
          return;
        }

        const table = document.createElement("table");
        table.className = "lapis-notebook-input__table-grid";
        const rowIndexes = getSortedNotebookTableIndexes(rows, sortState);

        const thead = document.createElement("thead");
        const headerRow = document.createElement("tr");

        if (select) {
          const selectionHeader = document.createElement("th");
          selectionHeader.className =
            "lapis-notebook-input__table-select-header";
          selectionHeader.scope = "col";
          selectionHeader.textContent = "Select";
          headerRow.append(selectionHeader);
        }

        for (const column of columns) {
          const th = document.createElement("th");
          th.scope = "col";
          const button = document.createElement("button");
          const activeDirection =
            sortState?.column === column ? sortState.direction : null;
          button.type = "button";
          button.className = "lapis-notebook-input__table-sort";
          if (activeDirection) {
            button.dataset.direction = activeDirection;
          }
          button.textContent = column;
          button.addEventListener("click", () => {
            sortState = getNextNotebookTableSortState(sortState, column);
            render();
          });
          th.append(button);
          headerRow.append(th);
        }

        thead.append(headerRow);
        table.append(thead);

        const tbody = document.createElement("tbody");

        rowIndexes.forEach((rowIndex) => {
          const row = rows[rowIndex];
          const tr = document.createElement("tr");
          const checked = selection.indexes.has(rowIndex);
          if (checked) {
            tr.dataset.selected = "true";
          }

          const updateSelection = (nextChecked: boolean) => {
            const nextIndexes = new Set(selection.indexes);
            if (multiple) {
              if (nextChecked) {
                nextIndexes.add(rowIndex);
              } else if (!required || nextIndexes.size > 1) {
                nextIndexes.delete(rowIndex);
              }
            } else if (nextChecked) {
              nextIndexes.clear();
              nextIndexes.add(rowIndex);
            } else if (!required) {
              nextIndexes.clear();
            }

            const nextSelection = normalizeTableSelectionFromIndexes(
              rows,
              nextIndexes,
              {
                multiple,
                required,
                select,
              },
            );
            selection.indexes = nextSelection.indexes;
            selection.value = nextSelection.value;
            setCurrentValue(nextSelection.value);
            render();
            dispatchInput();
          };

          if (select) {
            const selectCell = document.createElement("td");
            selectCell.className = "lapis-notebook-input__table-select-cell";
            const control = document.createElement("input");
            control.type = multiple ? "checkbox" : "radio";
            if (!multiple) {
              control.name = radioGroupName;
            }
            control.checked = checked;
            control.disabled = disabled;
            control.addEventListener("change", () => {
              updateSelection(control.checked);
            });
            selectCell.append(control);
            tr.append(selectCell);

            tr.addEventListener("click", (event) => {
              if (event.target instanceof HTMLInputElement) {
                return;
              }
              updateSelection(
                multiple ? !selection.indexes.has(rowIndex) : true,
              );
            });
          }

          for (const column of columns) {
            const td = document.createElement("td");
            td.textContent = formatNotebookTableCell(row[column]);
            tr.append(td);
          }

          tbody.append(tr);
        });

        table.append(tbody);
        tableContainer.replaceChildren(table);
      };

      render();
      mountTarget.replaceChildren(tableContainer);

      return () => {
        mountTarget.replaceChildren();
      };
    },
  });
}

function createNotebookInputHost<TValue>({
  inputType,
  initialValue,
  onMount,
}: {
  inputType: string;
  initialValue: TValue;
  onMount: (
    host: HTMLElement,
    mountTarget: HTMLElement,
    currentValue: TValue,
    setCurrentValue: (value: TValue) => void,
    dispatchInput: () => void,
  ) => () => void;
}): HTMLElement {
  const host = document.createElement("div");
  host.className = `lapis-notebook-input lapis-notebook-input--${inputType}`;
  host.dataset.notebookInputType = inputType;

  let currentValue = initialValue;
  let disposeMountedControl = () => {};

  const mountControl = () => {
    disposeMountedControl();
    const mountTarget = document.createElement("div");
    mountTarget.className = "lapis-notebook-input__mount";
    disposeMountedControl = onMount(
      host,
      mountTarget,
      currentValue,
      (nextValue) => {
        currentValue = nextValue;
      },
      () => {
        host.dispatchEvent(new Event("input", { bubbles: true }));
      },
    );
    if (!host.contains(mountTarget)) {
      host.replaceChildren(mountTarget);
    }
  };

  Object.defineProperty(host, "value", {
    configurable: true,
    get() {
      return currentValue;
    },
    set(nextValue: TValue) {
      currentValue = nextValue;
      mountControl();
    },
  });

  mountControl();

  Object.defineProperty(host, "__lapisNotebookInputDispose", {
    configurable: true,
    enumerable: false,
    value: () => {
      disposeMountedControl();
      host.replaceChildren();
    },
  });

  return host;
}

function normalizeExtent(extent: unknown): [number, number] {
  if (!Array.isArray(extent) || extent.length < 2) {
    return [0, 100];
  }

  return [coerceNumber(extent[0], 0), coerceNumber(extent[1], 100)];
}

function coerceNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : typeof value === "string" &&
        value.trim() !== "" &&
        Number.isFinite(Number(value))
      ? Number(value)
      : fallback;
}

function coerceOptionalNumber(value: unknown): number | undefined {
  if (value === "" || value == null) {
    return undefined;
  }

  const numericValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  return Number.isFinite(numericValue) ? numericValue : undefined;
}

function stringifyValue(value: unknown): string {
  return value == null ? "" : String(value);
}

function stringifyOptionalValue(value: number | undefined): string {
  return value == null ? "" : String(value);
}

function normalizeTableRows(data: unknown): NotebookTableData {
  if (!isIterable(data)) {
    throw new TypeError("Inputs.table expects an iterable of row objects.");
  }

  const rows = Array.from(data).map((row) => {
    if (!isNotebookTableRow(row)) {
      throw new TypeError("Inputs.table expects row values to be objects.");
    }
    return row;
  }) as NotebookTableData;

  const columns =
    data &&
    typeof data === "object" &&
    Array.isArray((data as { columns?: unknown }).columns)
      ? (data as unknown as { columns: unknown[] }).columns.filter(
          (column): column is string => typeof column === "string",
        )
      : undefined;
  if (columns && columns.length > 0) {
    rows.columns = columns;
  }

  return rows;
}

function normalizeTableColumns(
  rows: NotebookTableData,
  columns: unknown,
): string[] {
  if (Array.isArray(columns)) {
    const normalizedColumns = columns.filter(
      (column): column is string => typeof column === "string",
    );
    if (normalizedColumns.length > 0) {
      return normalizedColumns;
    }
  }

  if (Array.isArray(rows.columns) && rows.columns.length > 0) {
    return [...rows.columns];
  }

  const inferred = new Set<string>();
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      inferred.add(key);
    }
  }
  return Array.from(inferred);
}

function normalizeTableInputValue(
  rows: NotebookTableData,
  options: NotebookTableOptions,
): NotebookTableSelection {
  return normalizeTableSelection(rows, options.value, {
    multiple: options.multiple !== false,
    required: options.required !== false,
    select: options.select !== false,
  }).value;
}

function normalizeTableSelection(
  rows: NotebookTableData,
  value: unknown,
  options: {
    multiple: boolean;
    required: boolean;
    select: boolean;
  },
): {
  indexes: Set<number>;
  value: NotebookTableSelection;
} {
  if (!options.select) {
    return {
      indexes: new Set(),
      value: [...rows],
    };
  }

  const requestedRows = Array.isArray(value)
    ? value.filter(isNotebookTableRow)
    : isNotebookTableRow(value)
      ? [value]
      : [];
  const matchedIndexes = new Set<number>();

  for (const requestedRow of requestedRows) {
    for (let index = 0; index < rows.length; index += 1) {
      if (matchedIndexes.has(index)) {
        continue;
      }
      if (areNotebookTableRowsEqual(rows[index], requestedRow)) {
        matchedIndexes.add(index);
        break;
      }
    }
  }

  if (matchedIndexes.size === 0 && options.required && rows.length > 0) {
    if (options.multiple) {
      rows.forEach((_row, index) => matchedIndexes.add(index));
    } else {
      matchedIndexes.add(0);
    }
  }

  if (!options.multiple && matchedIndexes.size > 1) {
    const firstIndex = Math.min(...matchedIndexes);
    matchedIndexes.clear();
    matchedIndexes.add(firstIndex);
  }

  return normalizeTableSelectionFromIndexes(rows, matchedIndexes, options);
}

function normalizeTableSelectionFromIndexes(
  rows: NotebookTableData,
  indexes: Set<number>,
  options: {
    multiple: boolean;
    required: boolean;
    select: boolean;
  },
): {
  indexes: Set<number>;
  value: NotebookTableSelection;
} {
  const normalizedIndexes = new Set<number>();
  indexes.forEach((index) => {
    if (index >= 0 && index < rows.length) {
      normalizedIndexes.add(index);
    }
  });

  if (normalizedIndexes.size === 0 && options.required && rows.length > 0) {
    if (options.multiple) {
      rows.forEach((_row, index) => normalizedIndexes.add(index));
    } else {
      normalizedIndexes.add(0);
    }
  }

  if (!options.multiple && normalizedIndexes.size > 1) {
    const firstIndex = Math.min(...normalizedIndexes);
    normalizedIndexes.clear();
    normalizedIndexes.add(firstIndex);
  }

  if (options.multiple) {
    return {
      indexes: normalizedIndexes,
      value: Array.from(normalizedIndexes, (index) => rows[index]),
    };
  }

  const [firstIndex] = Array.from(normalizedIndexes);
  return {
    indexes: normalizedIndexes,
    value: firstIndex == null ? null : rows[firstIndex],
  };
}

function applyTableHeight(
  container: HTMLElement,
  options: NotebookTableOptions,
  rowCount: number,
): void {
  if (typeof options.height === "number" && options.height > 0) {
    container.style.height = `${options.height}px`;
    return;
  }

  if (typeof options.maxHeight === "number" && options.maxHeight > 0) {
    container.style.maxHeight = `${options.maxHeight}px`;
    return;
  }

  if (typeof options.rows === "number" && options.rows > 0) {
    const visibleRows = Math.min(
      Math.ceil(options.rows),
      Math.max(rowCount, 1),
    );
    container.style.maxHeight = `${visibleRows * 36 + 40}px`;
  }
}

function formatNotebookTableCell(value: unknown): string {
  if (value == null) {
    return "";
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value);
}

function getNextNotebookTableSortState(
  current: NotebookTableSortState,
  column: string,
): NotebookTableSortState {
  if (!current || current.column !== column) {
    return { column, direction: "asc" };
  }

  if (current.direction === "asc") {
    return { column, direction: "desc" };
  }

  return null;
}

function getSortedNotebookTableIndexes(
  rows: NotebookTableData,
  sortState: NotebookTableSortState,
): number[] {
  const indexes = rows.map((_row, index) => index);
  if (!sortState) {
    return indexes;
  }

  const direction = sortState.direction === "asc" ? 1 : -1;
  indexes.sort((leftIndex, rightIndex) => {
    const result = compareNotebookTableValues(
      rows[leftIndex][sortState.column],
      rows[rightIndex][sortState.column],
    );
    return result * direction;
  });
  return indexes;
}

function compareNotebookTableValues(left: unknown, right: unknown): number {
  if (left == null && right == null) {
    return 0;
  }

  if (left == null) {
    return 1;
  }

  if (right == null) {
    return -1;
  }

  if (left instanceof Date && right instanceof Date) {
    return left.getTime() - right.getTime();
  }

  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }

  if (typeof left === "boolean" && typeof right === "boolean") {
    return Number(left) - Number(right);
  }

  return String(left).localeCompare(String(right), undefined, {
    numeric: true,
    sensitivity: "base",
  });
}

function isIterable(value: unknown): value is Iterable<unknown> {
  return (
    value != null &&
    typeof (value as { [Symbol.iterator]?: unknown })[Symbol.iterator] ===
      "function"
  );
}

function isNotebookTableRow(value: unknown): value is NotebookTableRow {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function areNotebookTableRowsEqual(
  left: NotebookTableRow,
  right: NotebookTableRow,
): boolean {
  if (left === right) {
    return true;
  }

  try {
    return JSON.stringify(left) === JSON.stringify(right);
  } catch {
    return false;
  }
}
