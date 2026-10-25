import { afterEach, describe, expect, test, vi } from "vitest";
import { parseNotebookDocument } from "../../parse/parse-notebook-document";
import type {
  NotebookWorkerCommandMessage,
  NotebookWorkerCommandResponseMessage,
  NotebookWorkerHostRequestMessage,
  NotebookWorkerHostResponseMessage,
} from "../notebook-runtime-protocol";
import { NotebookSession } from "../notebook-session";
import { NotebookWorkerClient } from "../notebook-worker-client";
import type { NotebookDuckDbRuntime } from "@lapis-notes/notebook-duckdb";

vi.mock("../notebook-execution-host", () => ({
  createNotebookExecutionHost: (app: any, options: any = {}) => ({
    getAppTablesSnapshot: async () => ({
      notes: app.vault.getMarkdownFiles?.() ?? [],
      links: [],
      searchDocuments: await app.appDatabase.listSearchDocuments(),
    }),
    readVaultFile: async (path: string, sourcePath?: string) => {
      if (options.fileReaderProvider) {
        return options.fileReaderProvider(path, sourcePath);
      }

      const file = app.vault.getFileByPath(path);
      if (!file) {
        throw new Error(`Notebook vault file not found: ${path}`);
      }
      return app.vault.readBinary(file);
    },
  }),
}));

const originalWorker = globalThis.Worker;

afterEach(() => {
  if (originalWorker) {
    globalThis.Worker = originalWorker;
  } else {
    delete (globalThis as { Worker?: typeof Worker }).Worker;
  }
});

