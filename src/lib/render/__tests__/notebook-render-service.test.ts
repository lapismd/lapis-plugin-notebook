import { describe, expect, test, vi } from "vitest";
import { parseNotebookDocument } from "../../parse/parse-notebook-document";
import { NotebookRenderService } from "../notebook-render-service";
import { NotebookSession } from "../../runtime/notebook-session";
import { getNotebookCellSourceHash } from "../../runtime/notebook-output-store";
import {
  describeExecutionStart,
  resolveExecutionOrder,
} from "../../runtime/notebook-worker";

function createNotebook(source: string) {
  return parseNotebookDocument(source, {
    sourcePath: "Notebook.notebook.md",
    frontmatter: { version: 1, mode: "lazy" },
  });
}

function createNotebookAtPath(sourcePath: string, source: string) {
  return parseNotebookDocument(source, {
    sourcePath,
    frontmatter: { version: 1, mode: "lazy" },
  });
}

function createRuntimeControllerStub(options: {
  getSessionForDocument: (document: { sourcePath?: string }) => NotebookSession;
  getSessionByPath: (sourcePath: string) => NotebookSession | undefined;
  getStaleCellIds?: (document: {
    sourcePath?: string;
    cells: Array<{ id: string }>;
  }) => string[];
}) {
  return {
    getOrCreateSession: options.getSessionForDocument,
    getSession: options.getSessionByPath,
    getStaleCellIds: (document: {
      sourcePath?: string;
      cells: Array<{ id: string }>;
    }) =>
      options.getStaleCellIds?.(document) ??
      document.cells
        .filter(
          (cell) =>
            options.getSessionForDocument(document).getCellState(cell.id)
              .state === "stale",
        )
        .map((cell) => cell.id),
    getCellState: (document: { sourcePath?: string }, cellId: string) =>
      options.getSessionForDocument(document).getCellState(cellId),
    getInputValue: (sourcePath: string, name: string) =>
      options.getSessionByPath(sourcePath)?.getInputValue(name),
    clearCellOutput: (document: { sourcePath?: string }, cellId: string) =>
      options.getSessionForDocument(document).clearCellOutput(cellId),
    prepareExecution: (
      document: { sourcePath?: string; cells: Array<{ id: string }> },
      executionOptions: {
        cellIds?: string[];
        skipDependencyClosure?: boolean;
      } = {},
    ) => {
      const session = options.getSessionForDocument(document);
      const executionOrder = resolveExecutionOrder(
        document as any,
        session,
        executionOptions as any,
      );
      const checkpoint =
        executionOrder.length > 0
          ? session.createExecutionCheckpoint(executionOrder)
          : null;

      if (executionOrder.length > 0) {
        session.beginExecution(
          executionOrder,
          describeExecutionStart(executionOrder.length),
        );
        session.markRunning(
          executionOrder[0],
          `Preparing ${executionOrder[0]}`,
        );
      }

      return {
        sourcePath: document.sourcePath ?? "__untitled__",
        session,
        executionOrder,
        checkpoint,
      };
    },
    restoreExecutionCheckpoint: (
      sourcePath: string,
      checkpoint:
        | ReturnType<NotebookSession["createExecutionCheckpoint"]>
        | null
        | undefined,
    ) => {
      if (!checkpoint) {
        return;
      }

      options
        .getSessionByPath(sourcePath)
        ?.restoreExecutionCheckpoint(checkpoint);
    },
  } as any;
}

