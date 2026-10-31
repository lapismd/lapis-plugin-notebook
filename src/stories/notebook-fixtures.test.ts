import { expect, test } from "vitest";
import {
  loadUiBackedNotebookInputs,
  isUiBackedNotebookInputFactory,
} from "../../packages/input/src/ui-runtime";
import { parseNotebookDocument } from "../lib/parse/parse-notebook-document";
import { buildNotebookGraph } from "../lib/runtime/notebook-graph";
import {
  NOTEBOOK_FIXTURE_INPUT_TYPES,
  NOTEBOOK_FIXTURE_INPUT_LIFECYCLE,
  NOTEBOOK_FIXTURE_SYSTEM_GUIDE,
} from "./notebook-fixtures";

test("System Guide runs every example without dependency cycles", () => {
  const notebook = parseNotebookDocument(NOTEBOOK_FIXTURE_SYSTEM_GUIDE, {
    sourcePath: "System Guide.notebook.md",
  });
  const graph = buildNotebookGraph(notebook);
  expect(graph.cycles).toEqual([]);
  expect(graph.duplicateDefinitions.size).toBe(0);
  expect(graph.order).toHaveLength(notebook.cells.length);
});

test("Input Types covers every currently supported runtime input factory", async () => {
  const { inputs } = await loadUiBackedNotebookInputs();
  const supported = Object.keys(inputs)
    .filter(isUiBackedNotebookInputFactory)
    .sort();
  const notebook = parseNotebookDocument(NOTEBOOK_FIXTURE_INPUT_TYPES, {
    sourcePath: "Input Types.notebook.md",
  });
  const demonstrated = [
    ...new Set(
      notebook.cells.flatMap((cell) =>
        [...cell.source.matchAll(/Inputs\.(\w+)\(/g)].map((match) => match[1]!),
      ),
    ),
  ].sort();
  expect(demonstrated).toEqual(supported);
});

test("Input Types pairs every control with its immediate reactive value cell", () => {
  const notebook = parseNotebookDocument(NOTEBOOK_FIXTURE_INPUT_TYPES, {
    sourcePath: "Input Types.notebook.md",
  });
  const graph = buildNotebookGraph(notebook);
  expect(graph.cycles).toEqual([]);
  expect(graph.duplicateDefinitions.size).toBe(0);
  for (const [index, cell] of notebook.cells.entries()) {
    const binding = /const (\w+) = view\(Inputs\./.exec(cell.source);
    if (!binding) continue;
    expect(notebook.cells[index + 1]?.id, cell.id).toBe(`${cell.id}-value`);
    expect(notebook.cells[index + 1]?.source, cell.id).toContain(binding[1]);
  }
});

test("the focused retention notebook keeps its real input/output dependencies", () => {
  const notebook = parseNotebookDocument(NOTEBOOK_FIXTURE_INPUT_LIFECYCLE, {
    sourcePath: "Input Lifecycle.notebook.md",
  });
  const graph = buildNotebookGraph(notebook);
  expect(notebook.cells).toHaveLength(12);
  expect(graph.cycles).toEqual([]);
  expect(graph.duplicateDefinitions.size).toBe(0);
  expect(graph.nodes.get("file-results")?.refs).toContain("selectedFiles");
});
