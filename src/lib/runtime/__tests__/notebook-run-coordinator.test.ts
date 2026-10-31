import { describe, expect, test, vi } from "vitest";
import { parseNotebookDocument } from "../../parse/parse-notebook-document";
import { NotebookSession } from "../notebook-session";
import { NotebookRunCoordinator } from "../notebook-run-coordinator";
import { executeNotebookDocument } from "../notebook-worker";

function document(path = "Progress.notebook.md") {
  return parseNotebookDocument(
    ':::cell{#first lang="js"}\n```js\nconst x = 1;\n```\n:::\n\n:::cell{#second lang="js"}\n```js\ndisplay(x);\n```\n:::',
    { sourcePath: path },
  );
}
function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((r, fail) => {
    resolve = r;
    reject = fail;
  });
  return { promise, resolve, reject };
}

describe("Notebook run ownership", () => {
  test("reports intermediate completion over the dependency-expanded plan and retains terminal state", async () => {
    const doc = document(),
      gate = deferred();
    const session = new NotebookSession(doc, () =>
      coordinator.update(doc.sourcePath!),
    );
    const coordinator = new NotebookRunCoordinator(
      async (_doc, session) => {
        session.beginExecution(["first", "second"]);
        session.markRunning("first");
        session.setCellOutput("first", []);
        await gate.promise;
        session.markRunning("second");
        session.setCellError("second", "second failed");
      },
      async () => {},
    );
    const run = coordinator.run(doc, session, { cellIds: ["second"] });
    await vi.waitFor(() =>
      expect(coordinator.get(doc.sourcePath!)?.completedCellIds).toEqual([
        "first",
      ]),
    );
    expect(coordinator.get(doc.sourcePath!)?.plannedCellIds).toEqual([
      "first",
      "second",
    ]);
    gate.resolve();
    await run;
    expect(session.getExecutionState().state).toBe("idle");
    expect(coordinator.get(doc.sourcePath!)).toMatchObject({
      outcome: "failed",
      completedCellIds: ["first", "second"],
      errors: [{ cellId: "second", message: "second failed" }],
    });
    expect(coordinator.get(doc.sourcePath!)?.endedAt).toBeGreaterThanOrEqual(
      coordinator.get(doc.sourcePath!)!.startedAt,
    );
  });

  test("cancels unresolved work immediately, allows rerun, and does not cancel another notebook", async () => {
    const gates = [deferred(), deferred()];
    let starts = 0;
    const coordinator = new NotebookRunCoordinator(
      async () => gates[starts++].promise,
      vi.fn(async () => {}),
    );
    const a = document("A.notebook.md"),
      b = document("B.notebook.md");
    const runA = coordinator
      .run(a, new NotebookSession(a))
      .catch(() => "cancelled");
    const runB = coordinator.run(b, new NotebookSession(b));
    await vi.waitFor(() => expect(starts).toBe(2));
    expect(await coordinator.cancel(a.sourcePath!)).toBe(true);
    expect(await runA).toBe("cancelled");
    expect(coordinator.get(a.sourcePath!)?.outcome).toBe("cancelled");
    expect(coordinator.get(b.sourcePath!)?.outcome).toBe("running");
    gates[1].resolve();
    await runB;
    // A late settlement cannot turn the cancelled run into success.
    gates[0].resolve();
    await Promise.resolve();
    expect(coordinator.get(a.sourcePath!)?.outcome).toBe("cancelled");
    starts = 0;
    await coordinator.run(a, new NotebookSession(a));
    expect(coordinator.get(a.sourcePath!)?.outcome).toBe("succeeded");
  });

  test("late in-process output and definitions never overwrite a fresh run", async () => {
    const doc = document(),
      gate = deferred(),
      controller = new AbortController();
    (globalThis as any).__notebookLatePromise = gate.promise;
    const session = new NotebookSession(doc);
    const pending = executeNotebookDocument(
      {} as any,
      doc,
      session,
      undefined,
      {
        signal: controller.signal,
        compileProvider: async () => ({
          code: 'await globalThis.__notebookLatePromise; display("late"); const x = "old";',
        }),
      },
    ).catch(() => undefined);
    try {
      await vi.waitFor(() =>
        expect(session.getCellState("first").state).toBe("running"),
      );
      controller.abort();
      session.invalidateAllCells();
      await pending;
      session.setCellOutput("first", [{ kind: "markdown", markdown: "fresh" }]);
      session.setRuntimeDefinitions("first", [["x", "fresh"]]);
      gate.resolve();
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(session.getCellState("first").output).toEqual([
        { kind: "markdown", markdown: "fresh" },
      ]);
      expect(session.getRuntimeValues().x).toBe("fresh");
      expect(session.getCellState("second").state).not.toBe("completed");
    } finally {
      gate.resolve();
      delete (globalThis as any).__notebookLatePromise;
    }
  });

  test.each(["resolve", "reject"] as const)(
    "a cancelled run's late %s cannot alter an immediate rerun",
    async (settle) => {
      const old = deferred(),
        fresh = deferred();
      let starts = 0;
      const terminate = vi.fn(async () => {});
      const coordinator = new NotebookRunCoordinator(
        async () => (++starts === 1 ? old.promise : fresh.promise),
        terminate,
      );
      const doc = document();
      const previous = coordinator
        .run(doc, new NotebookSession(doc))
        .catch(() => undefined);
      await vi.waitFor(() => expect(starts).toBe(1));
      await coordinator.cancel(doc.sourcePath!);
      await previous;
      const next = coordinator.run(doc, new NotebookSession(doc));
      await vi.waitFor(() => expect(starts).toBe(2));
      const id = coordinator.get(doc.sourcePath!)!.id;
      if (settle === "reject") old.reject(new Error("late failure"));
      else old.resolve();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(coordinator.isRunning(doc.sourcePath!)).toBe(true);
      expect(coordinator.get(doc.sourcePath!)).toMatchObject({
        id,
        outcome: "running",
        errors: [],
      });
      fresh.resolve();
      await next;
      expect(coordinator.get(doc.sourcePath!)).toMatchObject({
        id,
        outcome: "succeeded",
        errors: [],
      });
      expect(terminate).toHaveBeenCalledTimes(1);
    },
  );
});
