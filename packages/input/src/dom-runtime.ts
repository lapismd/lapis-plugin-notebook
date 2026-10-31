import {
  loadNotebookStdlibDomRuntime,
  type NotebookHtlTemplateTag as NotebookStdlibHtlTemplateTag,
} from "@lapis-notes/notebook-stdlib/dom";
import { loadUiBackedNotebookInputs } from "./ui-runtime";
import { getExtraInputModel } from "./extra-model";
import { getNotebookFileModel } from "./file-model";
import {
  isNotebookInputSnapshot,
  restoreNotebookInputState,
  snapshotNotebookInputState,
} from "./input-state";
import type { NotebookInputHostContext } from "./host-context";

export type NotebookHtlTemplateTag = NotebookStdlibHtlTemplateTag;

const LAPIS_NOTEBOOK_INPUT_LIBRARY = "@lapis-notes/notebook-input";

export type NotebookInputMetadataSource = {
  library?: string;
  factory: string;
  version?: string;
};

export type NotebookInputMetadata = {
  inputType: string;
  value: unknown;
  label?: string;
  config?: Record<string, unknown>;
  reconstructable: boolean;
  source?: NotebookInputMetadataSource;
};

const NOTEBOOK_INPUT_METADATA = Symbol("lapis.notebookInputMetadata");

const SIMPLE_CONFIG_FACTORIES = new Set([
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
]);

const OPTION_LIST_FACTORIES = new Set(["select", "radio", "checkbox"]);

const DATASET_FACTORIES = new Set(["table"]);

export interface NotebookDomRuntime {
  Inputs: Record<string, unknown>;
  html: NotebookHtlTemplateTag;
  svg: NotebookHtlTemplateTag;
}

type NotebookInputReconstructionConfig = Pick<
  NotebookInputMetadata,
  "inputType" | "value" | "label" | "config" | "reconstructable" | "source"
>;

export async function loadNotebookDomRuntime(
  context: NotebookInputHostContext = {},
): Promise<NotebookDomRuntime> {
  const [domRuntime, notebookInputs] = await Promise.all([
    loadNotebookStdlibDomRuntime(),
    loadUiBackedNotebookInputs(context),
  ]);

  return {
    Inputs: createTrackedNotebookInputs(notebookInputs.inputs),
    html: domRuntime.html,
    svg: domRuntime.svg,
  };
}

export function createTrackedNotebookInputs(
  inputs: Record<string, unknown>,
): Record<string, unknown> {
  return new Proxy(inputs, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (typeof property !== "string" || typeof value !== "function") {
        return value;
      }

      return (...args: unknown[]) => {
        const result = Reflect.apply(value, target, args);
        const metadata = buildNotebookInputMetadata(property, args, result);
        if (metadata) {
          attachNotebookInputMetadata(result, metadata);
        }
        return result;
      };
    },
  });
}

export function attachNotebookInputMetadata(
  value: unknown,
  metadata: NotebookInputMetadata,
): void {
  if (!value || (typeof value !== "object" && typeof value !== "function")) {
    return;
  }

  Object.defineProperty(value, NOTEBOOK_INPUT_METADATA, {
    configurable: true,
    enumerable: false,
    value: metadata,
    writable: true,
  });
}

export function getNotebookInputMetadata(
  value: unknown,
): NotebookInputMetadata | undefined {
  if (!value || (typeof value !== "object" && typeof value !== "function")) {
    return undefined;
  }

  return (value as { [NOTEBOOK_INPUT_METADATA]?: NotebookInputMetadata })[
    NOTEBOOK_INPUT_METADATA
  ];
}

export function isTemplateStringsArray(
  value: unknown,
): value is TemplateStringsArray {
  return Array.isArray(value) && "raw" in value;
}

export function canReconstructNotebookInput(
  metadata: NotebookInputReconstructionConfig,
): boolean {
  if (!metadata.reconstructable) {
    return false;
  }

  const factory = metadata.source?.factory ?? metadata.inputType;
  const library = metadata.source?.library;
  if (library && library !== LAPIS_NOTEBOOK_INPUT_LIBRARY) {
    return false;
  }

  if (factory === "form") {
    const children = metadata.config?.children;
    return Boolean(
      children &&
        typeof children === "object" &&
        Object.values(children).every((child) =>
          canReconstructNotebookInput(child as NotebookInputMetadata),
        ),
    );
  }
  return buildNotebookInputFactoryArgs(factory, metadata) !== null;
}

