import { expect, test, vi } from "vitest";
import {
  observeNotebookEmbedSource,
  type NotebookEmbedSource,
} from "../notebook-embed-source";

function fixture() {
  const file = { path: "Analysis.notebook.md" };
  const files = new Map([[file.path, file]]);
  const listeners = new Map<string, Set<(...args: any[]) => void>>();
  const vault = {
    getFileByPath: (path: string) => files.get(path),
    cachedRead: vi.fn(async () => "# Saved analysis"),
    on: (event: string, callback: (...args: any[]) => void) => {
      const callbacks = listeners.get(event) ?? new Set();
      callbacks.add(callback);
      listeners.set(event, callbacks);
      return { event, callback };
    },
    offref: ({ event, callback }: any) =>
      listeners.get(event)?.delete(callback),
  };
  const app = { vault } as any;
  const states: NotebookEmbedSource[] = [];
  const emit = (event: string, ...args: any[]) => {
    for (const callback of listeners.get(event) ?? []) callback(...args);
  };
  return { app, file, files, vault, listeners, states, emit };
}

test("reads and refreshes only its owned notebook", async () => {
  const ctx = fixture();
  const dispose = observeNotebookEmbedSource(
    ctx.app,
    ctx.file as any,
    (state) => ctx.states.push(state),
  );
  await vi.waitFor(() =>
    expect(ctx.states.at(-1)?.source).toBe("# Saved analysis"),
  );
  ctx.emit("modify", { path: "Other.md" });
  expect(ctx.vault.cachedRead).toHaveBeenCalledOnce();
  ctx.vault.cachedRead.mockResolvedValueOnce("# Updated analysis");
  ctx.emit("modify", ctx.file);
  await vi.waitFor(() =>
    expect(ctx.states.at(-1)?.source).toBe("# Updated analysis"),
  );
  dispose();
});

test("rejects a stale read after a newer file change", async () => {
  const ctx = fixture();
  let resolveOld!: (value: string) => void;
  ctx.vault.cachedRead.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveOld = resolve;
    }),
  );
  const dispose = observeNotebookEmbedSource(
    ctx.app,
    ctx.file as any,
    (state) => ctx.states.push(state),
  );
  ctx.vault.cachedRead.mockResolvedValueOnce("Newest source");
  ctx.emit("modify", ctx.file);
  await vi.waitFor(() =>
    expect(ctx.states.at(-1)?.source).toBe("Newest source"),
  );
  resolveOld("Obsolete source");
  await Promise.resolve();
  expect(ctx.states.some((state) => state.source === "Obsolete source")).toBe(
    false,
  );
  dispose();
});

test("follows renames and clears deleted content before a late read returns", async () => {
  const ctx = fixture();
  const dispose = observeNotebookEmbedSource(
    ctx.app,
    ctx.file as any,
    (state) => ctx.states.push(state),
  );
  await vi.waitFor(() => expect(ctx.states.at(-1)?.status).toBe("ready"));
  const renamed = { path: "Renamed.notebook.md" };
  ctx.files.delete(ctx.file.path);
  ctx.files.set(renamed.path, renamed);
  ctx.emit("rename", renamed, ctx.file.path);
  await vi.waitFor(() => expect(ctx.states.at(-1)?.path).toBe(renamed.path));
  let resolveRead!: (value: string) => void;
  ctx.vault.cachedRead.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveRead = resolve;
    }),
  );
  ctx.emit("modify", renamed);
  ctx.files.delete(renamed.path);
  ctx.emit("delete", renamed);
  resolveRead("Deleted content");
  await Promise.resolve();
  expect(ctx.states.at(-1)).toEqual({
    path: renamed.path,
    source: "",
    status: "missing",
  });
  ctx.files.set(renamed.path, renamed);
  ctx.emit("create", renamed);
  await vi.waitFor(() => expect(ctx.states.at(-1)?.status).toBe("ready"));
  dispose();
});

test("disposes every listener and ignores late read failures", async () => {
  const ctx = fixture();
  let rejectRead!: (error: Error) => void;
  ctx.vault.cachedRead.mockReturnValueOnce(
    new Promise((_resolve, reject) => {
      rejectRead = reject;
    }),
  );
  const dispose = observeNotebookEmbedSource(
    ctx.app,
    ctx.file as any,
    (state) => ctx.states.push(state),
  );
  dispose();
  rejectRead(new Error("Late failure"));
  await Promise.resolve();
  expect(ctx.states).toEqual([
    { path: ctx.file.path, source: "", status: "loading" },
  ]);
  expect([...ctx.listeners.values()].every((set) => set.size === 0)).toBe(true);
});

test("reports current read failures and recovers on a later change", async () => {
  const ctx = fixture();
  ctx.vault.cachedRead.mockRejectedValueOnce(new Error("Read denied"));
  const dispose = observeNotebookEmbedSource(
    ctx.app,
    ctx.file as any,
    (state) => ctx.states.push(state),
  );
  await vi.waitFor(() => expect(ctx.states.at(-1)?.error).toBe("Read denied"));
  ctx.emit("modify", ctx.file);
  await vi.waitFor(() => expect(ctx.states.at(-1)?.status).toBe("ready"));
  expect(ctx.states.at(-1)?.error).toBeUndefined();
  dispose();
});

test("follows a containing folder rename", async () => {
  const ctx = fixture();
  ctx.files.clear();
  const file = { path: "Original/Analysis.notebook.md" };
  ctx.files.set(file.path, file);
  const dispose = observeNotebookEmbedSource(ctx.app, file as any, (state) =>
    ctx.states.push(state),
  );
  await vi.waitFor(() => expect(ctx.states.at(-1)?.status).toBe("ready"));
  const moved = { path: "Moved/Analysis.notebook.md" };
  ctx.files.delete(file.path);
  ctx.files.set(moved.path, moved);
  ctx.emit("rename", { path: "Moved" }, "Original");
  await vi.waitFor(() => expect(ctx.states.at(-1)?.path).toBe(moved.path));
  dispose();
});

test("ignores successful reads after disposal", async () => {
  const ctx = fixture();
  let resolveRead!: (value: string) => void;
  ctx.vault.cachedRead.mockReturnValueOnce(
    new Promise((resolve) => {
      resolveRead = resolve;
    }),
  );
  const changed = vi.fn();
  const dispose = observeNotebookEmbedSource(ctx.app, ctx.file as any, changed);
  dispose();
  resolveRead("Late content");
  await Promise.resolve();
  expect(changed).toHaveBeenCalledOnce();
});

test("repeated embeds retain independent subscriptions", async () => {
  const ctx = fixture();
  const first = vi.fn();
  const second = vi.fn();
  const disposeFirst = observeNotebookEmbedSource(
    ctx.app,
    ctx.file as any,
    first,
  );
  const disposeSecond = observeNotebookEmbedSource(
    ctx.app,
    ctx.file as any,
    second,
  );
  await vi.waitFor(() => expect(second).toHaveBeenCalledTimes(2));
  disposeFirst();
  ctx.emit("modify", ctx.file);
  await vi.waitFor(() => expect(second).toHaveBeenCalledTimes(3));
  expect(first).toHaveBeenCalledTimes(2);
  disposeSecond();
});