describe("NotebookWorkerClient", () => {
  test("services worker host requests and hydrates session state", async () => {
    const fileBuffer = encodeNotebookText("name,value\na,1\n");
    const hostResponses: NotebookWorkerHostResponseMessage[] = [];
    const fileReaderProvider = vi.fn(async () => fileBuffer);

    class FakeWorker {
      onmessage:
        | ((
            event: MessageEvent<
              | NotebookWorkerCommandResponseMessage
              | NotebookWorkerHostRequestMessage
            >,
          ) => void)
        | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;

      postMessage(
        message:
          | NotebookWorkerCommandMessage
          | NotebookWorkerHostResponseMessage,
      ) {
        if (message.channel === "command") {
          this.onmessage?.({
            data: {
              channel: "host-request",
              id: "host-1",
              type: "get-app-tables",
              data: {},
            } satisfies NotebookWorkerHostRequestMessage,
          } as unknown as MessageEvent<NotebookWorkerHostRequestMessage>);
          return;
        }

        hostResponses.push(message);
        if (message.id === "host-1") {
          this.onmessage?.({
            data: {
              channel: "host-request",
              id: "host-2",
              type: "read-vault-file",
              data: { path: "data/demo.csv", sourcePath: "Notebook.md" },
            } satisfies NotebookWorkerHostRequestMessage,
          } as unknown as MessageEvent<NotebookWorkerHostRequestMessage>);
          return;
        }

        this.onmessage?.({
          data: {
            channel: "command-response",
            id: "cmd_1_1",
            success: true,
            result: {
              outputs: {
                load: [{ kind: "markdown", markdown: "Folder: **Notes**" }],
              },
              values: {
                selectedFolder: "Notes",
              },
              cellStates: {
                load: {
                  state: "completed",
                  outputs: [
                    { kind: "markdown", markdown: "Folder: **Notes**" },
                  ],
                },
              },
            },
          } satisfies NotebookWorkerCommandResponseMessage,
        } as unknown as MessageEvent<NotebookWorkerCommandResponseMessage>);
      }

      terminate() {}
    }

    globalThis.Worker = FakeWorker as unknown as typeof Worker;
    vi.spyOn(Date, "now").mockReturnValue(1);

    const app = {
      vault: {
        getFileByPath: (path: string) => ({ path }),
        readBinary: async () => fileBuffer,
        getMarkdownFiles: () => [
          {
            path: "Notes/A.md",
            baseName: "A",
            extension: "md",
            stat: { size: 10, ctime: 1, mtime: 2 },
          },
        ],
      },
      metadataCache: {
        getFileCache: () => null,
        resolvedLinks: {},
        unresolvedLinks: {},
      },
      appDatabase: {
        listSearchDocuments: async () => [],
      },
    } as any;

    const document = parseNotebookDocument(
      [
        "---",
        "notebook:",
        "  version: 1",
        "---",
        "",
        ':::cell{#load lang="ts"}',
        "```ts",
        'const selectedFolder = "Notes";',
        "```",
        ":::",
      ].join("\n"),
      { sourcePath: "Notebook.md" },
    );
    const session = new NotebookSession(document);
    const client = new NotebookWorkerClient(app, { fileReaderProvider });

    const result = await client.executeDocument(document, session);

    expect(result.values.selectedFolder).toBe("Notes");
    expect(session.getCellState("load")).toMatchObject({
      state: "completed",
      output: [{ kind: "markdown", markdown: "Folder: **Notes**" }],
    });
    expect(hostResponses[0]?.result).toMatchObject({
      notes: [expect.objectContaining({ path: "Notes/A.md" })],
    });
    expect(hostResponses[1]?.result).toBeInstanceOf(ArrayBuffer);
    expect(fileReaderProvider).toHaveBeenCalledWith(
      "data/demo.csv",
      "Notebook.md",
    );

    await client.terminate();
  });

  test("keeps compile-provider notebooks on the in-process path", async () => {
    class ThrowingWorker {
      constructor() {
        throw new Error(
          "worker should not be constructed with compile provider",
        );
      }
    }

    globalThis.Worker = ThrowingWorker as unknown as typeof Worker;

    const app = {
      vault: {
        getFileByPath: (path: string) => ({ path }),
        readBinary: async () => new ArrayBuffer(0),
        getMarkdownFiles: () => [],
      },
      metadataCache: {
        getFileCache: () => null,
        resolvedLinks: {},
        unresolvedLinks: {},
      },
      appDatabase: {
        listSearchDocuments: async () => [],
      },
    } as any;
    const document = parseNotebookDocument(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        "const ignored: number = 0;",
        "```",
        ":::",
      ].join("\n"),
      { sourcePath: "Compile.notebook.md" },
    );
    const session = new NotebookSession(document);
    const client = new NotebookWorkerClient(app, {
      compileProvider: async () => ({
        code: 'lapis.markdown("compiled in process");',
        importedBindings: [],
      }),
    });

    const result = await client.executeDocument(document, session);

    expect(result.outputs.load).toEqual([
      expect.objectContaining({
        kind: "markdown",
        markdown: "compiled in process",
      }),
    ]);

    await client.terminate();
  });

  test("uses injected DuckDB providers on the in-process path", async () => {
    class ThrowingWorker {
      constructor() {
        throw new Error(
          "worker should not be constructed for DuckDB notebooks",
        );
      }
    }

    globalThis.Worker = ThrowingWorker as unknown as typeof Worker;

    const app = {
      vault: {
        getFileByPath: (path: string) => ({ path }),
        readBinary: async () => new ArrayBuffer(0),
        getMarkdownFiles: () => [],
      },
      metadataCache: {
        getFileCache: () => null,
        resolvedLinks: {},
        unresolvedLinks: {},
      },
      appDatabase: {
        listSearchDocuments: async () => [],
      },
    } as any;
    const document = parseNotebookDocument(
      [':::cell{#load lang="sql"}', "SELECT 1 AS value", ":::"].join("\n"),
      { sourcePath: "DuckDb.notebook.md" },
    );
    const session = new NotebookSession(document);
    const duckdbRuntime = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [{ value: 1 }],
      queryWithMeta: async (sql: string) => ({
        rows: [{ value: 1 }],
        columns: ["value"],
        columnMeta: [
          {
            key: "value",
            label: "value",
            type: "number",
            displayType: "INTEGER",
            nullable: true,
          },
        ],
        schema: {
          rowCount: 1,
          queryTimeMs: 1,
          sourceSql: sql,
        },
      }),
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
      terminate: async () => {},
    } satisfies NotebookDuckDbRuntime & { terminate: () => Promise<void> };
    const duckdbProvider = vi.fn(async () => duckdbRuntime);
    const client = new NotebookWorkerClient(app, { duckdbProvider });

    const result = await client.executeDocument(document, session);

    expect(duckdbProvider).toHaveBeenCalledTimes(1);
    expect(result.outputs.load).toEqual([
      expect.objectContaining({
        kind: "table",
        rows: [[1]],
      }),
    ]);

    await client.terminate();
  });

  test("terminating one client does not affect another client's pending execution", async () => {
    const workerInstances: FakeWorker[] = [];

    class FakeWorker {
      onmessage:
        | ((
            event: MessageEvent<
              | NotebookWorkerCommandResponseMessage
              | NotebookWorkerHostRequestMessage
            >,
          ) => void)
        | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;
      lastCommandId: string | null = null;

      constructor() {
        workerInstances.push(this);
      }

      postMessage(
        message:
          | NotebookWorkerCommandMessage
          | NotebookWorkerHostResponseMessage,
      ) {
        if (message.channel === "command") {
          this.lastCommandId = message.id;
        }
      }

      terminate() {}
    }

    globalThis.Worker = FakeWorker as unknown as typeof Worker;
    vi.spyOn(Date, "now").mockReturnValue(1);

    const app = {
      vault: {
        getFileByPath: (path: string) => ({ path }),
        readBinary: async () => new ArrayBuffer(0),
        getMarkdownFiles: () => [],
      },
      metadataCache: {
        getFileCache: () => null,
        resolvedLinks: {},
        unresolvedLinks: {},
      },
      appDatabase: {
        listSearchDocuments: async () => [],
      },
    } as any;

    const documentA = parseNotebookDocument(
      [
        "---",
        "notebook:",
        "  version: 1",
        "---",
        "",
        ':::cell{#load lang="ts"}',
        "```ts",
        'const value = "A";',
        "```",
        ":::",
      ].join("\n"),
      { sourcePath: "Notebook-A.md" },
    );
    const documentB = parseNotebookDocument(
      [
        "---",
        "notebook:",
        "  version: 1",
        "---",
        "",
        ':::cell{#load lang="ts"}',
        "```ts",
        'const value = "B";',
        "```",
        ":::",
      ].join("\n"),
      { sourcePath: "Notebook-B.md" },
    );
    const sessionA = new NotebookSession(documentA);
    const sessionB = new NotebookSession(documentB);
    const clientA = new NotebookWorkerClient(app);
    const clientB = new NotebookWorkerClient(app);

    const runA = clientA.executeDocument(documentA, sessionA);
    const runB = clientB.executeDocument(documentB, sessionB);

    await vi.waitFor(() => expect(workerInstances).toHaveLength(2));
    expect(workerInstances[0].lastCommandId).toBeTruthy();
    expect(workerInstances[1].lastCommandId).toBeTruthy();

    await clientA.terminate();
    await expect(runA).rejects.toThrow("Notebook worker was terminated");

    workerInstances[1].onmessage?.({
      data: {
        channel: "command-response",
        id: workerInstances[1].lastCommandId!,
        success: true,
        result: {
          outputs: {
            load: [{ kind: "markdown", markdown: "B" }],
          },
          values: {
            value: "B",
          },
          cellStates: {
            load: {
              state: "completed",
              outputs: [{ kind: "markdown", markdown: "B" }],
            },
          },
        },
      } satisfies NotebookWorkerCommandResponseMessage,
    } as unknown as MessageEvent<NotebookWorkerCommandResponseMessage>);

    await expect(runB).resolves.toMatchObject({
      values: { value: "B" },
    });
    expect(sessionB.getCellState("load")).toMatchObject({
      state: "completed",
      output: [{ kind: "markdown", markdown: "B" }],
    });

    await clientB.terminate();
  });

  test("sends serializable runtime dependency descriptors to worker execution", async () => {
    const commands: NotebookWorkerCommandMessage[] = [];

    class FakeWorker {
      onmessage:
        | ((
            event: MessageEvent<
              | NotebookWorkerCommandResponseMessage
              | NotebookWorkerHostRequestMessage
            >,
          ) => void)
        | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;

      postMessage(
        message:
          | NotebookWorkerCommandMessage
          | NotebookWorkerHostResponseMessage,
      ) {
        if (message.channel !== "command") {
          return;
        }
        commands.push(message);
        this.onmessage?.({
          data: {
            channel: "command-response",
            id: message.id,
            success: true,
            result: {
              outputs: { load: [{ kind: "markdown", markdown: "ok" }] },
              values: {},
              cellStates: {
                load: {
                  state: "completed",
                  outputs: [{ kind: "markdown", markdown: "ok" }],
                },
              },
            },
          } satisfies NotebookWorkerCommandResponseMessage,
        } as unknown as MessageEvent<NotebookWorkerCommandResponseMessage>);
      }

      terminate() {}
    }

    globalThis.Worker = FakeWorker as unknown as typeof Worker;
    vi.spyOn(Date, "now").mockReturnValue(1);

    const app = {
      vault: {
        getFileByPath: (path: string) => ({ path }),
        readBinary: async () => new ArrayBuffer(0),
        getMarkdownFiles: () => [],
      },
      metadataCache: {
        getFileCache: () => null,
        resolvedLinks: {},
        unresolvedLinks: {},
      },
      appDatabase: {
        listSearchDocuments: async () => [],
      },
    } as any;
    const document = parseNotebookDocument(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        "lapis.markdown(`Rows: ${aq}`);",
        "```",
        ":::",
      ].join("\n"),
      { sourcePath: "Notebook.md" },
    );
    const session = new NotebookSession(document);
    const client = new NotebookWorkerClient(app);

    await client.executeDocument(document, session, {
      localPackageVersions: {
        lodash: "^4.17.21",
      },
      moduleImportLoader: async () => ({ sum: () => 5 }),
      runtimeDependencies: [
        {
          packageName: "arquero",
          version: "8.0.0",
          globalName: "aq",
          resolver: { kind: "remote-esm" },
        },
      ],
    });

    expect(commands[0]?.data.options).toEqual({
      localPackageVersions: {
        lodash: "^4.17.21",
      },
      runtimeDependencies: [
        {
          packageName: "arquero",
          version: "8.0.0",
          globalName: "aq",
          resolver: { kind: "remote-esm" },
        },
      ],
    });

    await client.terminate();
  });

  test("uses the in-process path for DOM-backed Observable input notebooks", async () => {
    class ThrowingWorker {
      constructor() {
        throw new Error("worker should not be constructed for DOM notebooks");
      }
    }

    globalThis.Worker = ThrowingWorker as unknown as typeof Worker;

    const app = {
      vault: {
        getFileByPath: (path: string) => ({ path }),
        readBinary: async () => new ArrayBuffer(0),
        getMarkdownFiles: () => [],
      },
      metadataCache: {
        getFileCache: () => null,
        resolvedLinks: {},
        unresolvedLinks: {},
      },
      appDatabase: {
        listSearchDocuments: async () => [],
      },
    } as any;
    const document = parseNotebookDocument(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'const marker = "Inputs.range";',
        "lapis.markdown(marker);",
        "```",
        ":::",
      ].join("\n"),
      { sourcePath: "Inputs.notebook.md" },
    );
    const session = new NotebookSession(document);
    const client = new NotebookWorkerClient(app);

    const result = await client.executeDocument(document, session);

    expect(result.values.marker).toBe("Inputs.range");
    expect(session.getCellState("load")).toMatchObject({
      state: "completed",
      output: [{ kind: "markdown", markdown: "Inputs.range" }],
    });

    await client.terminate();
  });

  test("keeps helper-only DOM.uid notebooks on the worker path", async () => {
    const commands: NotebookWorkerCommandMessage[] = [];

    class FakeWorker {
      onmessage:
        | ((
            event: MessageEvent<
              | NotebookWorkerCommandResponseMessage
              | NotebookWorkerHostRequestMessage
            >,
          ) => void)
        | null = null;
      onerror: ((event: ErrorEvent) => void) | null = null;

      postMessage(
        message:
          | NotebookWorkerCommandMessage
          | NotebookWorkerHostResponseMessage,
      ) {
        if (message.channel !== "command") {
          return;
        }
        commands.push(message);
        this.onmessage?.({
          data: {
            channel: "command-response",
            id: message.id,
            success: true,
            result: {
              outputs: { load: [{ kind: "markdown", markdown: "O-plot-1" }] },
              values: { marker: "O-plot-1" },
              cellStates: {
                load: {
                  state: "completed",
                  outputs: [{ kind: "markdown", markdown: "O-plot-1" }],
                },
              },
            },
          } satisfies NotebookWorkerCommandResponseMessage,
        } as unknown as MessageEvent<NotebookWorkerCommandResponseMessage>);
      }

      terminate() {}
    }

    globalThis.Worker = FakeWorker as unknown as typeof Worker;
    vi.spyOn(Date, "now").mockReturnValue(1);

    const app = {
      vault: {
        getFileByPath: (path: string) => ({ path }),
        readBinary: async () => new ArrayBuffer(0),
        getMarkdownFiles: () => [],
      },
      metadataCache: {
        getFileCache: () => null,
        resolvedLinks: {},
        unresolvedLinks: {},
      },
      appDatabase: {
        listSearchDocuments: async () => [],
      },
    } as any;
    const document = parseNotebookDocument(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'const marker = DOM.uid("plot").id;',
        "lapis.markdown(marker);",
        "```",
        ":::",
      ].join("\n"),
      { sourcePath: "DomUid.notebook.md" },
    );
    const session = new NotebookSession(document);
    const client = new NotebookWorkerClient(app);

    const result = await client.executeDocument(document, session);

    expect(commands).toHaveLength(1);
    expect(result.values.marker).toBe("O-plot-1");
    expect(session.getCellState("load")).toMatchObject({
      state: "completed",
      output: [{ kind: "markdown", markdown: "O-plot-1" }],
    });

    await client.terminate();
  });
});

function encodeNotebookText(value: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(value);
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}
