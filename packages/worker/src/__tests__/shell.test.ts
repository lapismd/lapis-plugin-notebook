import { describe, expect, test } from "vitest";
import {
  NotebookWorkerShell,
  type NotebookWorkerIncomingMessage,
  type NotebookWorkerOutgoingMessage,
} from "..";

type TestResult = { ok: boolean };
type TestProgress = { phase: string };
type TestMessage = NotebookWorkerOutgoingMessage<
  TestResult,
  string,
  TestProgress
>;

describe("NotebookWorkerShell", () => {
  test("wraps successful execute commands and progress messages", async () => {
    const posted: TestMessage[] = [];
    const shell = new NotebookWorkerShell<
      string,
      { cellIds?: string[] },
      TestResult,
      string,
      TestProgress
    >({
      postMessage: (message) => posted.push(message),
      execute: async (request, context) => {
        expect(request).toEqual({
          document: "Notebook.notebook.md",
          cellIds: ["a"],
          options: { cellIds: ["a"] },
        });
        context.postProgress({ phase: "running" });
        return { ok: true, cellStates: { a: "ready" } };
      },
    });

    await expect(
      shell.handleMessage({
        channel: "command",
        id: "cmd-1",
        type: "execute",
        data: {
          document: "Notebook.notebook.md",
          cellIds: ["a"],
          options: { cellIds: ["a"] },
        },
      }),
    ).resolves.toBe(true);

    expect(posted).toEqual([
      {
        channel: "progress",
        id: "cmd-1",
        event: { phase: "running" },
      },
      {
        channel: "command-response",
        id: "cmd-1",
        success: true,
        result: { ok: true, cellStates: { a: "ready" } },
      },
    ]);
  });

  test("settles host responses through the shared host request broker", async () => {
    const posted: TestMessage[] = [];
    const shell = new NotebookWorkerShell<
      string,
      unknown,
      TestResult,
      string,
      TestProgress
    >({
      postMessage: (message) => posted.push(message),
      createHostRequestId: () => "host-1",
      execute: async (_request, context) => {
        const text = await context.hostRequests.request<string>(
          "read-vault-file",
          {
            path: "data.csv",
          },
        );
        return { ok: text === "done", cellStates: { a: "ready" } };
      },
    });

    const command = shell.handleMessage({
      channel: "command",
      id: "cmd-1",
      type: "execute",
      data: { document: "Notebook.notebook.md" },
    });

    expect(posted).toEqual([
      {
        channel: "host-request",
        id: "host-1",
        type: "read-vault-file",
        data: { path: "data.csv" },
      },
    ]);

    await expect(
      shell.handleMessage({
        channel: "host-response",
        id: "host-1",
        success: true,
        result: "done",
      }),
    ).resolves.toBe(true);
    await command;

    expect(posted[1]).toEqual({
      channel: "command-response",
      id: "cmd-1",
      success: true,
      result: { ok: true, cellStates: { a: "ready" } },
    });
  });

  test("posts failed command responses", async () => {
    const posted: TestMessage[] = [];
    const shell = new NotebookWorkerShell<
      string,
      unknown,
      TestResult,
      string,
      TestProgress
    >({
      postMessage: (message) => posted.push(message),
      execute: async () => {
        throw new Error("No runtime");
      },
    });

    await shell.handleMessage({
      channel: "command",
      id: "cmd-1",
      type: "execute",
      data: { document: "Notebook.notebook.md" },
    });

    expect(posted).toEqual([
      {
        channel: "command-response",
        id: "cmd-1",
        success: false,
        error: "No runtime",
      },
    ]);
  });

  test("returns false for unknown host response ids", async () => {
    const shell = new NotebookWorkerShell<string, unknown, TestResult, string>({
      postMessage: () => undefined,
      execute: async () => ({ ok: true, cellStates: {} }),
    });

    const message: NotebookWorkerIncomingMessage<string, unknown> = {
      channel: "host-response",
      id: "missing",
      success: true,
    };

    await expect(shell.handleMessage(message)).resolves.toBe(false);
  });
});
