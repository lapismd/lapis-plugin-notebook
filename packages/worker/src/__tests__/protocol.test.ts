import { describe, expect, test } from "vitest";
import {
  NOTEBOOK_WORKER_CHANNELS,
  type NotebookWorkerCommandMessage,
} from "..";

describe("notebook worker protocol", () => {
  test("exposes stable channel names", () => {
    expect(NOTEBOOK_WORKER_CHANNELS).toEqual([
      "command",
      "command-response",
      "progress",
      "host-request",
      "host-response",
    ]);
  });

  test("allows typed execute command documents", () => {
    const message: NotebookWorkerCommandMessage<{ id: string }> = {
      channel: "command",
      id: "cmd-1",
      type: "execute",
      data: { document: { id: "doc-1" } },
    };

    expect(message.data.document.id).toBe("doc-1");
  });
});
