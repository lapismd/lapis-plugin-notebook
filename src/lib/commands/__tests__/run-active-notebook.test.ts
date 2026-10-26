import { beforeEach, describe, expect, test, vi } from "vitest";
import { NotebookRuntimeController } from "../../runtime/notebook-runtime-controller";
import {
  runActiveNotebook,
  runCurrentNotebookCell,
  runStaleNotebookCells,
} from "../run-active-notebook";

const { noticeSpy } = vi.hoisted(() => ({
  noticeSpy: vi.fn(),
}));

vi.mock("@lapis-notes/api", async () => {
  const noop = () => undefined;
  const mockLogger = { debug: noop, info: noop, warn: noop, error: noop };
  return {
    EventDispatcher: class EventDispatcher {
      on() {
        return {
          eventName: "changed",
          callback: () => undefined,
          dispatcher: this,
        };
      }

      trigger() {
        return true;
      }
    },
    logging: {
      getLogger() {
        return mockLogger;
      },
    },
    Notice: class Notice {
      constructor(message: string) {
        noticeSpy(message);
      }
    },
  };
});

vi.mock("../../runtime/notebook-execution-signal.svelte", () => ({
  incrementNotebookExecutionRevision: vi.fn(),
  incrementNotebookCellExecutionRevisions: vi.fn(),
}));

function createFile(path = "Notebook.notebook.md", extension = "md") {
  return {
    path,
    extension,
    stat: { mtime: 123 },
  };
}

function offsetFromPosition(source: string, line: number, ch: number): number {
  const lines = source.split("\n");
  return (
    lines.slice(0, line).join("\n").length + (line > 0 ? 1 : 0) * line + ch
  );
}

function createApp(
  source: string,
  file = createFile(),
  options?: {
    editorSource?: string;
    cursor?: { line: number; ch: number };
  },
) {
  const editorSource = options?.editorSource ?? source;
  const cursor = options?.cursor ?? { line: 0, ch: 0 };
  const editor = {
    getValue: vi.fn(() => editorSource),
    getCursor: vi.fn(() => cursor),
    posToOffset: vi.fn((position: { line: number; ch: number }) =>
      offsetFromPosition(editorSource, position.line, position.ch),
    ),
  };
  return {
    safeMode: {
      active: false,
      disableCommunityPlugins: false,
      disableOptionalCorePlugins: false,
      skipLayoutRestore: false,
      disableNotebookExecution: false,
      lastStartupFailure: null,
    },
    workspace: {
      getActiveFile: vi.fn(() => file),
      activeLeaf: {
        view: {
          file,
          editor,
        },
      },
    },
    vault: {
      cachedRead: vi.fn(async () => source),
    },
    metadataCache: {
      getFileCache: vi.fn(() => null),
    },
    appDatabase: {
      setNotebookState: vi.fn(async () => {}),
    },
    editor,
  };
}