describe("NotebookRenderService", () => {
  test.each(["run", "clear"] as const)(
    "late persisted-state hydration cannot overwrite a newer %s",
    async (action) => {
      const source = ':::cell{#one lang="md"}\nSaved text\n:::';
      const document = createNotebook(source);
      const session = new NotebookSession(document);
      let release!: (state: unknown) => void;
      const stored = new Promise((resolve) => {
        release = resolve;
      });
      const getNotebookState = vi.fn(async () => stored);
      const app = {
        vault: {
          getFileByPath: () => ({
            path: "Notebook.notebook.md",
            stat: { mtime: 123 },
          }),
          cachedRead: async () => source,
        },
        metadataCache: {
          getFileCache: () => ({
            frontmatter: { notebook: { version: 1, mode: "lazy" } },
          }),
        },
        appDatabase: { getNotebookState },
      } as any;
      const service = new NotebookRenderService(
        app,
        createRuntimeControllerStub({
          getSessionForDocument: () => session,
          getSessionByPath: () => session,
        }),
        vi.fn(),
        new Map(),
      );
      const rendered = service.getRenderedCell("Notebook.notebook.md", "one");
      await vi.waitFor(() => expect(getNotebookState).toHaveBeenCalledOnce());
      if (action === "run") {
        session.beginExecution(["one"]);
        session.setCellOutput("one", [{ kind: "text", text: "New result" }]);
      } else session.clearOutputs();
      release({
        sourcePath: "Notebook.notebook.md",
        mtime: 123,
        updatedAt: 1,
        cells: {
          one: {
            state: "completed",
            outputs: [{ kind: "text", text: "Old result" }],
          },
        },
      });
      expect((await rendered)?.outputs).toEqual(
        action === "run" ? [{ kind: "text", text: "New result" }] : [],
      );
      expect(session.getCellState("one").state).toBe(
        action === "run" ? "completed" : "idle",
      );
    },
  );

  test("all concurrently rendered cells await the same persisted-state hydration", async () => {
    const source = ["one", "two"]
      .map(
        (id) =>
          `:::cell{#${id} lang="md"}\n\`\`\`md\nPlaceholder ${id}\n\`\`\`\n:::`,
      )
      .join("\n");
    const document = createNotebook(source);
    const session = new NotebookSession(document);
    let release!: (state: unknown) => void;
    const stored = new Promise((resolve) => {
      release = resolve;
    });
    const getNotebookState = vi.fn(async () => stored);
    const app = {
      vault: {
        getFileByPath: () => ({
          path: "Notebook.notebook.md",
          stat: { mtime: 123 },
        }),
        cachedRead: async () => source,
      },
      metadataCache: {
        getFileCache: () => ({
          frontmatter: { notebook: { version: 1, mode: "lazy" } },
        }),
      },
      appDatabase: { getNotebookState },
    } as any;
    const execute = vi.fn();
    const service = new NotebookRenderService(
      app,
      createRuntimeControllerStub({
        getSessionForDocument: () => session,
        getSessionByPath: () => session,
      }),
      execute,
      new Map(),
    );
    const first = service.getRenderedCell("Notebook.notebook.md", "one");
    await vi.waitFor(() => expect(getNotebookState).toHaveBeenCalledOnce());
    let secondFinished = false;
    const second = service
      .getRenderedCell("Notebook.notebook.md", "two")
      .then((value) => {
        secondFinished = true;
        return value;
      });
    try {
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(secondFinished).toBe(false);
    } finally {
      release({
        sourcePath: "Notebook.notebook.md",
        mtime: 123,
        updatedAt: 1,
        cells: Object.fromEntries(
          document.cells.map((cell) => [
            cell.id,
            {
              state: "completed",
              sourceHash: getNotebookCellSourceHash(cell),
              outputs: [{ kind: "text", text: `Saved ${cell.id}` }],
            },
          ]),
        ),
      });
      await Promise.all([first, second]);
    }
    expect((await second)?.outputs).toEqual([
      { kind: "text", text: "Saved two" },
    ]);
    expect(getNotebookState).toHaveBeenCalledOnce();
    expect(execute).not.toHaveBeenCalled();
  });

  test("hydrates persisted state only once per session", async () => {
    const source = [
      ':::cell{#load lang="ts"}',
      "```ts",
      'const selectedFolder = "Projects";',
      "```",
      ":::",
      "",
      ':::cell{#summary lang="md"}',
      "Folder: {{selectedFolder}}",
      ":::",
    ].join("\n");
    const document = createNotebook(source);
    const session = new NotebookSession(document);
    const getNotebookState = vi.fn(async () => ({
      sourcePath: "Notebook.notebook.md",
      mtime: 123,
      updatedAt: 456,
      cells: {
        load: {
          state: "completed",
          outputs: [{ kind: "markdown", markdown: "Folder: **Projects**" }],
        },
        summary: {
          state: "completed",
          outputs: [{ kind: "markdown", markdown: "Summary" }],
        },
      },
    }));
    const app = {
      vault: {
        getFileByPath: () => ({
          path: "Notebook.notebook.md",
          stat: { mtime: 123 },
        }),
        cachedRead: async () => source,
      },
      metadataCache: {
        getFileCache: () => ({
          frontmatter: { notebook: { version: 1, mode: "lazy" } },
        }),
      },
      appDatabase: {
        getNotebookState,
      },
    } as any;
    const service = new NotebookRenderService(
      app,
      createRuntimeControllerStub({
        getSessionForDocument: () => session,
        getSessionByPath: () => session,
      }),
      vi.fn(async () => undefined),
      new Map(),
    );

    const loadCell = await service.getRenderedCell(
      "Notebook.notebook.md",
      "load",
    );
    const summaryCell = await service.getRenderedCell(
      "Notebook.notebook.md",
      "summary",
    );

    expect(getNotebookState).toHaveBeenCalledTimes(1);
    expect(loadCell).toMatchObject({
      state: "completed",
      outputs: [{ kind: "markdown", markdown: "Folder: **Projects**" }],
    });
    expect(summaryCell).toMatchObject({
      state: "completed",
      outputs: [{ kind: "markdown", markdown: "Summary" }],
    });
  });

  test("hydrates matching cell outputs when the file mtime changed", async () => {
    const source = [
      "# Edited prose",
      "",
      ':::cell{#load lang="ts"}',
      "```ts",
      'const selectedFolder = "Projects";',
      "```",
      ":::",
      "",
      ':::cell{#summary lang="md"}',
      "Folder: {{selectedFolder}}",
      ":::",
    ].join("\n");
    const document = createNotebook(source);
    const sourceHashByCell = Object.fromEntries(
      document.cells.map((cell) => [cell.id, getNotebookCellSourceHash(cell)]),
    );
    const session = new NotebookSession(document);
    const app = {
      vault: {
        getFileByPath: () => ({
          path: "Notebook.notebook.md",
          stat: { mtime: 999 },
        }),
        cachedRead: async () => source,
      },
      metadataCache: {
        getFileCache: () => ({
          frontmatter: { notebook: { version: 1, mode: "lazy" } },
        }),
      },
      appDatabase: {
        getNotebookState: vi.fn(async () => ({
          sourcePath: "Notebook.notebook.md",
          mtime: 123,
          updatedAt: 456,
          cells: {
            load: {
              state: "completed",
              sourceHash: sourceHashByCell.load,
              outputs: [{ kind: "markdown", markdown: "Folder: **Projects**" }],
            },
            summary: {
              state: "completed",
              sourceHash: sourceHashByCell.summary,
              outputs: [{ kind: "markdown", markdown: "Summary" }],
            },
          },
        })),
      },
    } as any;
    const service = new NotebookRenderService(
      app,
      createRuntimeControllerStub({
        getSessionForDocument: () => session,
        getSessionByPath: () => session,
      }),
      vi.fn(async () => undefined),
      new Map(),
    );

    const summaryCell = await service.getRenderedCell(
      "Notebook.notebook.md",
      "summary",
    );

    expect(summaryCell).toMatchObject({
      state: "completed",
      outputs: [{ kind: "markdown", markdown: "Summary" }],
    });
  });

  test("recreates restored Observable input DOM when only input values were persisted", async () => {
    const source = [
      ':::cell{#controls lang="ts"}',
      "```ts",
      'const gain = view(Inputs.range([0, 10], { value: 5, step: 1, label: "Gain" }));',
      "```",
      ":::",
      "",
      ':::cell{#summary lang="md"}',
      "Selected gain: {{gain}}",
      ":::",
    ].join("\n");
    const document = createNotebook(source);
    const sourceHashByCell = Object.fromEntries(
      document.cells.map((cell) => [cell.id, getNotebookCellSourceHash(cell)]),
    );
    const session = new NotebookSession(document);
    const executeDocument = vi.fn(
      async (_document, activeSession: NotebookSession) => {
        activeSession.setCellOutput("controls", [
          {
            kind: "dom",
            outputId: "dom_controls_gain_1",
            cellId: "controls",
            role: "input",
            label: "gain",
          },
        ]);
      },
    );
    const app = {
      vault: {
        getFileByPath: () => ({
          path: "Notebook.notebook.md",
          stat: { mtime: 999 },
        }),
        cachedRead: async () => source,
      },
      metadataCache: {
        getFileCache: () => ({
          frontmatter: { notebook: { version: 1, mode: "lazy" } },
        }),
      },
      appDatabase: {
        getNotebookState: vi.fn(async () => ({
          sourcePath: "Notebook.notebook.md",
          mtime: 123,
          updatedAt: 456,
          cells: {
            controls: {
              state: "completed",
              sourceHash: sourceHashByCell.controls,
              outputs: [],
              inputValues: { gain: 8 },
            },
            summary: {
              state: "completed",
              sourceHash: sourceHashByCell.summary,
              outputs: [{ kind: "markdown", markdown: "Selected gain: 8" }],
            },
          },
        })),
        setNotebookState: vi.fn(async () => undefined),
      },
    } as any;
    const service = new NotebookRenderService(
      app,
      createRuntimeControllerStub({
        getSessionForDocument: () => session,
        getSessionByPath: () => session,
      }),
      executeDocument,
      new Map(),
    );

    const controlsCell = await service.getRenderedCell(
      "Notebook.notebook.md",
      "controls",
    );

    expect(executeDocument).toHaveBeenCalledTimes(1);
    expect(executeDocument).toHaveBeenCalledWith(
      expect.objectContaining({ sourcePath: "Notebook.notebook.md" }),
      session,
      { cellIds: ["controls"] },
    );
    expect(controlsCell).toMatchObject({
      state: "completed",
      outputs: [
        {
          kind: "dom",
          outputId: "dom_controls_gain_1",
          cellId: "controls",
          role: "input",
          label: "gain",
        },
      ],
    });
  });

  test("does not rerun reconstructable structured input outputs during restore", async () => {
    const source = [
      ':::cell{#controls lang="ts"}',
      "```ts",
      'const gain = view(Inputs.range([0, 10], { value: 5, step: 1, label: "Gain" }));',
      "```",
      ":::",
    ].join("\n");
    const document = createNotebook(source);
    const sourceHashByCell = Object.fromEntries(
      document.cells.map((cell) => [cell.id, getNotebookCellSourceHash(cell)]),
    );
    const session = new NotebookSession(document);
    const executeDocument = vi.fn(
      async (_document, activeSession: NotebookSession) => {
        activeSession.setCellOutput("controls", [
          {
            kind: "input",
            cellId: "controls",
            variableName: "gain",
            inputType: "range",
            value: 8,
            label: "Gain",
            config: { min: 0, max: 10, step: 1, label: "Gain" },
            reconstructable: true,
            source: {
              library: "@lapis-notes/notebook-input",
              factory: "range",
            },
          },
        ]);
      },
    );
    const app = {
      vault: {
        getFileByPath: () => ({
          path: "Notebook.notebook.md",
          stat: { mtime: 999 },
        }),
        cachedRead: async () => source,
      },
      metadataCache: {
        getFileCache: () => ({
          frontmatter: { notebook: { version: 1, mode: "lazy" } },
        }),
      },
      appDatabase: {
        getNotebookState: vi.fn(async () => ({
          sourcePath: "Notebook.notebook.md",
          mtime: 123,
          updatedAt: 456,
          cells: {
            controls: {
              state: "completed",
              sourceHash: sourceHashByCell.controls,
              outputs: [
                {
                  kind: "input",
                  cellId: "controls",
                  variableName: "gain",
                  inputType: "range",
                  value: 8,
                  label: "Gain",
                  config: { min: 0, max: 10, step: 1, label: "Gain" },
                  reconstructable: true,
                  source: {
                    library: "@lapis-notes/notebook-input",
                    factory: "range",
                  },
                },
              ],
              inputValues: { gain: 8 },
            },
          },
        })),
        setNotebookState: vi.fn(async () => undefined),
      },
    } as any;
    const service = new NotebookRenderService(
      app,
      createRuntimeControllerStub({
        getSessionForDocument: () => session,
        getSessionByPath: () => session,
      }),
      executeDocument,
      new Map(),
    );

    await service.getRenderedCell("Notebook.notebook.md", "controls");

    expect(executeDocument).not.toHaveBeenCalled();
  });

  test.each([undefined, true, false])(
    "only recreates callback-dependent inputs when allowed (%s)",
    async (recreateInputs) => {
      const source = [
        ':::cell{#controls lang="ts"}',
        "```ts",
        'const region = view(Inputs.select(["North", "South"], { value: "North", label: "Region" }));',
        "```",
        ":::",
      ].join("\n");
      const document = createNotebook(source);
      const sourceHashByCell = Object.fromEntries(
        document.cells.map((cell) => [
          cell.id,
          getNotebookCellSourceHash(cell),
        ]),
      );
      const session = new NotebookSession(document);
      const executeDocument = vi.fn(
        async (_document, activeSession: NotebookSession) => {
          activeSession.setCellOutput("controls", [
            {
              kind: "input",
              cellId: "controls",
              variableName: "region",
              inputType: "select",
              value: "North",
              label: "Region",
              config: { options: undefined, label: "Region" },
              reconstructable: false,
              source: {
                library: "@lapis-notes/notebook-input",
                factory: "select",
              },
            },
          ]);
        },
      );
      const app = {
        vault: {
          getFileByPath: () => ({
            path: "Notebook.notebook.md",
            stat: { mtime: 999 },
          }),
          cachedRead: async () => source,
        },
        metadataCache: {
          getFileCache: () => ({
            frontmatter: { notebook: { version: 1, mode: "lazy" } },
          }),
        },
        appDatabase: {
          getNotebookState: vi.fn(async () => ({
            sourcePath: "Notebook.notebook.md",
            mtime: 123,
            updatedAt: 456,
            cells: {
              controls: {
                state: "completed",
                sourceHash: sourceHashByCell.controls,
                outputs: [
                  {
                    kind: "input",
                    cellId: "controls",
                    variableName: "region",
                    inputType: "select",
                    value: "North",
                    label: "Region",
                    config: { options: undefined, label: "Region" },
                    reconstructable: false,
                    source: {
                      library: "@lapis-notes/notebook-input",
                      factory: "select",
                    },
                  },
                ],
                inputValues: { region: "North" },
              },
            },
          })),
          setNotebookState: vi.fn(async () => undefined),
        },
      } as any;
      const service = new NotebookRenderService(
        app,
        createRuntimeControllerStub({
          getSessionForDocument: () => session,
          getSessionByPath: () => session,
        }),
        executeDocument,
        new Map(),
      );

      await service.getRenderedCell("Notebook.notebook.md", "controls", {
        recreateInputs,
      });

      expect(executeDocument).toHaveBeenCalledTimes(
        recreateInputs === false ? 0 : 1,
      );
      if (recreateInputs === false) return;
      expect(executeDocument).toHaveBeenCalledWith(
        expect.objectContaining({ sourcePath: "Notebook.notebook.md" }),
        session,
        { cellIds: ["controls"] },
      );
    },
  );

  test("marks changed cells and dependents stale when restoring by source hash", async () => {
    const previousSource = [
      ':::cell{#load lang="ts"}',
      "```ts",
      'const selectedFolder = "Projects";',
      "```",
      ":::",
      "",
      ':::cell{#summary lang="md"}',
      "Folder: {{selectedFolder}}",
      ":::",
    ].join("\n");
    const currentSource = previousSource.replace("Projects", "Archive");
    const previousDocument = createNotebook(previousSource);
    const currentDocument = createNotebook(currentSource);
    const previousHashByCell = Object.fromEntries(
      previousDocument.cells.map((cell) => [
        cell.id,
        getNotebookCellSourceHash(cell),
      ]),
    );
    const session = new NotebookSession(currentDocument);
    const app = {
      vault: {
        getFileByPath: () => ({
          path: "Notebook.notebook.md",
          stat: { mtime: 999 },
        }),
        cachedRead: async () => currentSource,
      },
      metadataCache: {
        getFileCache: () => ({
          frontmatter: { notebook: { version: 1, mode: "lazy" } },
        }),
      },
      appDatabase: {
        getNotebookState: vi.fn(async () => ({
          sourcePath: "Notebook.notebook.md",
          mtime: 123,
          updatedAt: 456,
          cells: {
            load: {
              state: "completed",
              sourceHash: previousHashByCell.load,
              outputs: [{ kind: "markdown", markdown: "Folder: **Projects**" }],
            },
            summary: {
              state: "completed",
              sourceHash: previousHashByCell.summary,
              outputs: [{ kind: "markdown", markdown: "Summary" }],
            },
          },
        })),
      },
    } as any;
    const service = new NotebookRenderService(
      app,
      createRuntimeControllerStub({
        getSessionForDocument: () => session,
        getSessionByPath: () => session,
      }),
      vi.fn(async () => undefined),
      new Map(),
    );

    const loadCell = await service.getRenderedCell(
      "Notebook.notebook.md",
      "load",
    );
    const summaryCell = await service.getRenderedCell(
      "Notebook.notebook.md",
      "summary",
    );

    expect(loadCell).toMatchObject({
      state: "stale",
      outputs: [{ kind: "markdown", markdown: "Folder: **Projects**" }],
    });
    expect(summaryCell).toMatchObject({
      state: "stale",
      outputs: [{ kind: "markdown", markdown: "Summary" }],
    });
  });

  test("runs the current stale cells for a notebook path", async () => {
    const source = [
      ':::cell{#load lang="ts"}',
      "```ts",
      'const selectedFolder = "Archive";',
      "lapis.markdown(`Folder: **${selectedFolder}**`);",
      "```",
      ":::",
      "",
      ':::cell{#summary lang="md"}',
      "Folder: {{selectedFolder}}",
      ":::",
    ].join("\n");
    const document = createNotebook(source);
    const session = new NotebookSession(document);
    session.setCellOutput("load", [
      { kind: "markdown", markdown: "Folder: **Projects**" },
    ]);
    session.setCellOutput("summary", [
      { kind: "markdown", markdown: "Folder: Projects" },
    ]);
    const executeDocument = vi.fn(
      async (
        _document,
        activeSession: NotebookSession,
        options?: { cellIds?: string[] },
      ) => {
        expect(options).toEqual({ cellIds: ["load", "summary"] });
        activeSession.setCellOutput("load", [
          { kind: "markdown", markdown: "Folder: **Archive**" },
        ]);
        activeSession.setCellOutput("summary", [
          { kind: "markdown", markdown: "Folder: Archive" },
        ]);
      },
    );
    const app = {
      vault: {
        getFileByPath: () => ({
          path: "Notebook.notebook.md",
          stat: { mtime: 123 },
        }),
        cachedRead: async () => source,
      },
      metadataCache: {
        getFileCache: () => ({
          frontmatter: { notebook: { version: 1, mode: "lazy" } },
        }),
      },
      appDatabase: {
        getNotebookState: vi.fn(async () => undefined),
        setNotebookState: vi.fn(async () => undefined),
      },
    } as any;
    const service = new NotebookRenderService(
      app,
      createRuntimeControllerStub({
        getSessionForDocument: () => session,
        getSessionByPath: () => session,
        getStaleCellIds: () => ["load", "summary"],
      }),
      executeDocument,
      new Map(),
    );

    const staleCellIds = await service.runStaleCells("Notebook.notebook.md");

    expect(staleCellIds).toEqual(["load", "summary"]);
    expect(executeDocument).toHaveBeenCalledTimes(1);
    expect(session.getCellState("load")).toMatchObject({
      output: [{ kind: "markdown", markdown: "Folder: **Archive**" }],
    });
    expect(session.getCellState("summary")).toMatchObject({
      output: [{ kind: "markdown", markdown: "Folder: Archive" }],
    });
  });

  test("restores the checkpoint when an inline execution is cancelled", async () => {
    const source = [
      ':::cell{#load lang="ts"}',
      "```ts",
      'const selectedFolder = "Projects";',
      "lapis.markdown(selectedFolder);",
      "```",
      ":::",
    ].join("\n");
    const document = createNotebook(source);
    const session = new NotebookSession(document);
    session.setCellOutput("load", [{ kind: "markdown", markdown: "Projects" }]);

    let rejectExecution: ((reason?: unknown) => void) | undefined;
    const executeDocument = vi.fn(
      async () =>
        new Promise<never>((_, reject) => {
          rejectExecution = reject;
        }),
    );
    const cancelNotebookExecution = vi.fn(async () => {
      rejectExecution?.(new Error("Notebook worker was terminated"));
    });
    const app = {
      vault: {
        getFileByPath: () => ({
          path: "Notebook.notebook.md",
          stat: { mtime: 123 },
        }),
        cachedRead: async () => source,
      },
      metadataCache: {
        getFileCache: () => ({
          frontmatter: { notebook: { version: 1, mode: "lazy" } },
        }),
      },
      appDatabase: {
        getNotebookState: vi.fn(async () => undefined),
      },
    } as any;
    const service = new NotebookRenderService(
      app,
      createRuntimeControllerStub({
        getSessionForDocument: () => session,
        getSessionByPath: () => session,
      }),
      executeDocument,
      new Map(),
      undefined,
      cancelNotebookExecution,
    );

    const runPromise = service
      .runCell("Notebook.notebook.md", "load")
      .catch(() => undefined);
    await vi.waitFor(() => expect(executeDocument).toHaveBeenCalledTimes(1));

    expect(session.getCellState("load").state).toBe("running");

    await service.cancelExecution("Notebook.notebook.md");
    await runPromise;

    expect(cancelNotebookExecution).toHaveBeenCalledWith(
      "Notebook.notebook.md",
    );
    expect(session.getCellState("load")).toMatchObject({
      state: "completed",
      output: [{ kind: "markdown", markdown: "Projects" }],
    });
  });

  test("cancelling one notebook does not interrupt another notebook execution", async () => {
    const sourceA = [
      ':::cell{#load lang="ts"}',
      "```ts",
      'lapis.markdown("A");',
      "```",
      ":::",
    ].join("\n");
    const sourceB = [
      ':::cell{#load lang="ts"}',
      "```ts",
      'lapis.markdown("B");',
      "```",
      ":::",
    ].join("\n");
    const documentA = createNotebookAtPath("Notebook-A.notebook.md", sourceA);
    const documentB = createNotebookAtPath("Notebook-B.notebook.md", sourceB);
    const sessionA = new NotebookSession(documentA);
    const sessionB = new NotebookSession(documentB);
    sessionA.setCellOutput("load", [
      { kind: "markdown", markdown: "A persisted" },
    ]);

    let rejectExecutionA: ((reason?: unknown) => void) | undefined;
    let resolveExecutionB: (() => void) | undefined;
    const executeDocument = vi.fn(
      async (document: { sourcePath?: string }, session: NotebookSession) => {
        if (document.sourcePath === "Notebook-A.notebook.md") {
          return new Promise<never>((_, reject) => {
            rejectExecutionA = reject;
          });
        }

        return new Promise<void>((resolve) => {
          resolveExecutionB = () => {
            session.setCellOutput("load", [
              { kind: "markdown", markdown: "B completed" },
            ]);
            resolve();
          };
        });
      },
    );
    const cancelNotebookExecution = vi.fn(async (sourcePath: string) => {
      if (sourcePath === "Notebook-A.notebook.md") {
        rejectExecutionA?.(new Error("Notebook worker was terminated"));
      }
    });

    const app = {
      vault: {
        getFileByPath: (path: string) => ({ path, stat: { mtime: 123 } }),
        cachedRead: async (file: { path: string }) =>
          file.path === "Notebook-A.notebook.md" ? sourceA : sourceB,
      },
      metadataCache: {
        getFileCache: () => ({
          frontmatter: { notebook: { version: 1, mode: "lazy" } },
        }),
      },
      appDatabase: {
        getNotebookState: vi.fn(async () => undefined),
        setNotebookState: vi.fn(async () => undefined),
      },
    } as any;

    const runtimeController = createRuntimeControllerStub({
      getSessionForDocument: (document: { sourcePath?: string }) =>
        document.sourcePath === "Notebook-A.notebook.md" ? sessionA : sessionB,
      getSessionByPath: (sourcePath: string) =>
        sourcePath === "Notebook-A.notebook.md" ? sessionA : sessionB,
    });

    const executionPromises = new Map<string, Promise<void>>();
    const service = new NotebookRenderService(
      app,
      runtimeController,
      executeDocument,
      executionPromises,
      undefined,
      cancelNotebookExecution,
    );

    const runA = service
      .runCell("Notebook-A.notebook.md", "load")
      .catch(() => undefined);
    const runB = service.runCell("Notebook-B.notebook.md", "load");

    await vi.waitFor(() => expect(executeDocument).toHaveBeenCalledTimes(2));
    expect(sessionA.getCellState("load").state).toBe("running");
    expect(sessionB.getCellState("load").state).toBe("running");

    await service.cancelExecution("Notebook-A.notebook.md");
    await runA;

    expect(cancelNotebookExecution).toHaveBeenCalledWith(
      "Notebook-A.notebook.md",
    );
    expect(sessionA.getCellState("load")).toMatchObject({
      state: "completed",
      output: [{ kind: "markdown", markdown: "A persisted" }],
    });
    expect(sessionB.getCellState("load").state).toBe("running");

    resolveExecutionB?.();
    await runB;

    expect(sessionB.getCellState("load")).toMatchObject({
      state: "completed",
      output: [{ kind: "markdown", markdown: "B completed" }],
    });
  });
});
