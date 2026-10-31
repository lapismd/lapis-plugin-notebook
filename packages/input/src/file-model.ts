import type {
  NotebookInputHostContext,
  NotebookVaultFile,
} from "./host-context";
import {
  acceptsNotebookFile,
  isNotebookFileReference,
  isNotebookInputFile,
  snapshotNotebookFile,
  uploadedInputFile,
  vaultInputFile,
  type NotebookFileReference,
  type NotebookInputFile,
} from "./file-values";
import {
  disposeNotebookInput,
  isNotebookInputSnapshot,
  registerNotebookInputState,
  type NotebookInputSnapshot,
  type NotebookInputSnapshotOptions,
} from "./input-state";
import type { InputOptions } from "./extra-model";

export interface NotebookFileModel {
  options: InputOptions;
  readonly selected: NotebookInputFile[];
  readonly value: NotebookInputFile | NotebookInputFile[] | null;
  readonly disposed: boolean;
  error: string;
  needsReselection: boolean;
  pending: boolean;
  readonly canChooseVault: boolean;
  list(): Promise<NotebookVaultFile[]>;
  addVault(files: NotebookVaultFile[]): void;
  addUploads(files: File[]): void;
  remove(index: number): void;
  restore(value: unknown): void;
  snapshot(capture?: NotebookInputSnapshotOptions): NotebookInputSnapshot;
  subscribe(listener: () => void): () => void;
  dispose(): void;
}
const models = new WeakMap<object, NotebookFileModel>();
export const getNotebookFileModel = (node: object) => models.get(node);

export function createFileInput(
  options: InputOptions = {},
  context: NotebookInputHostContext = {},
): Node {
  const host =
    typeof document !== "undefined"
      ? document.createElement("div")
      : new Node();
  let selected: NotebookInputFile[] = [];
  let disposed = false;
  let token = 0;
  let restoration = Promise.resolve();
  let release!: () => void;
  const closed = new Promise<void>((resolve) => {
    release = resolve;
  });
  const abort = () => disposeNotebookInput(host);
  let unavailable: NotebookFileReference[] = [];
  const listeners = new Set<() => void>();
  const active = () => !disposed && context.isActive?.() !== false;
  const changed = (emit = false) => {
    if (!active()) return;
    listeners.forEach((fn) => fn());
    if (emit) host.dispatchEvent(new Event("input", { bubbles: true }));
  };
  const add = (files: NotebookInputFile[]) => {
    if (!active() || options.disabled || !files.length) return;
    const invalid = files.find(
      (file) => !acceptsNotebookFile(file, options.accept),
    );
    if (invalid) {
      model.error = `${invalid.name} does not match the accepted file types`;
      changed();
      return;
    }
    token++;
    unavailable = [];
    model.pending = false;
    selected = options.multiple
      ? [
          ...selected,
          ...files.filter(
            (file) =>
              file.source !== "vault" ||
              !selected.some(
                (current) =>
                  current.source === "vault" && current.path === file.path,
              ),
          ),
        ]
      : [files[0]!];
    model.error = "";
    model.needsReselection = false;
    changed(true);
  };
  const model: NotebookFileModel = {
    options,
    error: "",
    pending: false,
    needsReselection: false,
    get selected() {
      return selected;
    },
    get disposed() {
      return disposed;
    },
    get value() {
      return options.multiple ? selected : (selected[0] ?? null);
    },
    get canChooseVault() {
      return Boolean(context.files);
    },
    async list() {
      if (!active() || options.disabled || !context.files) return [];
      const request = ++token;
      model.pending = true;
      changed();
      try {
        const files = await context.files.list();
        return active() && request === token
          ? files.filter((file) => acceptsNotebookFile(file, options.accept))
          : [];
      } catch (error) {
        if (active() && request === token) {
          model.error = error instanceof Error ? error.message : String(error);
          context.onError?.(error);
        }
        return [];
      } finally {
        if (active() && request === token) {
          model.pending = false;
          changed();
        }
      }
    },
    addVault(files) {
      add(files.map((file) => vaultInputFile(file, context)));
    },
    addUploads(files) {
      add(files.map(uploadedInputFile));
    },
    remove(index) {
      if (!active() || options.disabled) return;
      token++;
      model.pending = false;
      selected = selected.filter((_, i) => i !== index);
      model.error =
        options.required && !selected.length ? "Select a file." : "";
      changed(true);
    },
    restore(value) {
      if (!active()) return;
      const raw = isNotebookInputSnapshot(value) ? value.value : value;
      const values = Array.isArray(raw) ? raw : raw == null ? [] : [raw];
      token++;
      model.pending = false;
      restoration = Promise.resolve();
      unavailable = [];
      model.needsReselection = false;
      selected = values.flatMap((value) => {
        if (isNotebookInputFile(value))
          return [
            value.source === "vault"
              ? vaultInputFile({ ...value, path: value.path! }, context)
              : value,
          ];
        if (!isNotebookFileReference(value)) return [];
        if (value.source === "upload") {
          unavailable.push(value);
          model.needsReselection = true;
          return [];
        }
        return value.path
          ? [
              vaultInputFile(
                {
                  path: value.path,
                  name: value.name,
                  type: value.type,
                  size: value.size,
                  lastModified: value.lastModified,
                },
                context,
              ),
            ]
          : [];
      });
      changed();
      if (context.files && selected.some((file) => file.source === "vault")) {
        const request = ++token;
        model.pending = true;
        changed();
        restoration = Promise.resolve()
          .then(() => context.files!.list())
          .then(
            (files) => {
              if (!active() || request !== token) return;
              const byPath = new Map(files.map((file) => [file.path, file]));
              const paths = new Set(byPath.keys());
              const missing = selected.filter(
                (file) => file.source === "vault" && !paths.has(file.path!),
              );
              if (missing.length) {
                unavailable.push(
                  ...missing.map((file) => ({
                    ...snapshotNotebookFile(file),
                    needsReselection: true,
                  })),
                );
                selected = selected.filter(
                  (file) => file.source !== "vault" || paths.has(file.path!),
                );
                model.error = `Choose again: ${missing.map((file) => file.name).join(", ")} is no longer in the vault`;
                model.needsReselection = true;
              }
              selected = selected.map((file) =>
                file.source === "vault"
                  ? vaultInputFile(byPath.get(file.path!)!, context)
                  : file,
              );
              changed();
            },
            (error) => {
              if (active() && request === token) {
                selected = selected.filter((file) => file.source !== "vault");
                model.error = String(error);
                context.onError?.(error);
                changed();
              }
            },
          )
          .finally(() => {
            if (active() && request === token) {
              model.pending = false;
              changed();
            }
          });
      }
    },
    snapshot(capture) {
      const values = [
        ...(capture?.transient ? selected : selected.map(snapshotNotebookFile)),
        ...unavailable,
      ];
      return {
        __notebookInputState: 1,
        factory: "file",
        value: options.multiple ? values : (values[0] ?? null),
      };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      token++;
      release();
      context.signal?.removeEventListener("abort", abort);
      listeners.clear();
      selected = [];
      unavailable = [];
    },
  };
  Object.defineProperty(host, "value", {
    configurable: true,
    get: () => model.value,
    set() {
      /* Browser file inputs cannot be assigned programmatically. */
    },
  });
  models.set(host, model);
  registerNotebookInputState(host, {
    restore: model.restore,
    ready: () => Promise.race([restoration, closed]),
    snapshot: model.snapshot,
    dispose: model.dispose,
  });
  context.signal?.addEventListener("abort", abort, { once: true });
  if (context.signal?.aborted) abort();
  return host;
}
