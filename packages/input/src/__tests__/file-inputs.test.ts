import { afterEach, expect, test, vi } from "vitest";
import { createFileInput, getNotebookFileModel } from "../file-model";
import { acceptsNotebookFile, hasTemporaryNotebookFiles } from "../file-values";
import {
  restoreNotebookInputState,
  snapshotNotebookInputState,
  settleNotebookInputState,
} from "../input-state";

class InputNode extends EventTarget {}
afterEach(() => vi.unstubAllGlobals());
function setup(options = {}, context = {}) {
  vi.stubGlobal("Node", InputNode);
  const node = createFileInput(options, context);
  return { node, model: getNotebookFileModel(node)! };
}
const vault = {
  path: "data/sample.csv",
  name: "sample.csv",
  size: 8,
  lastModified: 4,
};
const upload = (name = "sample.csv") =>
  ({
    name,
    type: "text/csv",
    size: 8,
    lastModified: 5,
    arrayBuffer: async () => new TextEncoder().encode("a,b\n1,2").buffer,
  }) as File;

test("mixed files retain order and same-name sources; reads are lazy and binary-safe", async () => {
  const read = vi.fn(async () => new Uint8Array([0, 255, 128]).buffer);
  const { model } = setup(
    { multiple: true },
    { files: { list: async () => [vault], read } },
  );
  const event = vi.fn();
  model.addVault([vault]);
  model.addUploads([upload(), upload()]);
  expect(model.selected.map((file) => file.source)).toEqual([
    "vault",
    "upload",
    "upload",
  ]);
  expect(read).not.toHaveBeenCalled();
  expect([...new Uint8Array(await model.selected[0]!.arrayBuffer())]).toEqual([
    0, 255, 128,
  ]);
  expect(await model.selected[1]!.text()).toBe("a,b\n1,2");
  expect(await model.selected[1]!.blob()).toMatchObject({ type: "text/csv" });
  expect(event).not.toHaveBeenCalled();
});

test("empty cancelled upload leaves selection unchanged and emits nothing", () => {
  const { node, model } = setup();
  const event = vi.fn();
  node.addEventListener("input", event);
  model.addUploads([upload()]);
  const value = model.value;
  model.addUploads([]);
  expect(model.value).toBe(value);
  expect(event).toHaveBeenCalledTimes(1);
});

test("multiple snapshots retain unavailable upload markers until reselection", () => {
  const first = setup({ multiple: true });
  first.model.addUploads([upload()]);
  const saved = snapshotNotebookInputState(first.node);
  const second = setup({ multiple: true });
  restoreNotebookInputState(second.node, saved);
  expect(second.model.needsReselection).toBe(true);
  expect(second.model.selected).toEqual([]);
  expect(hasTemporaryNotebookFiles(second.model.snapshot())).toBe(true);
  expect(JSON.stringify(saved)).not.toContain("arrayBuffer");
});

test("vault restoration revalidates references and ignores late results after teardown", async () => {
  let finish!: (files: (typeof vault)[]) => void;
  const { node, model } = setup(
    {},
    {
      files: {
        list: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
        read: async () => new ArrayBuffer(0),
      },
    },
  );
  model.addVault([vault]);
  const saved = model.snapshot();
  restoreNotebookInputState(node, saved);
  await Promise.resolve();
  model.dispose();
  finish([]);
  await Promise.resolve();
  expect(model.selected).toEqual([]);
  expect(model.error).toBe("");
});

test("missing vault file requests reselection", async () => {
  const { node, model } = setup(
    {},
    { files: { list: async () => [], read: async () => new ArrayBuffer(0) } },
  );
  model.addVault([vault]);
  restoreNotebookInputState(node, model.snapshot());
  await settleNotebookInputState(node);
  expect(model.needsReselection).toBe(true);
  expect(model.error).toContain("no longer in the vault");
});

test("accept matches extensions and inferred MIME types; disabled mutation is ignored", () => {
  expect(acceptsNotebookFile(vault, "text/*")).toBe(true);
  expect(acceptsNotebookFile(vault, ".CSV")).toBe(true);
  expect(acceptsNotebookFile(vault, "image/*")).toBe(false);
  const { model } = setup({ disabled: true });
  model.addUploads([upload()]);
  expect(model.value).toBe(null);
});

