import { afterEach, expect, test, vi } from "vitest";
import { loadUiBackedNotebookInputs } from "../ui-runtime";
import {
  createTrackedNotebookInputs,
  canReconstructNotebookInput,
  getNotebookInputMetadata,
} from "../dom-runtime";

class InputNode extends EventTarget {
  value: unknown;
}
afterEach(() => vi.unstubAllGlobals());

async function inputs() {
  vi.stubGlobal("Node", InputNode);
  return (await loadUiBackedNotebookInputs()).inputs as Record<
    string,
    (...args: any[]) => any
  >;
}

test.each([
  ["button", ["Refresh"], 0],
  ["markdown", [{}], ""],
  ["checkbox", [["Salty", "Sweet"]], []],
  ["radio", [["Small", "Large"]], null],
  ["select", [["Small", "Large"]], "Small"],
  ["file", [{}], null],
  ["search", [["Alabama", "Alaska"]], ["Alabama", "Alaska"]],
  ["form", [[]], []],
])(
  "supports Inputs.%s without loading UI dependencies",
  async (factory, args, expected) => {
    const api = await inputs();
    expect(api[factory as string]!(...(args as any[])).value).toEqual(expected);
  },
);

test("choice values retain their original objects and Map values", async () => {
  const api = await inputs();
  const value = { id: 42 };
  const node = api.select!(new Map([["Answer", value]]));
  expect(node.value).toBe(value);
  expect(
    api.checkbox!(new Map([["Answer", value]]), { value: [value] }).value[0],
  ).toBe(value);
});

test("search exposes query and matches every token at a word boundary", async () => {
  const api = await inputs();
  const rows = [
    { name: "Worldwide Hello Services", secret: "unrelated" },
    { name: "hello", secret: "world" },
  ];
  const node = api.search!(rows, { query: "hello world", columns: ["name"] });
  expect(Array.from(node.value)).toEqual([rows[0]]);
  expect(node.value.columns).toEqual(["name"]);
  node.query = "hello";
  expect(Array.from(node.value)).toEqual(rows);
  node.query = "";
  expect(Array.from(node.value)).toEqual(rows);
});

test("forms aggregate live values with one event per child change", async () => {
  const api = await inputs();
  const child = api.text!({ value: "Ada" });
  const form = api.form!({ name: child });
  const changed = vi.fn();
  form.addEventListener("input", changed);
  expect(form.value).toEqual({ name: "Ada" });
  child.value = "Grace";
  child.dispatchEvent(new Event("input"));
  expect(form.value).toEqual({ name: "Grace" });
  expect(changed).toHaveBeenCalledTimes(1);
});

test("Map choices and composed forms have reconstructable metadata", async () => {
  const api = createTrackedNotebookInputs(await inputs()) as Record<
    string,
    (...args: any[]) => any
  >;
  const choice = api.select!(
    new Map([
      ["One", 1],
      ["Two", 2],
    ]),
    { value: 2 },
  );
  const metadata = getNotebookInputMetadata(choice)!;
  expect(canReconstructNotebookInput(metadata)).toBe(true);
  const form = api.form!({ choice });
  expect(canReconstructNotebookInput(getNotebookInputMetadata(form)!)).toBe(
    true,
  );
});

test("choice formatting receives original data and supports keys, sorting and disabled values", async () => {
  const api = await inputs();
  const data = [{ n: 2 }, { n: 1 }];
  const format = vi.fn((row) => `Number ${row.n}`);
  const node = api.select!(data, {
    keyof: (row: any) => row.n,
    format,
    sort: true,
    disabled: [data[1]],
  });
  expect(format).toHaveBeenCalledWith(data[0], 0, data);
  expect(node.value).toBe(data[0]);
  expect(
    api.select!(
      new Map([
        ["One", 1],
        ["Two", 2],
      ]),
      { key: "Two" },
    ).value,
  ).toBe(2);
});

test("choice and recursive form snapshots reconstruct with typed values", async () => {
  const { reconstructNotebookInputNode } = await import("../dom-runtime");
  const { snapshotNotebookInputState } = await import("../input-state");
  const api = createTrackedNotebookInputs(await inputs()) as Record<
    string,
    (...args: any[]) => any
  >;
  const form = api.form!({
    chosen: api.select!(
      new Map([
        ["One", { n: 1 }],
        ["Two", { n: 2 }],
      ]),
      { value: { n: 2 } },
    ),
    many: api.checkbox!([1, 2], { value: [2] }),
  });
  const metadata = getNotebookInputMetadata(form)!;
  const restored = await reconstructNotebookInputNode(
    JSON.parse(
      JSON.stringify({ ...metadata, value: snapshotNotebookInputState(form) }),
    ),
  );
  expect((restored as any).value).toEqual({ chosen: { n: 2 }, many: [2] });
});

test("search supports required false, custom filters and query assignment without events", async () => {
  const api = await inputs();
  const node = api.search!([1, 2, 3], {
    required: false,
    filter: (query: string) => (row: number) => row >= Number(query),
  });
  const changed = vi.fn();
  node.addEventListener("input", changed);
  expect(node.value).toEqual([]);
  node.query = "2";
  expect(node.value).toEqual([2, 3]);
  expect(changed).not.toHaveBeenCalled();
});

