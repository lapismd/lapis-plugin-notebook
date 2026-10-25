import { expectTypeOf, test } from "vitest";
import type {
  NotebookCellRuntimeState,
  NotebookExecutionCheckpoint,
  NotebookExecutionProgressEvent,
  NotebookOutput,
} from "..";

test("session contracts describe cell state and progress events", () => {
  expectTypeOf<NotebookCellRuntimeState["state"]>().toEqualTypeOf<
    "idle" | "stale" | "scheduled" | "running" | "completed" | "error"
  >();
  expectTypeOf<
    Extract<
      NotebookExecutionProgressEvent,
      { type: "cell-completed" }
    >["outputs"]
  >().toEqualTypeOf<NotebookOutput[]>();
  expectTypeOf<NotebookExecutionCheckpoint["cellStates"]>().toEqualTypeOf<
    Record<string, NotebookCellRuntimeState>
  >();
});
