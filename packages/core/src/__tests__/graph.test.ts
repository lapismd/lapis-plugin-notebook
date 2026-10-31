import { describe, expect, test } from "vitest";
import {
  buildNotebookGraphFromCells,
  collectDependencyClosure,
  collectStaleDescendants,
} from "../graph";

type TestCell = {
  id: string;
  defs: string[];
  refs: string[];
};

describe("notebook graph helpers", () => {
  test("orders cells and records dependent links", () => {
    const graph = buildNotebookGraphFromCells<TestCell>(
      [
        { id: "load", defs: ["rows"], refs: [] },
        { id: "summary", defs: ["summary"], refs: ["rows"] },
      ],
      (cell) => cell,
    );

    expect(graph.order).toEqual(["load", "summary"]);
    expect(graph.nodes.get("load")?.dependents).toEqual(["summary"]);
    expect(collectDependencyClosure(graph, ["summary"])).toEqual([
      "summary",
      "load",
    ]);
    expect(collectStaleDescendants(graph, ["load"])).toEqual(["summary"]);
  });

  test("runs newly ready earlier output cells before later unrelated cells", () => {
    const graph = buildNotebookGraphFromCells<TestCell>(
      [
        { id: "input", defs: ["value"], refs: [] },
        { id: "output", defs: [], refs: ["value"] },
        { id: "slow", defs: [], refs: [] },
      ],
      (cell) => cell,
    );
    expect(graph.order).toEqual(["input", "output", "slow"]);
  });

  test("keeps forward references behind their required producers", () => {
    const graph = buildNotebookGraphFromCells<TestCell>(
      [
        { id: "output", defs: [], refs: ["value"] },
        { id: "other", defs: [], refs: [] },
        { id: "input", defs: ["value"], refs: [] },
      ],
      (cell) => cell,
    );
    expect(graph.order).toEqual(["other", "input", "output"]);
  });

  test("records duplicate definitions and cycles", () => {
    const duplicates = buildNotebookGraphFromCells<TestCell>(
      [
        { id: "a", defs: ["shared"], refs: [] },
        { id: "b", defs: ["shared"], refs: [] },
      ],
      (cell) => cell,
    );

    expect(duplicates.duplicateDefinitions.get("shared")).toEqual(["a", "b"]);

    const cyclic = buildNotebookGraphFromCells<TestCell>(
      [
        { id: "a", defs: ["aValue"], refs: ["bValue"] },
        { id: "b", defs: ["bValue"], refs: ["aValue"] },
      ],
      (cell) => cell,
    );

    expect(cyclic.order).toEqual([]);
    expect(cyclic.cycles).not.toEqual([]);
  });
});
