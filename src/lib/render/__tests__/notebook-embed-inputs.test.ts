import { afterEach, expect, test, vi } from "vitest";
const controls = vi.hoisted(() => ({
  reconstruct: vi.fn(),
  settle: vi.fn(async () => {}),
  dispose: vi.fn(),
}));
vi.mock("@lapis-notes/notebook-input", () => ({
  reconstructNotebookInputNode: controls.reconstruct,
  settleNotebookInputState: controls.settle,
  disposeNotebookInput: controls.dispose,
  snapshotNotebookInputState: (node: any) => node.value,
  getNotebookInputNodeValue: (node: any) => node.value,
  setNotebookInputNodeValue: (node: any, value: unknown) => {
    node.value = value;
  },
  bindNotebookInputNode: (node: any, options: any) => {
    node.value = options.initialValue;
    const onChange = () => options.onChange(node.value);
    node.addEventListener("input", onChange);
    return {
      dispose: () => {
        node.removeEventListener("input", onChange);
        controls.dispose(node);
      },
    };
  },
}));
import { NotebookRenderService } from "../notebook-render-service";
import {
  emitNotebookInputChange,
  subscribeNotebookInputChanges,
} from "../../runtime/notebook-dom-registry";

class Input extends EventTarget {
  value: unknown = 2;
}
const cleanup: Array<() => void> = [];
afterEach(() => {
  cleanup.splice(0).forEach((dispose) => dispose());
  vi.clearAllMocks();
});
const output = {
  kind: "input",
  cellId: "controls",
  variableName: "count",
  inputType: "range",
  value: 2,
  reconstructable: true,
} as const;
function fixture() {
  const canonical = new Input();
  const service = new NotebookRenderService(
    {} as any,
    {} as any,
    vi.fn(),
    new Map(),
  );
  vi.spyOn(service, "getOrCreateInputOutput").mockResolvedValue(
    canonical as any,
  );
  controls.reconstruct.mockImplementation(async () => new Input());
  return { service, canonical };
}
test("separate input owners synchronize values and canonical persistence state", async () => {
  const { service, canonical } = fixture();
  const first = (await service.createEmbeddedInputOutput(
    "Notebook.notebook.md",
    output,
  ))!;
  const second = (await service.createEmbeddedInputOutput(
    "Notebook.notebook.md",
    output,
  ))!;
  cleanup.push(first.dispose, second.dispose);
  expect(first.node).not.toBe(second.node);
  (first.node as any).value = 10;
  first.node.dispatchEvent(new Event("input"));
  expect(canonical.value).toBe(10);
  expect((second.node as any).value).toBe(10);
  emitNotebookInputChange({
    sourcePath: "Other.notebook.md",
    cellId: "controls",
    name: "count",
    value: 99,
  });
  expect((second.node as any).value).toBe(10);
  first.dispose();
  (first.node as any).value = 100;
  first.node.dispatchEvent(new Event("input"));
  expect(canonical.value).toBe(10);
});
test("aborting pending input restoration releases the owner and its wait", async () => {
  const { service } = fixture();
  const signal = new AbortController();
  controls.settle.mockReturnValueOnce(new Promise(() => {}));
  const result = service.createEmbeddedInputOutput(
    "Notebook.notebook.md",
    output,
    signal.signal,
  );
  await vi.waitFor(() => expect(controls.settle).toHaveBeenCalledOnce());
  signal.abort();
  expect(await result).toBeNull();
  expect(controls.dispose).toHaveBeenCalledOnce();
});
test("late reconstruction is disposed and never emits changes after cancellation", async () => {
  const { service } = fixture();
  let resolve!: (node: Input) => void;
  controls.reconstruct.mockReturnValueOnce(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const signal = new AbortController();
  const changed = vi.fn();
  cleanup.push(subscribeNotebookInputChanges(changed));
  const result = service.createEmbeddedInputOutput(
    "Notebook.notebook.md",
    output,
    signal.signal,
  );
  await vi.waitFor(() => expect(controls.reconstruct).toHaveBeenCalledOnce());
  signal.abort();
  const node = new Input();
  resolve(node);
  expect(await result).toBeNull();
  node.dispatchEvent(new Event("input"));
  expect(changed).not.toHaveBeenCalled();
  expect(controls.dispose).toHaveBeenCalledWith(node);
});

test.each(["canonical", "copy"])(
  "aborting an unresolved %s releases the embed immediately",
  async (phase) => {
    const { service } = fixture();
    let resolve!: (node: Input) => void;
    const pending = new Promise<Input>((done) => {
      resolve = done;
    });
    if (phase === "canonical")
      vi.mocked(service.getOrCreateInputOutput).mockReturnValueOnce(
        pending as any,
      );
    else controls.reconstruct.mockReturnValueOnce(pending);
    const signal = new AbortController();
    const finished = vi.fn();
    const result = service
      .createEmbeddedInputOutput("Notebook.notebook.md", output, signal.signal)
      .then(finished);
    if (phase === "copy")
      await vi.waitFor(() =>
        expect(controls.reconstruct).toHaveBeenCalledOnce(),
      );
    signal.abort();
    await vi.waitFor(() => expect(finished).toHaveBeenCalledWith(null), {
      timeout: 200,
    });
    const node = new Input();
    resolve(node);
    await result;
    await Promise.resolve();
    if (phase === "copy") expect(controls.dispose).toHaveBeenCalledWith(node);
    else expect(controls.dispose).not.toHaveBeenCalled();
  },
);

test("reports reconstruction failures through the notebook Problems callback", async () => {
  const report = vi.fn();
  const service = new NotebookRenderService(
    {} as any,
    {} as any,
    vi.fn(),
    new Map(),
    undefined,
    undefined,
    undefined,
    report,
  );
  vi.spyOn(service, "getOrCreateInputOutput").mockRejectedValueOnce(
    new Error("Unable to restore input"),
  );
  expect(
    await service.createEmbeddedInputOutput("Notebook.notebook.md", output),
  ).toBeNull();
  expect(report).toHaveBeenCalledWith(
    "Notebook.notebook.md",
    "controls",
    expect.objectContaining({ message: "Unable to restore input" }),
  );
});
