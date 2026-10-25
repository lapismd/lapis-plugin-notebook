import { describe, expect, test } from "vitest";
import { NotebookWorkerCommandBroker } from "..";

describe("NotebookWorkerCommandBroker", () => {
  test("creates command messages and exposes pending context", async () => {
    const broker = new NotebookWorkerCommandBroker<
      string,
      { sessionId: string }
    >({
      createId: () => "cmd-1",
    });

    const command = broker.create(
      "execute",
      {
        document: { sourcePath: "Notebook.notebook.md" },
        cellIds: ["a"],
        options: { skipDependencyClosure: true },
      },
      { sessionId: "session-1" },
    );

    expect(command.message).toEqual({
      channel: "command",
      id: "cmd-1",
      type: "execute",
      data: {
        document: { sourcePath: "Notebook.notebook.md" },
        cellIds: ["a"],
        options: { skipDependencyClosure: true },
      },
    });
    expect(broker.pendingCount).toBe(1);
    expect(broker.contextFor("cmd-1")).toEqual({ sessionId: "session-1" });

    const pending = broker.take("cmd-1");
    expect(pending?.context).toEqual({ sessionId: "session-1" });
    pending?.resolve("ok");

    await expect(command.promise).resolves.toBe("ok");
    expect(broker.pendingCount).toBe(0);
  });

  test("ignores unknown command ids and rejects outstanding commands", async () => {
    const broker = new NotebookWorkerCommandBroker<string>({
      createId: () => "cmd-1",
    });
    const command = broker.create("execute", { document: "doc" }, undefined);

    expect(broker.take("missing")).toBeNull();
    broker.rejectAll(new Error("Worker stopped"));

    await expect(command.promise).rejects.toThrow("Worker stopped");
    expect(broker.pendingCount).toBe(0);
  });
});
