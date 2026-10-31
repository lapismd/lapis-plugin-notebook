import { describe, expect, test, vi } from "vitest";
import { parseNotebookDocument } from "../../parse/parse-notebook-document";
import { NotebookRuntimeController } from "../notebook-runtime-controller";

vi.mock("@lapis-notes/api", async () => {
  class EventDispatcher<EventMap extends Record<string, any[]>> {
    private readonly listeners = new Map<
      keyof EventMap,
      Set<(...args: any[]) => void>
    >();

    on<EventName extends keyof EventMap>(
      eventName: EventName,
      listener: (...args: EventMap[EventName]) => void,
    ) {
      const listeners = this.listeners.get(eventName) ?? new Set();
      listeners.add(listener as (...args: any[]) => void);
      this.listeners.set(eventName, listeners);
      return {
        eventName,
        callback: listener,
        dispatcher: this,
      };
    }

    offref<EventName extends keyof EventMap>(ref: {
      eventName: EventName;
      callback: (...args: EventMap[EventName]) => void;
    }) {
      this.listeners
        .get(ref.eventName)
        ?.delete(ref.callback as (...args: any[]) => void);
    }

    trigger<EventName extends keyof EventMap>(
      eventName: EventName,
      ...args: EventMap[EventName]
    ) {
      for (const listener of this.listeners.get(eventName) ?? []) {
        listener(...args);
      }
      return true;
    }
  }

  return { EventDispatcher };
});

function createNotebook(sourcePath: string, source: string) {
  return parseNotebookDocument(source, {
    sourcePath,
    frontmatter: { version: 1 },
  });
}

