import { describe, expect, test } from "vitest";
import {
  bindNotebookInputNode,
  getNotebookInputNodeValue,
  setNotebookInputNodeValue,
} from "../input-node";

describe("notebook input node helpers", () => {
  test("seeds, reads, emits, and disposes input values", () => {
    const node = Object.assign(new EventTarget(), {
      value: 1,
    }) as unknown as Node;
    const changes: unknown[] = [];

    const binding = bindNotebookInputNode(node, {
      initialValue: 2,
      onChange: (value) => changes.push(value),
    });

    expect(binding.currentValue).toBe(2);
    expect(getNotebookInputNodeValue(node)).toBe(2);

    setNotebookInputNodeValue(node, 3);
    node.dispatchEvent(new Event("input"));
    node.dispatchEvent(new Event("change"));

    expect(changes).toEqual([3, 3]);

    binding.dispose();
    setNotebookInputNodeValue(node, 4);
    node.dispatchEvent(new Event("input"));

    expect(changes).toEqual([3, 3]);
  });
});