describe("runActiveNotebook", () => {
  beforeEach(() => {
    noticeSpy.mockReset();
  });

  test("executes the active notebook and persists outputs", async () => {
    const source = [
      "---",
      "notebook:",
      "  version: 1",
      "---",
      "",
      ':::cell{#load lang="ts"}',
      "```ts",
      'lapis.markdown("Ran")',
      "```",
      ":::",
    ].join("\n");
    const app = createApp(source);
    const runtimeController = new NotebookRuntimeController();
    const runtime = {
      executeDocument: vi.fn(async (_document, session) => {
        session.setCellOutput("load", [{ kind: "markdown", markdown: "Ran" }]);
        return {
          outputs: { load: [{ kind: "markdown", markdown: "Ran" }] },
          values: {},
        };
      }),
    };

    const result = await runActiveNotebook(
      app as any,
      runtimeController,
      runtime as any,
    );

    expect(result).toMatchObject({ path: "Notebook.notebook.md" });
    expect(runtime.executeDocument).toHaveBeenCalledTimes(1);
    expect(app.appDatabase.setNotebookState).toHaveBeenCalledWith(
      "Notebook.notebook.md",
      expect.objectContaining({
        sourcePath: "Notebook.notebook.md",
        cells: {
          load: expect.objectContaining({
            state: "completed",
            outputs: [{ kind: "markdown", markdown: "Ran" }],
          }),
        },
      }),
    );
    expect(noticeSpy).toHaveBeenCalledWith("Ran notebook");
  });

  test("blocks notebook execution while safe mode disables notebook runtime", async () => {
    const source = [
      "---",
      "notebook:",
      "  version: 1",
      "---",
      "",
      ':::cell{#load lang="ts"}',
      "```ts",
      'lapis.markdown("Ran")',
      "```",
      ":::",
    ].join("\n");
    const app = createApp(source);
    app.safeMode = {
      active: true,
      disableCommunityPlugins: false,
      disableOptionalCorePlugins: false,
      skipLayoutRestore: false,
      disableNotebookExecution: true,
      lastStartupFailure: null,
    };
    const runtimeController = new NotebookRuntimeController();
    const runtime = {
      executeDocument: vi.fn(async () => {
        throw new Error("Notebook execution should not run in Safe Mode");
      }),
    };

    const result = await runActiveNotebook(
      app as any,
      runtimeController,
      runtime as any,
    );

    expect(result).toBeNull();
    expect(runtime.executeDocument).not.toHaveBeenCalled();
    expect(noticeSpy).toHaveBeenCalledWith(
      "Notebook execution is disabled while Safe Mode is active",
    );
  });

  test("publishes scheduled and running notebook state before execution completes", async () => {
    const source = [
      "---",
      "notebook:",
      "  version: 1",
      "---",
      "",
      ':::cell{#load lang="ts"}',
      "```ts",
      'const stageOne = "alpha";',
      "lapis.markdown(stageOne);",
      "```",
      ":::",
      "",
      ':::cell{#transform lang="ts"}',
      "```ts",
      "const stageTwo = `${stageOne} beta`;",
      "lapis.markdown(stageTwo);",
      "```",
      ":::",
      "",
      ':::cell{#summary lang="md"}',
      "Final: {{stageTwo}}",
      ":::",
    ].join("\n");
    const app = createApp(source);
    const runtimeController = new NotebookRuntimeController();
    const runtime = {
      executeDocument: vi.fn(async (_document, session) => {
        expect(session.getExecutionState()).toMatchObject({
          state: "running",
          runningCellId: "load",
          scheduledCellIds: ["transform", "summary"],
          completedCellIds: [],
          statusMessage: "Preparing load",
        });
        expect(session.getCellState("load").state).toBe("running");
        expect(session.getCellState("transform")).toMatchObject({
          state: "scheduled",
          statusMessage: "Queued 3 notebook cells",
        });
        expect(session.getCellState("summary")).toMatchObject({
          state: "scheduled",
          statusMessage: "Queued 3 notebook cells",
        });

        session.setCellOutput("load", [
          { kind: "markdown", markdown: "alpha" },
        ]);
        session.setCellOutput("transform", [
          { kind: "markdown", markdown: "alpha beta" },
        ]);
        session.setCellOutput("summary", [
          { kind: "markdown", markdown: "Final: alpha beta" },
        ]);

        return {
          outputs: {
            load: [{ kind: "markdown", markdown: "alpha" }],
            transform: [{ kind: "markdown", markdown: "alpha beta" }],
            summary: [{ kind: "markdown", markdown: "Final: alpha beta" }],
          },
          values: {},
        };
      }),
    };

    await runActiveNotebook(app as any, runtimeController, runtime as any);

    expect(runtime.executeDocument).toHaveBeenCalledTimes(1);
  });

  test("restores notebook execution state when runtime startup fails", async () => {
    const source = [
      "---",
      "notebook:",
      "  version: 1",
      "---",
      "",
      ':::cell{#load lang="ts"}',
      "```ts",
      'lapis.markdown("Ran")',
      "```",
      ":::",
    ].join("\n");
    const app = createApp(source);
    const runtimeController = new NotebookRuntimeController();
    const runtime = {
      executeDocument: vi.fn(async () => {
        throw new Error("runtime startup failed");
      }),
    };

    await expect(
      runActiveNotebook(app as any, runtimeController, runtime as any),
    ).rejects.toThrow("runtime startup failed");

    const session = runtimeController.getSession("Notebook.notebook.md");
    expect(session?.getExecutionState()).toEqual({
      state: "idle",
      scheduledCellIds: [],
      completedCellIds: [],
      phases: [],
    });
    expect(session?.getCellState("load")).toEqual({ state: "idle" });
  });

  test("shows a notice when the active note is not a notebook file", async () => {
    const app = createApp("# Plain note", createFile("Plain.md"));
    const runtimeController = new NotebookRuntimeController();
    const runtime = {
      executeDocument: vi.fn(),
    };

    const result = await runActiveNotebook(
      app as any,
      runtimeController,
      runtime as any,
    );

    expect(result).toBeNull();
    expect(runtime.executeDocument).not.toHaveBeenCalled();
    expect(noticeSpy).toHaveBeenCalledWith(
      "Notebook execution is only available for notebook notes",
    );
  });

  test("runs only the current notebook cell selected by the editor cursor", async () => {
    const source = [
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
      "",
      ':::cell{#summary lang="md"}',
      "Chosen folder: {{selectedFolder}}",
      ":::",
    ].join("\n");
    const app = createApp(source, createFile(), {
      cursor: { line: 12, ch: 5 },
    });
    const runtimeController = new NotebookRuntimeController();
    const runtime = {
      executeDocument: vi.fn(async () => ({ outputs: {}, values: {} })),
    };

    const result = await runCurrentNotebookCell(
      app as any,
      runtimeController,
      runtime as any,
    );

    expect(result).toMatchObject({ path: "Notebook.notebook.md" });
    expect(runtime.executeDocument).toHaveBeenCalledWith(
      expect.objectContaining({ sourcePath: "Notebook.notebook.md" }),
      expect.anything(),
      { cellIds: ["summary"] },
    );
    expect(noticeSpy).toHaveBeenCalledWith("Ran current notebook cell");
  });

  test("runs stale notebook cells with scoped targets", async () => {
    const initial = [
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
      "",
      ':::cell{#summary lang="md"}',
      "Chosen folder: {{selectedFolder}}",
      ":::",
    ].join("\n");
    const updated = initial.replace("Notes", "Projects");
    const app = createApp(updated);
    const runtimeController = new NotebookRuntimeController();
    const runtime = {
      executeDocument: vi.fn(async () => ({ outputs: {}, values: {} })),
    };

    await runActiveNotebook(
      createApp(initial) as any,
      runtimeController,
      runtime as any,
    );
    runtime.executeDocument.mockClear();
    noticeSpy.mockReset();

    const result = await runStaleNotebookCells(
      app as any,
      runtimeController,
      runtime as any,
    );

    expect(result).toMatchObject({ path: "Notebook.notebook.md" });
    expect(runtime.executeDocument).toHaveBeenCalledWith(
      expect.objectContaining({ sourcePath: "Notebook.notebook.md" }),
      expect.anything(),
      { cellIds: ["load", "summary"] },
    );
    expect(noticeSpy).toHaveBeenCalledWith("Ran stale notebook cells");
  });

  test("runs stale notebook cells with required dependency closures", async () => {
    const initial = [
      "---",
      "notebook:",
      "  version: 1",
      "---",
      "",
      ':::cell{#setup lang="ts"}',
      "```ts",
      'const selectedFolder = "Notes";',
      'const emphasis = "highs";',
      "```",
      ":::",
      "",
      ':::cell{#summary lang="md"}',
      "Summary cell uses the current folder: **{{selectedFolder}}** with emphasis `{{emphasis}}`.",
      ":::",
      "",
      ':::cell{#tail lang="ts"}',
      "```ts",
      'lapis.markdown("Tail")',
      "```",
      ":::",
    ].join("\n");
    const updated = initial.replace("with emphasis", "and emphasis");
    const app = createApp(updated);
    const runtimeController = new NotebookRuntimeController();
    const runtime = {
      executeDocument: vi.fn(async () => ({ outputs: {}, values: {} })),
    };

    await runActiveNotebook(
      createApp(initial) as any,
      runtimeController,
      runtime as any,
    );
    runtime.executeDocument.mockClear();
    noticeSpy.mockReset();

    const result = await runStaleNotebookCells(
      app as any,
      runtimeController,
      runtime as any,
    );

    expect(result).toMatchObject({ path: "Notebook.notebook.md" });
    // Only summary is stale (setup's output is still valid after summary was
    // edited). resolveExecutionOrder inside the worker expands the closure to
    // include setup at execution time, so the final run still covers both.
    expect(runtime.executeDocument).toHaveBeenCalledWith(
      expect.objectContaining({ sourcePath: "Notebook.notebook.md" }),
      expect.anything(),
      { cellIds: ["summary"] },
    );
    expect(noticeSpy).toHaveBeenCalledWith("Ran stale notebook cells");
  });

  test("does not persist runs from unsaved editor content", async () => {
    const source = [
      "---",
      "notebook:",
      "  version: 1",
      "---",
      "",
      ':::cell{#load lang="ts"}',
      "```ts",
      'lapis.markdown("Saved")',
      "```",
      ":::",
    ].join("\n");
    const app = createApp(source, createFile(), {
      editorSource: source.replace("Saved", "Dirty"),
    });
    const runtimeController = new NotebookRuntimeController();
    const runtime = {
      executeDocument: vi.fn(async (_document, session) => {
        session.setCellOutput("load", [
          { kind: "markdown", markdown: "Dirty" },
        ]);
        return {
          outputs: { load: [{ kind: "markdown", markdown: "Dirty" }] },
          values: {},
        };
      }),
    };

    await runActiveNotebook(app as any, runtimeController, runtime as any);

    expect(app.appDatabase.setNotebookState).not.toHaveBeenCalled();
    expect(noticeSpy).toHaveBeenCalledWith(
      "Ran notebook from unsaved editor content",
    );
  });
});