describe("NotebookRuntimeController", () => {
  test("polling an immutable document preserves its graph and running cell state", () => {
    const controller = new NotebookRuntimeController();
    const document = createNotebook(
      "Notebook.notebook.md",
      ':::cell{#one lang="js"}\nconst answer = 1;\n:::',
    );
    const session = controller.getOrCreateSession(document);
    session.beginExecution(["one"]);
    session.markRunning("one", "Running one");
    const graph = session.graph;
    const state = session.getCellState("one");
    for (let i = 0; i < 54; i++) controller.getCellState(document, "one");
    expect(session.graph).toBe(graph);
    expect(session.getCellState("one")).toBe(state);
    const edited = createNotebook(
      document.sourcePath!,
      document.source.replace("answer = 1", "answer = 2"),
    );
    controller.getOrCreateSession(edited);
    expect(session.graph).not.toBe(graph);
    expect(session.getCellState("one").state).toBe("stale");
    controller.destroy();
  });

  test("creates snapshots from notebook sessions", () => {
    const controller = new NotebookRuntimeController();
    const document = createNotebook(
      "Notebook.notebook.md",
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'lapis.markdown("Ran")',
        "```",
        ":::",
      ].join("\n"),
    );

    const snapshot = controller.getOrCreateSnapshot(document);

    expect(snapshot.sourcePath).toBe("Notebook.notebook.md");
    expect(snapshot.session).toBeDefined();
    expect(snapshot.executionState).toEqual({
      state: "idle",
      startedAt: undefined,
      scheduledCellIds: [],
      runningCellId: undefined,
      completedCellIds: [],
      statusMessage: undefined,
      phases: [],
    });
    expect(snapshot.outputState).toEqual({ kind: "none", cellCount: 0 });
  });

  test("subscribes to one notebook path and stops after disposal", () => {
    const controller = new NotebookRuntimeController();
    const documentA = createNotebook(
      "A.notebook.md",
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'lapis.markdown("A")',
        "```",
        ":::",
      ].join("\n"),
    );
    const documentB = createNotebook(
      "B.notebook.md",
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'lapis.markdown("B")',
        "```",
        ":::",
      ].join("\n"),
    );
    const sessionA = controller.getOrCreateSession(documentA);
    const sessionB = controller.getOrCreateSession(documentB);
    const listener = vi.fn();

    const dispose = controller.subscribe("A.notebook.md", listener);
    sessionA.setCellOutput("load", [{ kind: "markdown", markdown: "A" }]);
    sessionB.setCellOutput("load", [{ kind: "markdown", markdown: "B" }]);
    dispose();
    sessionA.setCellOutput("load", [{ kind: "markdown", markdown: "A2" }]);

    expect(listener).toHaveBeenCalledTimes(2);
    expect(listener.mock.calls[0]?.[0]).toMatchObject({
      sourcePath: "A.notebook.md",
      executionState: expect.objectContaining({ state: "idle" }),
    });
    expect(listener.mock.calls[1]?.[0]).toMatchObject({
      sourcePath: "A.notebook.md",
      session: sessionA,
    });
  });

  test("prepares execution and restores checkpoints through the controller", () => {
    const controller = new NotebookRuntimeController();
    const document = createNotebook(
      "Notebook.notebook.md",
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'const selectedFolder = "Projects";',
        "```",
        ":::",
        "",
        ':::cell{#summary lang="md"}',
        "Folder: {{selectedFolder}}",
        ":::",
      ].join("\n"),
    );
    const session = controller.getOrCreateSession(document);
    session.setCellOutput("load", [{ kind: "markdown", markdown: "Projects" }]);

    const prepared = controller.prepareExecution(document, {
      cellIds: ["summary"],
    });

    expect(prepared.session).toBe(session);
    expect(prepared.executionOrder).toEqual(["load", "summary"]);
    expect(session.getExecutionState()).toMatchObject({
      state: "running",
      runningCellId: "load",
      scheduledCellIds: ["summary"],
      completedCellIds: [],
      statusMessage: "Preparing load",
    });

    controller.restoreExecutionCheckpoint(
      "Notebook.notebook.md",
      prepared.checkpoint,
    );

    expect(session.getExecutionState()).toEqual({
      state: "idle",
      startedAt: undefined,
      scheduledCellIds: [],
      runningCellId: undefined,
      completedCellIds: [],
      statusMessage: undefined,
      phases: [],
    });
    expect(session.getCellState("load")).toMatchObject({
      state: "completed",
      output: [{ kind: "markdown", markdown: "Projects" }],
    });
  });

  test("updates input values and resolves downstream dependents through the controller", () => {
    const controller = new NotebookRuntimeController();
    const document = createNotebook(
      "Notebook.notebook.md",
      [
        ':::cell{#controls lang="ts"}',
        "```ts",
        'const region = view(Inputs.select(["North", "South"], { value: "North" }));',
        "```",
        ":::",
        "",
        ':::cell{#summary lang="md"}',
        "Selected region: {{region}}",
        ":::",
      ].join("\n"),
    );
    const session = controller.getOrCreateSession(document);

    const dependentCellIds = controller.updateInputValue(
      "Notebook.notebook.md",
      "controls",
      "region",
      "South",
    );

    expect(dependentCellIds).toEqual(["summary"]);
    expect(session.getInputValue("region")).toBe("South");
    expect(session.getCellInputValues("controls")).toEqual({ region: "South" });
  });

  test("clears notebook outputs through the controller", () => {
    const controller = new NotebookRuntimeController();
    const document = createNotebook(
      "Notebook.notebook.md",
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'lapis.markdown("Ran")',
        "```",
        ":::",
      ].join("\n"),
    );
    const session = controller.getOrCreateSession(document);
    session.setCellOutput("load", [{ kind: "markdown", markdown: "Ran" }]);

    controller.clearOutputs("Notebook.notebook.md");

    expect(session.hasOutputs()).toBe(false);
    expect(session.getCellState("load")).toEqual({ state: "idle" });
    expect(controller.getSnapshot("Notebook.notebook.md").outputState).toEqual({
      kind: "none",
      cellCount: 0,
    });
  });

  test("reports restored and recomputed output state in snapshots", () => {
    const controller = new NotebookRuntimeController();
    const document = createNotebook(
      "Notebook.notebook.md",
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'lapis.markdown("Ran")',
        "```",
        ":::",
      ].join("\n"),
    );
    const session = controller.getOrCreateSession(document);

    session.restorePersistedState({
      load: {
        state: "completed",
        sourceHash: "hash",
        outputs: [{ kind: "markdown", markdown: "Restored" }],
        inputValues: undefined,
        error: undefined,
        durationMs: 12,
        setupPhases: undefined,
      },
    });

    expect(controller.getSnapshot("Notebook.notebook.md").outputState).toEqual({
      kind: "restored",
      cellCount: 1,
    });

    session.beginExecution(["load"], "Queued");
    session.markRunning("load", "Running");
    session.setCellOutput("load", [{ kind: "markdown", markdown: "Ran" }]);

    expect(controller.getSnapshot("Notebook.notebook.md").outputState).toEqual({
      kind: "recomputed",
      cellCount: 1,
    });
  });

  test("creates graph snapshots for notebook chrome consumers", () => {
    const controller = new NotebookRuntimeController();
    const document = createNotebook(
      "Notebook.notebook.md",
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'const selectedFolder = "Projects";',
        "```",
        ":::",
        "",
        ':::cell{#summary lang="md"}',
        "Folder: {{selectedFolder}}",
        ":::",
      ].join("\n"),
    );
    const session = controller.getOrCreateSession(document);
    session.setCellOutput("summary", [
      { kind: "markdown", markdown: "Folder: Projects" },
    ]);

    const snapshot = controller.getOrCreateGraphSnapshot(document);

    expect(snapshot.sourcePath).toBe("Notebook.notebook.md");
    expect(snapshot.graph.order).toEqual(["load", "summary"]);
    expect(snapshot.graph.nodes.get("summary")?.dependencies).toEqual(["load"]);
    expect(snapshot.getCellState("summary")).toMatchObject({
      state: "completed",
      output: [{ kind: "markdown", markdown: "Folder: Projects" }],
    });
  });

  test("reports stale cell ids and output presence through the controller", () => {
    const controller = new NotebookRuntimeController();
    const initial = createNotebook(
      "Notebook.notebook.md",
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'const selectedFolder = "Notes";',
        "```",
        ":::",
        "",
        ':::cell{#summary lang="md"}',
        "Folder: {{selectedFolder}}",
        ":::",
      ].join("\n"),
    );
    const updated = createNotebook(
      "Notebook.notebook.md",
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'const selectedFolder = "Projects";',
        "```",
        ":::",
        "",
        ':::cell{#summary lang="md"}',
        "Folder: {{selectedFolder}}",
        ":::",
      ].join("\n"),
    );
    const session = controller.getOrCreateSession(initial);
    session.setCellOutput("load", [{ kind: "markdown", markdown: "Notes" }]);

    expect(controller.hasOutputs(initial)).toBe(true);

    session.updateDocument(updated);

    expect(controller.getStaleCellIds(updated)).toEqual(["load", "summary"]);
  });

  test("reads cell state and input values and clears one cell output through the controller", () => {
    const controller = new NotebookRuntimeController();
    const document = createNotebook(
      "Notebook.notebook.md",
      [
        ':::cell{#controls lang="ts"}',
        "```ts",
        'const region = view(Inputs.select(["North", "South"], { value: "North" }));',
        "```",
        ":::",
      ].join("\n"),
    );
    const session = controller.getOrCreateSession(document);
    session.setCellOutput("controls", [
      { kind: "markdown", markdown: "North" },
    ]);
    session.setInputValue("controls", "region", "South");

    expect(controller.getCellState(document, "controls")).toMatchObject({
      state: "completed",
      output: [{ kind: "markdown", markdown: "North" }],
    });
    expect(controller.getInputValue("Notebook.notebook.md", "region")).toBe(
      "South",
    );

    controller.clearCellOutput(document, "controls");

    expect(session.getCellState("controls")).toEqual({ state: "idle" });
    expect(
      controller.getInputValue("Notebook.notebook.md", "region"),
    ).toBeUndefined();
  });
});