test("ordinary reruns retain uploads and refresh vault readers for the new owner", async () => {
  const first = setup({ multiple: true });
  first.model.addUploads([upload()]);
  const second = setup({ multiple: true });
  restoreNotebookInputState(second.node, first.model.value);
  first.model.dispose();
  expect(second.model.selected[0]!.source).toBe("upload");
  expect(await second.model.selected[0]!.text()).toBe("a,b\n1,2");
});

test("late chooser and read results after cancellation are ignored", async () => {
  let active = true;
  let resolveList!: (files: (typeof vault)[]) => void;
  let resolveRead!: (bytes: ArrayBuffer) => void;
  const { model } = setup(
    {},
    {
      isActive: () => active,
      files: {
        list: () =>
          new Promise((resolve) => {
            resolveList = resolve;
          }),
        read: () =>
          new Promise((resolve) => {
            resolveRead = resolve;
          }),
      },
    },
  );
  model.addVault([vault]);
  const list = model.list();
  const read = model.selected[0]!.arrayBuffer();
  active = false;
  resolveList([vault]);
  resolveRead(new ArrayBuffer(1));
  await expect(list).resolves.toEqual([]);
  await expect(read).rejects.toThrow("no longer available");
  model.addUploads([upload()]);
  expect(model.selected[0]!.source).toBe("vault");
});

test("view waits for vault restoration before exposing a missing attachment to cells", async () => {
  const { createNotebookViewRuntime } = await import("../view-runtime");
  let finish!: (files: (typeof vault)[]) => void;
  const { node } = setup(
    {},
    {
      files: {
        list: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
        read: vi.fn(),
      },
    },
  );
  const reference = {
    __notebookInputState: 1,
    factory: "file",
    value: { __notebookFile: 1, source: "vault", ...vault },
  };
  const view = createNotebookViewRuntime({
    cellId: "files",
    getInputValue: () => reference,
    setInputValue: vi.fn(),
    emitInputChange: vi.fn(),
    createOutputId: () => "files",
    registerOutput: vi.fn(),
    createOutput: vi.fn(),
    appendOutput: vi.fn(),
  });
  let settled = false;
  const result = view("files", node).then((value) => {
    settled = true;
    return value;
  });
  for (let i = 0; i < 4; i++) await Promise.resolve();
  expect(settled).toBe(false);
  finish([]);
  await expect(result).resolves.toBe(null);
});

test("aborting an owner releases pending restoration and ignores its eventual list", async () => {
  const controller = new AbortController();
  let finish!: (files: (typeof vault)[]) => void;
  const { node, model } = setup(
    {},
    {
      signal: controller.signal,
      isActive: () => !controller.signal.aborted,
      files: {
        list: () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
        read: vi.fn(),
      },
    },
  );
  model.addVault([vault]);
  restoreNotebookInputState(node, model.snapshot());
  await Promise.resolve();
  const pending = settleNotebookInputState(node);
  controller.abort();
  await pending;
  finish([vault]);
  await Promise.resolve();
  expect(model.disposed).toBe(true);
  expect(model.selected).toEqual([]);
});

test("cancelled restoration cannot publish a late view value or register its output", async () => {
  const { createNotebookViewRuntime } = await import("../view-runtime");
  const controller = new AbortController();
  const { node } = setup(
    {},
    {
      signal: controller.signal,
      files: { list: () => new Promise(() => {}), read: vi.fn() },
    },
  );
  const setInputValue = vi.fn();
  const registerOutput = vi.fn();
  const view = createNotebookViewRuntime({
    signal: controller.signal,
    cellId: "files",
    getInputValue: () => ({
      __notebookInputState: 1,
      factory: "file",
      value: { __notebookFile: 1, source: "vault", ...vault },
    }),
    setInputValue,
    emitInputChange: vi.fn(),
    createOutputId: () => "files",
    registerOutput,
    createOutput: vi.fn(),
    appendOutput: vi.fn(),
  });
  const result = view("files", node);
  const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });
  await Promise.resolve();
  controller.abort();
  await rejected;
  expect(setInputValue).not.toHaveBeenCalled();
  expect(registerOutput).not.toHaveBeenCalled();
});