export async function reconstructNotebookInputNode(
  metadata: NotebookInputReconstructionConfig,
  context: NotebookInputHostContext = {},
): Promise<Node | null> {
  if (!canReconstructNotebookInput(metadata)) {
    return null;
  }

  const domRuntime = await loadNotebookDomRuntime(context);
  const factory = metadata.source?.factory ?? metadata.inputType;
  const inputFactory = domRuntime.Inputs[factory];
  let args = buildNotebookInputFactoryArgs(factory, metadata);
  if (factory === "form") {
    const children = metadata.config!.children as Record<
      string,
      NotebookInputMetadata
    >;
    const entries = await Promise.all(
      Object.entries(children).map(
        async ([key, child]) =>
          [key, await reconstructNotebookInputNode(child, context)] as const,
      ),
    );
    if (entries.some(([, child]) => !child)) return null;
    args = [
      Array.isArray(children)
        ? entries.map(([, child]) => child)
        : Object.fromEntries(entries),
      {},
    ];
  }
  if (typeof inputFactory !== "function" || !args) {
    return null;
  }

  const node = Reflect.apply(inputFactory, domRuntime.Inputs, args);
  if (!isNotebookDomNode(node)) return null;
  restoreNotebookInputState(node, metadata.value);
  return node;
}

function buildNotebookInputMetadata(
  factory: string,
  args: unknown[],
  value: unknown,
  sourceLibrary = LAPIS_NOTEBOOK_INPUT_LIBRARY,
): NotebookInputMetadata | undefined {
  const source = {
    library: sourceLibrary,
    factory,
  } satisfies NotebookInputMetadata["source"];

  const model =
    value && typeof value === "object" ? getExtraInputModel(value) : undefined;
  const fileModel =
    value && typeof value === "object"
      ? getNotebookFileModel(value)
      : undefined;
  if (model || fileModel) {
    const options = model?.options ?? fileModel!.options;
    const safeOptions = cloneSerializableRecord(
      Object.fromEntries(
        Object.entries(options).filter(
          ([key]) => key !== "value" && key !== "__choices",
        ),
      ),
    );
    let config: Record<string, unknown> = safeOptions ?? {};
    let reconstructable = safeOptions !== undefined;
    if (OPTION_LIST_FACTORIES.has(factory) && model) {
      const choices = cloneSerializableValue(model.choices);
      config = { ...config, __choices: choices, options: [] };
      reconstructable &&= choices !== undefined;
    } else if (factory === "form" && model) {
      const children = Object.entries(args[0] as Record<string, unknown>).map(
        ([key, child]) => [key, getNotebookInputMetadata(child)] as const,
      );
      config = {
        ...config,
        children: Array.isArray(args[0])
          ? children.map(([, child]) => child)
          : Object.fromEntries(children),
      };
      reconstructable &&= children.every(
        ([, child]) => child && canReconstructNotebookInput(child),
      );
    } else if (factory === "search") {
      config = { ...config, data: cloneSerializableValue(args[0]) };
      reconstructable &&= config.data !== undefined;
    } else if (factory === "button") {
      config = { ...config, content: cloneSerializableValue(args[0] ?? "≡") };
      reconstructable &&= typeof config.content === "string";
    }
    return {
      inputType: factory,
      value: snapshotNotebookInputState(value as Node),
      label: typeof options.label === "string" ? options.label : undefined,
      config,
      reconstructable,
      source,
    };
  }

  if (factory === "range" || factory === "number") {
    const extent = normalizeRangeExtent(args[0]);
    const options = omitRecordKeys(cloneSerializableRecord(args[1]), ["value"]);
    const rawOptions = cloneSerializableRecord(args[1]);
    return {
      inputType: factory,
      value: rawOptions?.value ?? readInputValue(value),
      label: typeof options?.label === "string" ? options.label : undefined,
      config:
        extent || options
          ? {
              ...(extent ?? {}),
              ...(options ?? {}),
            }
          : undefined,
      reconstructable: Boolean(extent),
      source,
    };
  }

  if (OPTION_LIST_FACTORIES.has(factory)) {
    const optionsList = cloneSerializableValue(args[0]);
    const options = omitRecordKeys(cloneSerializableRecord(args[1]), ["value"]);
    const rawOptions = cloneSerializableRecord(args[1]);
    return {
      inputType: factory,
      value: rawOptions?.value ?? readInputValue(value),
      label: typeof options?.label === "string" ? options.label : undefined,
      config: {
        ...(options ?? {}),
        options: optionsList,
      },
      reconstructable: optionsList !== undefined,
      source,
    };
  }

  if (SIMPLE_CONFIG_FACTORIES.has(factory)) {
    const options = omitRecordKeys(cloneSerializableRecord(args[0]), ["value"]);
    const rawOptions = cloneSerializableRecord(args[0]);
    return {
      inputType: factory,
      value: rawOptions?.value ?? readInputValue(value),
      label: typeof options?.label === "string" ? options.label : undefined,
      config: options,
      reconstructable: true,
      source,
    };
  }

  if (DATASET_FACTORIES.has(factory)) {
    const data = cloneSerializableValue(args[0]);
    const options = omitRecordKeys(cloneSerializableRecord(args[1]), ["value"]);
    const rawOptions = cloneSerializableRecord(args[1]);
    return {
      inputType: factory,
      value: rawOptions?.value ?? readInputValue(value),
      label: typeof options?.label === "string" ? options.label : undefined,
      config:
        data !== undefined || options
          ? {
              ...(options ?? {}),
              data,
            }
          : undefined,
      reconstructable: data !== undefined,
      source,
    };
  }

  return undefined;
}

