import type { NotebookInputHostContext } from "./host-context";
import {
  disposeNotebookInput,
  isNotebookInputSnapshot,
  registerNotebookInputState,
  restoreNotebookInputState,
  snapshotNotebookInputState,
  settleNotebookInputState,
  type NotebookInputSnapshot,
  type NotebookInputSnapshotOptions,
} from "./input-state";

export type ExtraInputKind =
  | "markdown"
  | "button"
  | "checkbox"
  | "radio"
  | "select"
  | "search"
  | "form";
export type InputOptions = Record<string, any>;
export interface NotebookChoice {
  id: string;
  key: unknown;
  value: unknown;
  label: string | Node;
  disabled: boolean;
}
export interface NotebookAction {
  content: string | Node;
  reduce: (value: any) => unknown;
  disabled: boolean;
}
export interface ExtraInputModel {
  kind: ExtraInputKind;
  options: InputOptions;
  choices: NotebookChoice[];
  actions: NotebookAction[];
  children: Node[];
  template?: Node;
  multiple: boolean;
  pending: boolean;
  query: string;
  resultLabel: unknown;
  readonly value: any;
  readonly ids: string[];
  choose(ids: string[]): void;
  activate(index: number): void;
  setText(value: string): void;
  setQuery(query: string, emit?: boolean): void;
  restore(value: unknown): void;
  snapshot(capture?: NotebookInputSnapshotOptions): NotebookInputSnapshot;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}

const models = new WeakMap<object, ExtraInputModel>();
export const getExtraInputModel = (node: object) => models.get(node);

function arrayify(value: unknown): any[] {
  if (value == null || typeof (value as any)[Symbol.iterator] !== "function")
    throw new TypeError("Input choices must be iterable");
  return Array.from(value as Iterable<any>);
}

function sameValue(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  // Compatibility with legacy plain persisted values; new snapshots use IDs.
  try {
    return (
      typeof a === "object" &&
      typeof b === "object" &&
      JSON.stringify(a) === JSON.stringify(b)
    );
  } catch {
    return false;
  }
}

export function normalizeNotebookChoices(
  data: unknown,
  options: InputOptions = {},
): NotebookChoice[] {
  if (Array.isArray(options.__choices)) return options.__choices;
  const map = data instanceof Map;
  const keyof = options.keyof ?? (map ? (d: any) => d[0] : (d: any) => d);
  const valueof = options.valueof ?? (map ? (d: any) => d[1] : (d: any) => d);
  const format = options.format;
  const disabled =
    options.disabled === true ? null : new Set(options.disabled || []);
  const items = arrayify(data);
  let choices = items.map((item, index) => {
    const key = keyof(item, index, items);
    const value = valueof(item, index, items);
    return {
      id: String(index),
      key,
      value,
      label: format
        ? format(item, index, items)
        : key == null
          ? ""
          : String(key),
      disabled: disabled === null || disabled.has(value),
    };
  });
  if (options.sort) {
    const compare =
      typeof options.sort === "function"
        ? options.sort
        : (a: any, b: any) => (a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN);
    choices.sort(
      (a, b) =>
        (options.sort === "descending" ? -1 : 1) * compare(a.key, b.key),
    );
  }
  if (options.unique) {
    choices = [
      ...new Map(
        choices.map((choice) => [
          choice.key != null && typeof choice.key === "object"
            ? choice.key.valueOf()
            : choice.key,
          choice,
        ]),
      ).values(),
    ];
  }
  return choices;
}

export function notebookSearchFilter(
  query: string,
): (value: unknown) => boolean {
  const terms = String(query)
    .split(/\s+/u)
    .filter(Boolean)
    .map(
      (term) =>
        new RegExp(
          `(?:^|[^\\p{L}-])${term.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&")}`,
          "iu",
        ),
    );
  return (value) =>
    value != null &&
    terms.every((term) =>
      (typeof value === "object" ? Object.values(value) : [value]).some(
        (entry) => term.test(String(entry)),
      ),
    );
}

