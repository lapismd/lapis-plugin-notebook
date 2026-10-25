import { describe, expect, test } from "vitest";
import {
  getNotebookWorkerTransferList,
  NotebookWorkerHostRequestResponder,
  type NotebookWorkerHostResponseMessage,
} from "..";

describe("NotebookWorkerHostRequestResponder", () => {
  test("wraps successful host request results", async () => {
    const responder = new NotebookWorkerHostRequestResponder({
      resolve: async (message) => ({ path: message.data.path }),
    });

    await expect(
      responder.createResponse({
        channel: "host-request",
        id: "host-1",
        type: "read-vault-file",
        data: { path: "data.csv" },
      }),
    ).resolves.toEqual({
      response: {
        channel: "host-response",
        id: "host-1",
        success: true,
        result: { path: "data.csv" },
      },
      transfer: [],
    });
  });

  test("wraps failed host request results", async () => {
    const responder = new NotebookWorkerHostRequestResponder({
      resolve: async () => {
        throw new Error("No file");
      },
    });

    await expect(
      responder.createResponse({
        channel: "host-request",
        id: "host-1",
        type: "read-vault-file",
        data: { path: "missing.csv" },
      }),
    ).resolves.toEqual({
      response: {
        channel: "host-response",
        id: "host-1",
        success: false,
        error: "No file",
      },
      transfer: [],
    });
  });

  test("posts responses with transfer lists", async () => {
    const buffer = new ArrayBuffer(8);
    const posted: Array<{
      response: NotebookWorkerHostResponseMessage;
      transfer: Transferable[];
    }> = [];
    const responder = new NotebookWorkerHostRequestResponder({
      resolve: async () => buffer,
    });

    await responder.respond(
      {
        channel: "host-request",
        id: "host-1",
        type: "read-vault-file",
        data: { path: "data.bin" },
      },
      (response, transfer) => posted.push({ response, transfer }),
    );

    expect(posted).toEqual([
      {
        response: {
          channel: "host-response",
          id: "host-1",
          success: true,
          result: buffer,
        },
        transfer: [buffer],
      },
    ]);
  });

  test("selects ArrayBuffer transfer lists by default", () => {
    const buffer = new ArrayBuffer(4);

    expect(getNotebookWorkerTransferList(buffer)).toEqual([buffer]);
    expect(getNotebookWorkerTransferList("text")).toEqual([]);
  });
});
