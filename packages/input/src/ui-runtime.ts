import {
  normalizeTableInputValue,
  normalizeTableRows,
  type NotebookTableOptions,
} from "./table-model";
import { createTableInput } from "./table-input";
import { createNotebookInputHost } from "./input-host";
import { createExtraInput } from "./extra-model";
import { createFileInput } from "./file-model";
import type { NotebookInputHostContext } from "./host-context";

const UI_BACKED_NOTEBOOK_INPUT_FACTORIES = new Set([
  "range",
  "number",
  "toggle",
  "text",
  "textarea",
  "markdown",
  "date",
  "datetime",
  "color",
  "email",
  "tel",
  "url",
  "password",
  "table",
  "button",
  "checkbox",
  "radio",
  "select",
  "file",
  "search",
  "form",
]);

type SvelteRuntimeModule = {
  mount: (...args: any[]) => any;
  unmount: (...args: any[]) => void;
};

type NotebookUiRuntimeModules = SvelteRuntimeModule & {
  createControlProps: <T extends Record<string, unknown>>(props: T) => T;
  Table: unknown;
  Input: unknown;
  Slider: unknown;
  Switch: unknown;
  Textarea: unknown;
};

let notebookUiRuntimeModulesPromise: Promise<NotebookUiRuntimeModules> | null =
  null;

export async function loadUiBackedNotebookInputs(
  context: NotebookInputHostContext = {},
): Promise<{
  inputs: Record<string, unknown>;
}> {
  if (!canUseUiBackedNotebookInputs()) {
    return {
      inputs: createHeadlessNotebookInputs(context),
    };
  }

  const runtime = await loadNotebookUiRuntimeModules();
  const extra = await import("./extra-runtime");

  return {
    inputs: {
      ...extra.createExtraNotebookInputs(context),
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
        createTableInput(runtime, data, options),
    },
  };
}

export function isUiBackedNotebookInputFactory(factory: string): boolean {
  return UI_BACKED_NOTEBOOK_INPUT_FACTORIES.has(factory);
}

function canUseUiBackedNotebookInputs(): boolean {
  return typeof document !== "undefined" && typeof HTMLElement !== "undefined";
}

function createHeadlessNotebookInputs(
  context: NotebookInputHostContext,
): Record<string, unknown> {
  return {
    ...Object.fromEntries(
      (
        [
          "markdown",
          "button",
          "checkbox",
          "radio",
          "select",
          "search",
          "form",
        ] as const
      ).map((kind) => [
        kind,
        (...args: any[]) => createExtraInput(kind, args, context),
      ]),
    ),
    file: (options?: Record<string, unknown>) =>
      createFileInput(options, context),
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
      import("./control-props.svelte"),
      import("../../../src/lib/render/table/NotebookCanvasTable.svelte"),
    ]).then(
      ([svelte, input, slider, toggleSwitch, textarea, controls, table]) =>
        ({
          mount: svelte.mount,
          unmount: svelte.unmount,
          createControlProps: controls.createNotebookControlProps,
          Table: table.default,
          Input: input.Input,
          Slider: slider.Slider,
          Switch: toggleSwitch.Switch,
          Textarea: textarea.Textarea,
        }) as NotebookUiRuntimeModules,
    );
  }

  return notebookUiRuntimeModulesPromise as Promise<NotebookUiRuntimeModules>;
}

function notebookInputAriaLabel(
  options: Record<string, unknown>,
): string | undefined {
  return typeof options.label === "string" && options.label.length > 0
    ? options.label
    : undefined;
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
      const props = runtime.createControlProps({
        "aria-label": notebookInputAriaLabel(options),
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
      });
      const updateValue = (value: number) => {
        const nextValue = coerceNumber(value, min);
        setCurrentValue(nextValue);
        hiddenInput.value = String(nextValue);
        props.value = [nextValue];
      };
      const syncFromHiddenInput = () => updateValue(Number(hiddenInput.value));
      hiddenInput.addEventListener("input", syncFromHiddenInput);
      hiddenInput.addEventListener("change", syncFromHiddenInput);
      host.replaceChildren(mountTarget, hiddenInput);
      mounted = runtime.mount(runtime.Slider, { target: mountTarget, props });

      return {
        updateValue,
        dispose() {
          hiddenInput.removeEventListener("input", syncFromHiddenInput);
          hiddenInput.removeEventListener("change", syncFromHiddenInput);
          if (mounted) {
            runtime.unmount(mounted);
            mounted = null;
          }
          mountTarget.replaceChildren();
        },
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
          "aria-label": notebookInputAriaLabel(options),
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
          "aria-label": notebookInputAriaLabel(options),
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
          "aria-label": notebookInputAriaLabel(options),
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
          "aria-label": notebookInputAriaLabel(options),
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

function isIterable(value: unknown): value is Iterable<unknown> {
  return (
    value != null &&
    typeof (value as Iterable<unknown>)[Symbol.iterator] === "function"
  );
}