export function createExtraInput(
  kind: ExtraInputKind,
  args: any[],
  context: NotebookInputHostContext = {},
): Node {
  const host =
    typeof document !== "undefined"
      ? document.createElement("div")
      : new Node();
  const options: InputOptions = (kind === "markdown" ? args[0] : args[1]) ?? {};
  const listeners = new Set<() => void>();
  const cleanup: Array<() => void> = [];
  let disposed = false;
  let actionToken = 0;
  let current: any;
  let ids: string[] = [];
  let formValue: any;
  const formArray = kind === "form" && Array.isArray(args[0]);
  const formEntries: Array<[string, Node & { value?: unknown }]> =
    kind === "form" ? Object.entries(args[0] ?? {}) : [];
  const data = kind === "search" ? arrayify(args[0]) : [];
  const columns = options.columns ?? (args[0] as any)?.columns;
  const changed = (emit = false) => {
    if (disposed || context.isActive?.() === false) return;
    for (const listener of listeners) listener();
    if (emit) host.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const readForm = () => {
    const values = formEntries.map(([, child]) => child.value);
    if (
      !formValue ||
      formEntries.some(
        ([key], index) =>
          !Object.is(formValue[formArray ? index : key], values[index]),
      )
    ) {
      formValue = formArray
        ? values
        : Object.fromEntries(formEntries.map(([key], i) => [key, values[i]]));
    }
    return formValue;
  };
  const choiceIds = (value: any) => {
    const values = model.multiple ? Array.from(value ?? []) : [value];
    const selected = new Set(
      values.map(
        (v) =>
          model.choices.find((c) => Object.is(c.value, v))?.id ??
          model.choices.find((c) => sameValue(c.value, v))?.id,
      ),
    );
    return model.choices.filter((c) => selected.has(c.id)).map((c) => c.id);
  };
  const model: ExtraInputModel = {
    kind,
    options,
    choices: [],
    actions: [],
    children: formEntries.map(([, node]) => node),
    multiple:
      kind === "checkbox" || (kind === "select" && Boolean(options.multiple)),
    pending: false,
    query: String(options.query ?? ""),
    resultLabel: "",
    get value() {
      return kind === "form" ? readForm() : current;
    },
    get ids() {
      return ids;
    },
    choose(next) {
      if (
        disposed ||
        options.disabled === true ||
        context.isActive?.() === false
      )
        return;
      ids = model.choices
        .filter(
          (c) => next.includes(c.id) && (!c.disabled || ids.includes(c.id)),
        )
        .map((c) => c.id);
      const values = ids.map(
        (id) => model.choices.find((c) => c.id === id)!.value,
      );
      current = model.multiple ? values : values.length ? values[0] : null;
      changed(true);
    },
    activate(index) {
      const action = model.actions[index];
      if (
        !action ||
        action.disabled ||
        model.pending ||
        disposed ||
        context.isActive?.() === false
      )
        return;
      const token = ++actionToken;
      try {
        const result = action.reduce(current);
        if (result && typeof (result as any).then === "function") {
          model.pending = true;
          changed();
          void Promise.resolve(result)
            .then(
              (value) => {
                if (
                  !disposed &&
                  token === actionToken &&
                  context.isActive?.() !== false
                ) {
                  current = value;
                  changed(true);
                }
              },
              (error) => {
                if (
                  !disposed &&
                  token === actionToken &&
                  context.isActive?.() !== false
                )
                  context.onError?.(error);
              },
            )
            .finally(() => {
              if (!disposed && token === actionToken) {
                model.pending = false;
                changed();
              }
            });
        } else {
          current = result;
          changed(true);
        }
      } catch (error) {
        context.onError?.(error);
      }
    },
    setText(value) {
      if (
        disposed ||
        options.disabled === true ||
        context.isActive?.() === false ||
        context.signal?.aborted
      )
        return;
      const next = String(value);
      if (next === current) return;
      current = next;
      changed(true);
    },
    setQuery(query, emit = true) {
      if (disposed || context.isActive?.() === false) return;
      model.query = String(query);
      try {
        let next: any[];
        if (!model.query && options.required === false) next = [];
        else {
          const filter = options.filter
            ? options.filter(model.query)
            : notebookSearchFilter(model.query);
          next = data.filter((row, index) =>
            filter(
              options.filter || !columns
                ? row
                : Object.fromEntries(
                    columns.map((key: string) => [key, row?.[key]]),
                  ),
              index,
            ),
          );
        }
        if (columns) Object.assign(next, { columns });
        const resultLabel = options.format
          ? options.format(next.length)
          : `${next.length.toLocaleString(options.locale ?? "en")} result${next.length === 1 ? "" : "s"}`;
        current = next;
        model.resultLabel = resultLabel;
        changed(emit);
      } catch (error) {
        if (!emit) throw error;
        context.onError?.(error);
        changed();
      }
    },

    restore(value) {
      if (disposed) return;
      actionToken++;
      model.pending = false;
      const snapshot = isNotebookInputSnapshot(value) ? value : undefined;
      if (kind === "form") {
        const restored = snapshot?.children ?? value ?? (formArray ? [] : {});
        for (const [key, child] of formEntries) {
          const next = (restored as any)[key];
          if (!restoreNotebookInputState(child, next) && "value" in child)
            child.value = next;
        }
        readForm();
      } else if (kind === "search") {
        model.setQuery(snapshot?.query ?? model.query, false);
      } else if (["checkbox", "radio", "select"].includes(kind)) {
        ids = snapshot?.ids ?? choiceIds(snapshot ? snapshot.value : value);
        const values = model.choices
          .filter((c) => ids.includes(c.id))
          .map((c) => c.value);
        current = model.multiple ? values : values.length ? values[0] : null;
      } else
        current =
          kind === "markdown"
            ? String((snapshot ? snapshot.value : value) ?? "")
            : snapshot
              ? snapshot.value
              : value;
      changed();
    },
    snapshot(capture) {
      const base: NotebookInputSnapshot = {
        __notebookInputState: 1,
        factory: kind,
      };
      if (kind === "form")
        base.children = formArray
          ? formEntries.map(([, child]) =>
              snapshotNotebookInputState(child, capture),
            )
          : Object.fromEntries(
              formEntries.map(([key, child]) => [
                key,
                snapshotNotebookInputState(child, capture),
              ]),
            );
      else if (kind === "search") base.query = model.query;
      else if (["checkbox", "radio", "select"].includes(kind))
        base.ids = [...ids];
      else base.value = current;
      return base;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      actionToken++;
      cleanup.forEach((fn) => fn());
      model.children.forEach(disposeNotebookInput);
      listeners.clear();
    },
  };
  if (["checkbox", "radio", "select"].includes(kind)) {
    model.choices = normalizeNotebookChoices(args[0], options);
    const defaultChoice = model.choices.find(
      (choice) => options.disabled === true || !choice.disabled,
    );
    const initial =
      options.value !== undefined
        ? options.value
        : args[0] instanceof Map && options.key !== undefined
          ? model.multiple
            ? Array.from(options.key as Iterable<unknown>, (key) =>
                args[0].get(key),
              )
            : args[0].get(options.key)
          : model.multiple
            ? []
            : kind === "select"
              ? defaultChoice
                ? defaultChoice.value
                : null
              : null;
    model.restore(initial);
  } else if (kind === "markdown") current = String(options.value ?? "");
  else if (kind === "button") {
    const content = args[0] ?? "≡";
    const solitary = typeof content === "string" || content instanceof Node;
    current = Object.hasOwn(options, "value")
      ? options.value
      : options.required
        ? undefined
        : solitary
          ? 0
          : null;
    const actions = solitary
      ? [[content, options.reduce ?? ((value = 0) => value + 1)]]
      : arrayify(content);
    const disabled =
      options.disabled === true ? null : new Set(options.disabled || []);
    model.actions = actions.map(([content, reduce = (value: any) => value]) => {
      if (typeof reduce !== "function")
        throw new TypeError("Button reduce must be a function");
      return {
        content,
        reduce,
        disabled: disabled === null || disabled.has(content),
      };
    });
  } else if (kind === "search") model.setQuery(model.query, false);
  else if (kind === "form") {
    for (const [, child] of formEntries) {
      if (!(child instanceof Node))
        throw new TypeError("Inputs.form children must be input nodes");
      const handle = (event: Event) => {
        event.stopPropagation();
        const previous = formValue;
        readForm();
        if (event.type === "input" || previous !== formValue) changed(true);
      };
      child.addEventListener("input", handle);
      child.addEventListener("change", handle);
      cleanup.push(() => {
        child.removeEventListener("input", handle);
        child.removeEventListener("change", handle);
      });
    }
    readForm();
    if (options.template) {
      model.template = options.template(args[0]);
      if (!(model.template instanceof Node))
        throw new TypeError("Form template must return a DOM node");
    }
  }
  Object.defineProperty(host, "value", {
    configurable: true,
    get: () => model.value,
    set: (value) => {
      if (kind !== "search") model.restore(value);
    },
  });
  if (kind === "search")
    Object.defineProperty(host, "query", {
      get: () => model.query,
      set: (value) => model.setQuery(value, false),
    });
  models.set(host, model);
  registerNotebookInputState(host, {
    restore: model.restore,
    ready: () =>
      Promise.all(model.children.map(settleNotebookInputState)).then(
        () => undefined,
      ),
    snapshot: model.snapshot,
    dispose: model.dispose,
  });
  return host;
}
