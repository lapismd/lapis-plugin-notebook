import { describe, expect, test, vi } from "vitest";
import {
  diagnosticResourceForPath,
  type DiagnosticCollection,
} from "@lapis-notes/api";
import { NotebookRunDiagnostics } from "../notebook-run-diagnostics";
import { parseNotebookDocument } from "../../parse/parse-notebook-document";
import type { NotebookRunSummary } from "../notebook-run-coordinator";

vi.mock("@lapis-notes/api", () => ({
  diagnosticResourceForPath: (path: string) => ({ uri: `test:${path}` }),
}));

function setup() {
  const collection = { set: vi.fn(), delete: vi.fn() };
  const diagnostics = new NotebookRunDiagnostics(
    collection as unknown as DiagnosticCollection,
  );
  const path = "Errors.notebook.md";
  diagnostics.setDocument(
    parseNotebookDocument(
      ':::cell{#broken lang="js"}\n```js\nthrow Error("failure");\n```\n:::',
      { sourcePath: path },
    ),
  );
  const run: NotebookRunSummary = {
    id: 1,
    sourcePath: path,
    outcome: "running",
    plannedCellIds: ["broken"],
    completedCellIds: [],
    startedAt: 1,
    phases: [],
    errors: [],
  };
  return { collection, diagnostics, run };
}
describe("Notebook Problems integration", () => {
  test("publishes real cell errors at navigable source ranges and clears fixed cells", () => {
    const { collection, diagnostics, run } = setup();
    diagnostics.update(run);
    diagnostics.update({
      ...run,
      outcome: "failed",
      errors: [{ cellId: "broken", message: "failure" }],
    });
    expect(collection.set).toHaveBeenLastCalledWith(
      diagnosticResourceForPath(run.sourcePath),
      [
        expect.objectContaining({
          source: "Notebook",
          severity: "error",
          message: "failure",
          range: {
            start: { line: 2, character: 0 },
            end: { line: 2, character: 1 },
          },
        }),
      ],
    );
    diagnostics.update({ ...run, id: 2 });
    diagnostics.update({ ...run, id: 2, outcome: "succeeded" });
    expect(collection.delete).toHaveBeenLastCalledWith(
      diagnosticResourceForPath(run.sourcePath),
    );
  });
  test("cancellation produces no problem and restores previous errors from the rolled-back run", () => {
    const { collection, diagnostics, run } = setup();
    diagnostics.update({ ...run, outcome: "cancelled" });
    expect(collection.set).not.toHaveBeenCalled();
    diagnostics.update({
      ...run,
      id: 2,
      outcome: "failed",
      errors: [{ cellId: "broken", message: "previous failure" }],
    });
    diagnostics.update({ ...run, id: 3 });
    diagnostics.update({ ...run, id: 3, outcome: "cancelled" });
    expect(collection.set).toHaveBeenLastCalledWith(
      diagnosticResourceForPath(run.sourcePath),
      [expect.objectContaining({ message: "previous failure" })],
    );
  });
  test("keeps other cell errors on a partial rerun and reports startup errors against the file", () => {
    const { collection, diagnostics, run } = setup();
    diagnostics.update({
      ...run,
      outcome: "failed",
      errors: [{ cellId: "broken", message: "cell failure" }],
    });
    diagnostics.update({
      ...run,
      id: 2,
      plannedCellIds: ["other"],
      outcome: "failed",
      errors: [{ message: "Runtime could not start" }],
    });
    expect(collection.set.mock.lastCall?.[1]).toEqual([
      expect.objectContaining({ message: "cell failure" }),
      expect.objectContaining({
        message: "Runtime could not start",
        severity: "error",
        range: undefined,
      }),
    ]);
  });
});

test("publishes input callback failures through Problems with cell navigation", () => {
  const { diagnostics, collection, run } = setup();
  diagnostics.inputError(run.sourcePath, "broken", Error("Reducer failed"));
  expect(collection.set).toHaveBeenLastCalledWith(
    diagnosticResourceForPath(run.sourcePath),
    [
      expect.objectContaining({
        message: "Reducer failed",
        code: "cell:broken",
        range: expect.objectContaining({ start: { line: 2, character: 0 } }),
      }),
    ],
  );
});