function buildNotebookInputFactoryArgs(
  factory: string,
  metadata: NotebookInputReconstructionConfig,
): unknown[] | null {
  const config: Record<string, unknown> = {
    ...(metadata.config ?? {}),
    ...(metadata.label && metadata.config?.label === undefined
      ? { label: metadata.label }
      : {}),
    ...(!isNotebookInputSnapshot(metadata.value)
      ? { value: metadata.value }
      : {}),
  };

  if (factory === "file") return [config];
  if (factory === "button") {
    const { content, ...options } = config;
    return [content, options];
  }
  if (factory === "search") {
    const { data, ...options } = config;
    return Array.isArray(data) ? [data, options] : null;
  }

  if (factory === "range" || factory === "number") {
    const { min, max, ...options } = config;
    if (min === undefined || max === undefined) {
      return null;
    }
    return [[min, max], options];
  }

  if (OPTION_LIST_FACTORIES.has(factory)) {
    const { options, ...rest } = config;
    if (!Array.isArray(options)) {
      return null;
    }
    return [options, rest];
  }

  if (SIMPLE_CONFIG_FACTORIES.has(factory)) {
    return [config];
  }

  if (DATASET_FACTORIES.has(factory)) {
    const { data, ...options } = config;
    if (!Array.isArray(data)) {
      return null;
    }
    return [data, options];
  }

  return null;
}

function isNotebookDomNode(value: unknown): value is Node {
  return typeof Node !== "undefined" && value instanceof Node;
}

function readInputValue(value: unknown): unknown {
  return value && typeof value === "object" && "value" in value
    ? (value as { value: unknown }).value
    : undefined;
}

function normalizeRangeExtent(
  value: unknown,
): Record<string, unknown> | undefined {
  if (!Array.isArray(value) || value.length < 2) {
    return undefined;
  }

  const [min, max] = value;
  return {
    min,
    max,
  };
}

function cloneSerializableRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  const cloned = cloneSerializableValue(value);
  if (!cloned || typeof cloned !== "object" || Array.isArray(cloned)) {
    return undefined;
  }
  return cloned as Record<string, unknown>;
}

function omitRecordKeys(
  value: Record<string, unknown> | undefined,
  keys: readonly string[],
): Record<string, unknown> | undefined {
  if (!value) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).filter(([key]) => !keys.includes(key)),
  );
}

function cloneSerializableValue(value: unknown): unknown {
  if (value == null) {
    return value;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    const clonedItems = value.map((item) => cloneSerializableValue(item));
    if (clonedItems.some((item) => item === undefined)) {
      return undefined;
    }

    const extraEntries = Object.entries(value).filter(
      ([key]) => !/^\d+$/.test(key),
    );
    if (extraEntries.length === 0) {
      return clonedItems;
    }

    const clonedExtraEntries: Array<[string, unknown]> = [];
    for (const [key, entryValue] of extraEntries) {
      const clonedEntryValue = cloneSerializableValue(entryValue);
      if (clonedEntryValue === undefined) {
        return undefined;
      }
      clonedExtraEntries.push([key, clonedEntryValue]);
    }

    return Object.assign(clonedItems, Object.fromEntries(clonedExtraEntries));
  }

  if (typeof value === "object") {
    if (
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null
    )
      return undefined;
    const entries = Object.entries(value);
    const clonedEntries: Array<[string, unknown]> = [];
    for (const [key, entryValue] of entries) {
      const clonedEntryValue = cloneSerializableValue(entryValue);
      if (clonedEntryValue === undefined) {
        return undefined;
      }
      clonedEntries.push([key, clonedEntryValue]);
    }
    return Object.fromEntries(clonedEntries);
  }

  return undefined;
}
