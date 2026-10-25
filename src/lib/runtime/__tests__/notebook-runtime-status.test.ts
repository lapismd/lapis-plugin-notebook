import { describe, expect, test } from "vitest";
import {
  describeNotebookOutputStatus,
  describeNotebookRuntimeStatus,
} from "../notebook-runtime-status";

describe("notebook runtime status", () => {
  test("describes worker notebooks", () => {
    expect(
      describeNotebookRuntimeStatus({
        workerAvailable: true,
        usesDuckDb: false,
        requiresDom: false,
        requiresLiveDom: false,
      }),
    ).toEqual({
      mode: "worker",
      label: "Worker runtime",
      detail: "This notebook can run in the dedicated notebook worker.",
    });
  });

  test("describes in-process fallback reasons", () => {
    expect(
      describeNotebookRuntimeStatus({
        workerAvailable: true,
        usesDuckDb: true,
        requiresDom: false,
        requiresLiveDom: false,
      }).detail,
    ).toContain("uses DuckDB");

    expect(
      describeNotebookRuntimeStatus({
        workerAvailable: true,
        usesDuckDb: false,
        requiresDom: true,
        requiresLiveDom: true,
      }).detail,
    ).toContain("live DOM");
  });

  test("describes restored and recomputed output states", () => {
    expect(
      describeNotebookOutputStatus({ kind: "restored", cellCount: 2 }),
    ).toMatchObject({
      kind: "restored",
      label: "Restored generated outputs",
    });

    expect(
      describeNotebookOutputStatus({
        kind: "restored-stale",
        cellCount: 3,
        staleCellCount: 1,
      }),
    ).toMatchObject({
      kind: "restored-stale",
      label: "Restored outputs need rerun",
    });

    expect(
      describeNotebookOutputStatus({ kind: "recomputed", cellCount: 1 }),
    ).toMatchObject({
      kind: "recomputed",
      label: "Outputs recomputed",
    });

    expect(
      describeNotebookOutputStatus({ kind: "none", cellCount: 0 }),
    ).toBeNull();
  });
});
