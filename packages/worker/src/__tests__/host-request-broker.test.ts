import { describe, expect, test } from "vitest";
import {
  NotebookWorkerHostRequestBroker,
  type NotebookWorkerHostRequestMessage,
} from "..";

describe("NotebookWorkerHostRequestBroker", () => {
  test("posts host requests and settles successful responses", async () => {
    const posted: NotebookWorkerHostRequestMessage[] = [];
    const broker = new NotebookWorkerHostRequestBroker(
      (message) => posted.push(message),
      { createId: () => "host-1" },
    );

    const result = broker.request<string>("read-vault-file", {
      path: "data.csv",
    });

    expect(posted).toEqual([
      {
        channel: "host-request",
        id: "host-1",
        type: "read-vault-file",
        data: { path: "data.csv" },
      },
    ]);
    expect(broker.pendingCount).toBe(1);

    expect(
      broker.settle({
        channel: "host-response",
        id: "host-1",
        success: true,
        result: "ok",
      }),
    ).toBe(true);

    await expect(result).resolves.toBe("ok");
    expect(broker.pendingCount).toBe(0);
  });

  test("rejects failed responses and ignores unknown responses", async () => {
    const broker = new NotebookWorkerHostRequestBroker(() => undefined, {
      createId: () => "host-1",
    });
    const result = broker.request<string>("get-app-tables", {});

    expect(
      broker.settle({
        channel: "host-response",
        id: "missing",
        success: true,
      }),
    ).toBe(false);
    expect(
      broker.settle({
        channel: "host-response",
        id: "host-1",
        success: false,
        error: "No host",
      }),
    ).toBe(true);

    await expect(result).rejects.toThrow("No host");
  });
});
