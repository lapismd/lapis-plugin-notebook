import { expect, test, vi } from "vitest";
import { formatNotebookDisplayValue } from "../notebook-display-value";

test.each([
  [new Date("2026-10-31T00:00:00Z"), 'new Date("2026-10-31T00:00:00.000Z")'],
  [/hello/gi, "/hello/gi"],
  [new Map([["key", 1]]), 'new Map([\n  [\n    "key",\n    1\n  ]\n])'],
  [new Set([1, 2]), "new Set([\n  1,\n  2\n])"],
  [new Uint8Array([1, 2]), "new Uint8Array([\n  1,\n  2\n])"],
  [Symbol(), "Symbol()"],
  [Symbol("tag"), 'Symbol("tag")'],
])("keeps JavaScript type notation for %s", (value, expected) => {
  expect(formatNotebookDisplayValue(value)).toBe(expected);
});

test("does not execute getters or toJSON while inspecting objects and arrays", () => {
  const getter = vi.fn(() => {
    throw new Error("Do not read");
  });
  const toJSON = vi.fn(() => {
    throw new Error("Do not serialize");
  });
  const value = Object.defineProperty({ toJSON }, "label", {
    get: getter,
    enumerable: true,
  });
  const array = Object.defineProperty([], 0, { get: getter, enumerable: true });
  expect(formatNotebookDisplayValue(value)).toContain('"label": "[Getter]"');
  expect(formatNotebookDisplayValue(array)).toBe('[\n  "[Getter]"\n]');
  const date = Object.defineProperty(
    new Date("2026-10-31T00:00:00Z"),
    "getTime",
    { get: getter },
  );
  const map = Object.defineProperty(new Map([["safe", 1]]), Symbol.iterator, {
    get: getter,
  });
  const regexp = Object.defineProperty(/safe/i, "source", { get: getter });
  expect(formatNotebookDisplayValue(date)).toContain("new Date");
  expect(formatNotebookDisplayValue(map)).toContain('"safe"');
  expect(formatNotebookDisplayValue(regexp)).toBe("/safe/i");
  expect(getter).not.toHaveBeenCalled();
  expect(toJSON).not.toHaveBeenCalled();
});

test("handles circular maps and deeply nested values without overflowing", () => {
  const map = new Map<unknown, unknown>();
  map.set("self", map);
  expect(formatNotebookDisplayValue(map)).toContain('"[Circular]"');
  const root: Record<string, unknown> = {};
  let branch = root;
  for (let index = 0; index < 1000; index++) {
    const child = {};
    branch.child = child;
    branch = child;
  }
  expect(formatNotebookDisplayValue(root)).toContain('"[Max depth]"');
});
