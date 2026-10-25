import { afterEach, describe, expect, test, vi } from "vitest";
import { attachNotebookInputMetadata } from "../dom-runtime";
import { createNotebookViewRuntime } from "../view-runtime";

describe("notebook view runtime", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test("binds a DOM input node through host callbacks", async () => {
    class FakeNode extends EventTarget {
      value: unknown;

      constructor(value: unknown) {
        super();
        this.value = value;
      }
    }
    vi.stubGlobal("Node", FakeNode);

    const node = new FakeNode(1) as unknown as Node;
    const inputValues = new Map<string, unknown>([["gain", 2]]);
    const registrations: unknown[] = [];
    const changes: unknown[] = [];
    const outputs: unknown[] = [];

    const view = createNotebookViewRuntime({
      cellId: "controls",
      sourcePath: "Inputs.notebook.md",
      getInputValue: (name) => inputValues.get(name),
      setInputValue: (_cellId, name, value) => inputValues.set(name, value),
      emitInputChange: (event) => changes.push(event),
      createOutputId: (cellId, name) => `${cellId}:${name}`,
      registerOutput: (registration) => registrations.push(registration),
      createOutput: (options) => options,
      appendOutput: (output) => outputs.push(output),
    });

    await expect(view("gain", node)).resolves.toBe(2);
    expect(inputValues.get("gain")).toBe(2);
    expect(registrations).toEqual([
      expect.objectContaining({
        outputId: "controls:gain",
        sourcePath: "Inputs.notebook.md",
        cellId: "controls",
        name: "gain",
        role: "input",
        node,
      }),
    ]);
    expect(outputs).toEqual([
      {
        outputId: "controls:gain",
        cellId: "controls",
        label: "gain",
        role: "input",
        metadata: undefined,
      },
    ]);

    (node as unknown as { value: unknown }).value = 5;
    node.dispatchEvent(new Event("input"));

    expect(inputValues.get("gain")).toBe(5);
    expect(changes).toEqual([
      {
        sourcePath: "Inputs.notebook.md",
        cellId: "controls",
        name: "gain",
        value: 5,
      },
    ]);

    const registration = registrations[0] as { dispose: () => void };
    registration.dispose();
    (node as unknown as { value: unknown }).value = 7;
    node.dispatchEvent(new Event("change"));

    expect(inputValues.get("gain")).toBe(5);
    expect(changes).toHaveLength(1);
  });

  test("requires a cell id and DOM node", async () => {
    const viewWithoutCell = createNotebookViewRuntime({
      getInputValue: () => undefined,
      setInputValue: () => {},
      emitInputChange: () => {},
      createOutputId: () => "output",
      registerOutput: () => {},
      createOutput: () => ({}),
      appendOutput: () => {},
    });

    await expect(viewWithoutCell("gain", {})).rejects.toThrow(
      "Observable inputs require a notebook cell id",
    );

    class FakeNode extends EventTarget {}
    vi.stubGlobal("Node", FakeNode);
    const view = createNotebookViewRuntime({
      cellId: "controls",
      getInputValue: () => undefined,
      setInputValue: () => {},
      emitInputChange: () => {},
      createOutputId: () => "output",
      registerOutput: () => {},
      createOutput: () => ({}),
      appendOutput: () => {},
    });

    await expect(view("gain", {})).rejects.toThrow(
      "view(gain, ...) must resolve to a DOM node",
    );
  });

  test("passes tracked input metadata to the host output factory", async () => {
    class FakeNode extends EventTarget {
      value: unknown;

      constructor(value: unknown) {
        super();
        this.value = value;
      }
    }
    vi.stubGlobal("Node", FakeNode);

    const node = new FakeNode(5) as unknown as Node;
    attachNotebookInputMetadata(node, {
      inputType: "range",
      value: 5,
      label: "Gain",
      config: { min: 0, max: 10, step: 1 },
      reconstructable: true,
      source: {
        library: "@lapis-notes/notebook-input",
        factory: "range",
      },
    });

    const outputs: unknown[] = [];
    const view = createNotebookViewRuntime({
      cellId: "controls",
      sourcePath: "Inputs.notebook.md",
      getInputValue: () => undefined,
      setInputValue: () => {},
      emitInputChange: () => {},
      createOutputId: (cellId, name) => `${cellId}:${name}`,
      registerOutput: () => {},
      createOutput: (options) => options,
      appendOutput: (output) => outputs.push(output),
    });

    await expect(view("gain", node)).resolves.toBe(5);
    expect(outputs).toEqual([
      {
        outputId: "controls:gain",
        cellId: "controls",
        label: "gain",
        role: "input",
        metadata: {
          inputType: "range",
          value: 5,
          label: "Gain",
          config: { min: 0, max: 10, step: 1 },
          reconstructable: true,
          source: {
            library: "@lapis-notes/notebook-input",
            factory: "range",
          },
        },
      },
    ]);
  });
});
