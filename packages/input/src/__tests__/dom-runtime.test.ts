import { afterEach, describe, expect, test, vi } from "vitest";
import {
  canReconstructNotebookInput,
  createTrackedNotebookInputs,
  getNotebookInputMetadata,
  isTemplateStringsArray,
  reconstructNotebookInputNode,
} from "../dom-runtime";

vi.mock("@lapis-notes/notebook-stdlib/dom", async () => {
  const actual = await vi.importActual<
    typeof import("@lapis-notes/notebook-stdlib/dom")
  >("@lapis-notes/notebook-stdlib/dom");
  return {
    ...actual,
    loadNotebookStdlibDomRuntime: vi.fn(async () => ({
      html: vi.fn(),
      svg: vi.fn(),
    })),
  };
});

const originalNode = globalThis.Node;

afterEach(() => {
  if (originalNode) {
    globalThis.Node = originalNode;
  } else {
    delete (globalThis as { Node?: typeof Node }).Node;
  }
});

describe("notebook DOM runtime helpers", () => {
  test("detects template string arrays", () => {
    const taggedValues: unknown[] = [];
    ((strings: TemplateStringsArray) => taggedValues.push(strings))`hello`;

    expect(isTemplateStringsArray(taggedValues[0])).toBe(true);
    expect(isTemplateStringsArray(["hello"])).toBe(false);
    expect(isTemplateStringsArray("hello")).toBe(false);
  });

  test("tracks reconstructable range input metadata", () => {
    class FakeInput {
      constructor(public value: unknown) {}
    }

    const Inputs = createTrackedNotebookInputs({
      range(extent: [number, number], options: Record<string, unknown>) {
        return new FakeInput(options.value);
      },
    });

    const input = (
      Inputs.range as (
        extent: [number, number],
        options: Record<string, unknown>,
      ) => FakeInput
    )([0, 10], { value: 5, step: 1, label: "Gain" });

    expect(getNotebookInputMetadata(input)).toEqual({
      inputType: "range",
      value: 5,
      label: "Gain",
      config: {
        min: 0,
        max: 10,
        step: 1,
        label: "Gain",
      },
      reconstructable: true,
      source: {
        library: "@lapis-notes/notebook-input",
        factory: "range",
      },
    });
  });

  test("tracks reconstructable table input metadata with DSV column order", () => {
    class FakeInput {
      constructor(public value: unknown) {}
    }

    const rows = Object.assign([{ second: 2, first: 1 }], {
      columns: ["first", "second"],
    });
    const Inputs = createTrackedNotebookInputs({
      table(data: unknown, config: Record<string, unknown>) {
        return new FakeInput(config.value ?? data);
      },
    });

    const input = (
      Inputs.table as (
        data: unknown,
        config: Record<string, unknown>,
      ) => FakeInput
    )(rows, {
      label: "Rows",
      value: rows,
      rows: 5,
    });

    expect(getNotebookInputMetadata(input)).toEqual({
      inputType: "table",
      value: rows,
      label: "Rows",
      config: {
        label: "Rows",
        rows: 5,
        data: Object.assign([{ second: 2, first: 1 }], {
          columns: ["first", "second"],
        }),
      },
      reconstructable: true,
      source: {
        library: "@lapis-notes/notebook-input",
        factory: "table",
      },
    });
  });

  test("marks unserializable option-list inputs as non-reconstructable", () => {
    class FakeInput {
      constructor(public value: unknown) {}
    }

    const Inputs = createTrackedNotebookInputs({
      select(options: unknown[], config: Record<string, unknown>) {
        return new FakeInput(config.value);
      },
    });

    const input = (
      Inputs.select as (
        options: unknown[],
        config: Record<string, unknown>,
      ) => FakeInput
    )([{ label: "North", format: () => "North" }], {
      value: "North",
      label: "Region",
    });

    expect(getNotebookInputMetadata(input)).toEqual({
      inputType: "select",
      value: "North",
      label: "Region",
      config: {
        label: "Region",
        options: undefined,
      },
      reconstructable: false,
      source: {
        library: "@lapis-notes/notebook-input",
        factory: "select",
      },
    });
  });

  test("detects reconstructable tracked input metadata", () => {
    expect(
      canReconstructNotebookInput({
        inputType: "range",
        value: 5,
        config: { min: 0, max: 10, step: 1, label: "Gain" },
        reconstructable: true,
        source: {
          library: "@lapis-notes/notebook-input",
          factory: "range",
        },
      }),
    ).toBe(true);

    expect(
      canReconstructNotebookInput({
        inputType: "select",
        value: "North",
        config: { options: undefined },
        reconstructable: false,
        source: {
          library: "@lapis-notes/notebook-input",
          factory: "select",
        },
      }),
    ).toBe(false);
  });

  test("reconstructs supported inputs from persisted metadata", async () => {
    class FakeNode {
      value: unknown;
    }

    globalThis.Node = FakeNode as unknown as typeof Node;

    const node = await reconstructNotebookInputNode({
      inputType: "range",
      value: 5,
      config: { min: 0, max: 10, step: 1, label: "Gain" },
      reconstructable: true,
      source: {
        library: "@lapis-notes/notebook-input",
        factory: "range",
      },
    });

    expect(node).toBeInstanceOf(FakeNode);
    expect((node as unknown as FakeNode).value).toBe(5);
  });

  test("reconstructs tracked table inputs from persisted metadata", async () => {
    class FakeNode {
      value: unknown;
    }

    globalThis.Node = FakeNode as unknown as typeof Node;

    const node = await reconstructNotebookInputNode({
      inputType: "table",
      value: [{ second: 2, first: 1 }],
      config: {
        label: "Rows",
        rows: 5,
        data: Object.assign([{ second: 2, first: 1 }], {
          columns: ["first", "second"],
        }),
      },
      reconstructable: true,
      source: {
        library: "@lapis-notes/notebook-input",
        factory: "table",
      },
    });

    expect(node).toBeInstanceOf(FakeNode);
    expect((node as unknown as FakeNode).value).toEqual([
      { second: 2, first: 1 },
    ]);
  });
});