test("reducer failures report once and late results after disposal are ignored", async () => {
  const { createExtraInput, getExtraInputModel } = await import(
    "../extra-model"
  );
  const { disposeNotebookInput } = await import("../input-state");
  await inputs();
  let resolve!: (value: number) => void;
  const onError = vi.fn();
  const node = createExtraInput(
    "button",
    [
      "Wait",
      {
        reduce: () =>
          new Promise<number>((done) => {
            resolve = done;
          }),
      },
    ],
    { onError },
  );
  const model = getExtraInputModel(node)!;
  const changed = vi.fn();
  node.addEventListener("input", changed);
  model.activate(0);
  disposeNotebookInput(node);
  resolve(42);
  await Promise.resolve();
  await Promise.resolve();
  expect((node as any).value).toBe(0);
  expect(changed).not.toHaveBeenCalled();
  const failed = createExtraInput(
    "button",
    [
      "Fail",
      {
        reduce: () => {
          throw Error("failure");
        },
      },
    ],
    { onError },
  );
  getExtraInputModel(failed)!.activate(0);
  expect(onError).toHaveBeenCalledOnce();
});

test("custom form templates own children and dispose child listeners", async () => {
  const api = await inputs();
  const { getExtraInputModel } = await import("../extra-model");
  const { disposeNotebookInput } = await import("../input-state");
  const child = api.checkbox!([1, 2]);
  const template = new Node();
  const form = api.form!([child], {
    template: (children: Node[]) => {
      expect(children).toEqual([child]);
      return template;
    },
  });
  const changed = vi.fn();
  form.addEventListener("input", changed);
  expect(getExtraInputModel(form)!.template).toBe(template);
  form.value = [[2]];
  expect(form.value).toEqual([[2]]);
  expect(changed).not.toHaveBeenCalled();
  disposeNotebookInput(form);
  getExtraInputModel(child)!.choose(["0"]);
  expect(changed).not.toHaveBeenCalled();
  expect(() => api.form!([child], { template: () => "invalid" })).toThrow(
    "DOM node",
  );
});

test("single selects retain an undefined first value and the default while disabled", async () => {
  const api = await inputs();
  expect(api.select!([undefined, 1]).value).toBe(undefined);
  expect(api.select!([1, 2], { disabled: true }).value).toBe(1);
});

test("search skips custom filtering for an optional empty query", async () => {
  const api = await inputs();
  const filter = vi.fn(() => () => true);
  const node = api.search!([1, 2], { required: false, filter });
  expect(node.value).toEqual([]);
  expect(filter).not.toHaveBeenCalled();
  node.query = "one";
  expect(filter).toHaveBeenCalledOnce();
});

test("search callback failures are reported without escaping the UI event", async () => {
  await inputs();
  const { createExtraInput, getExtraInputModel } = await import(
    "../extra-model"
  );
  const onError = vi.fn();
  const node = createExtraInput(
    "search",
    [
      [1, 2],
      {
        filter: (query: string) => {
          if (query === "bad") throw Error("Bad query");
          return () => true;
        },
      },
    ],
    { onError },
  );
  expect(() => getExtraInputModel(node)!.setQuery("bad")).not.toThrow();
  expect(onError).toHaveBeenCalledWith(
    expect.objectContaining({ message: "Bad query" }),
  );
});

test("markdown is a live string with one event, restoration and teardown", async () => {
  const { getExtraInputModel } = await import("../extra-model");
  const { snapshotNotebookInputState, disposeNotebookInput } = await import(
    "../input-state"
  );
  const { reconstructNotebookInputNode } = await import("../dom-runtime");
  const api = createTrackedNotebookInputs(await inputs()) as Record<
    string,
    (...args: any[]) => any
  >;
  const node = api.markdown!({ label: "Notes", value: "**Hello**" });
  const changed = vi.fn();
  node.addEventListener("input", changed);
  const model = getExtraInputModel(node)!;
  model.setText("**Updated**");
  model.setText("**Updated**");
  expect(node.value).toBe("**Updated**");
  expect(changed).toHaveBeenCalledTimes(1);
  const metadata = getNotebookInputMetadata(node)!;
  const restored = await reconstructNotebookInputNode(
    JSON.parse(
      JSON.stringify({ ...metadata, value: snapshotNotebookInputState(node) }),
    ),
  );
  expect((restored as any).value).toBe("**Updated**");
  disposeNotebookInput(node);
  model.setText("late");
  expect(node.value).toBe("**Updated**");
  expect(changed).toHaveBeenCalledTimes(1);
});

test("markdown ignores disabled, cancelled and inactive edits", async () => {
  const { createExtraInput, getExtraInputModel } = await import(
    "../extra-model"
  );
  await inputs();
  for (const mode of ["disabled", "aborted", "inactive"]) {
    const abort = new AbortController();
    const node = createExtraInput(
      "markdown",
      [{ value: "kept", disabled: mode === "disabled" }],
      { signal: abort.signal, isActive: () => mode !== "inactive" },
    );
    if (mode === "aborted") abort.abort();
    getExtraInputModel(node)!.setText("late");
    expect((node as any).value).toBe("kept");
  }
});
