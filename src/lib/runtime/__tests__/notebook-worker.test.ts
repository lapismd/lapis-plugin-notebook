import { afterEach, describe, expect, test, vi } from "vitest";
import { parseNotebookDocument } from "../../parse/parse-notebook-document";
import {
  executeNotebookDocument,
  resolveExecutionOrder,
} from "../notebook-worker";
import { NotebookSession } from "../notebook-session";
import type { NotebookExecutionHost } from "../notebook-execution-host";
import { claimNotebookDomOutput } from "../notebook-dom-registry";

describe("executeNotebookDocument", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test.each([
    ["[]", [{ kind: "code", language: "javascript", code: "[]" }]],
    ["null", [{ kind: "code", language: "javascript", code: "null" }]],
    [
      "undefined",
      [{ kind: "code", language: "javascript", code: "undefined" }],
    ],
    [
      "[1, 2]",
      [{ kind: "code", language: "javascript", code: "[\n  1,\n  2\n]" }],
    ],
    [
      '({name: "Ada"})',
      [{ kind: "code", language: "javascript", code: '{\n  "name": "Ada"\n}' }],
    ],
    [
      '[{kind:"text", text:"first"}, {kind:"text", text:"second"}]',
      [
        { kind: "text", text: "first" },
        { kind: "text", text: "second" },
      ],
    ],
    ['"Readable text"', [{ kind: "text", text: "Readable text" }]],
    ["42", [{ kind: "code", language: "javascript", code: "42" }]],
    ["true", [{ kind: "code", language: "javascript", code: "true" }]],
    ["12n", [{ kind: "code", language: "javascript", code: "12n" }]],
    [
      "[undefined, NaN, Infinity, -0, 12n]",
      [
        {
          kind: "code",
          language: "javascript",
          code: "[\n  undefined,\n  NaN,\n  Infinity,\n  -0,\n  12n\n]",
        },
      ],
    ],
    [
      '(() => { const value = { name: "Ada" }; value.self = value; return value; })()',
      [
        {
          kind: "code",
          language: "javascript",
          code: '{\n  "name": "Ada",\n  "self": "[Circular]"\n}',
        },
      ],
    ],
    [
      "(() => { const value = []; value.push(value); return value; })()",
      [{ kind: "code", language: "javascript", code: '[\n  "[Circular]"\n]' }],
    ],
    [
      "(() => { const value = { id: 1 }; return [value, value]; })()",
      [
        {
          kind: "code",
          language: "javascript",
          code: '[\n  {\n    "id": 1\n  },\n  {\n    "id": 1\n  }\n]',
        },
      ],
    ],
  ])(
    "renders display values without caller serialization: %s",
    async (value, expected) => {
      const document = parseNotebookDocument(
        `:::cell{#value lang="js"}\n\`\`\`js\ndisplay(${value});\n\`\`\`\n:::`,
        { sourcePath: "Values.notebook.md" },
      );
      const host: NotebookExecutionHost = {
        getAppTablesSnapshot: async () => ({
          notes: [],
          links: [],
          searchDocuments: [],
        }),
        readVaultFile: async () => new ArrayBuffer(0),
      };
      const result = await executeNotebookDocument(
        host,
        document,
        new NotebookSession(document),
      );
      expect(result.outputs.value).toEqual(expected);
    },
  );

  test("skips duckdb app table setup for ts cells that do not use duckdb", async () => {
    const document = parseNotebookDocument(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'lapis.markdown("ready");',
        "```",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Notebook.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async () => new ArrayBuffer(0),
    };
    const duckdbService = {
      ensureAppTables: vi.fn(async (_register: () => Promise<void>) => {}),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;

    const result = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
    );

    expect(duckdbService.ensureAppTables).not.toHaveBeenCalled();
    expect(result.outputs.load).toEqual([
      expect.objectContaining({
        kind: "markdown",
        markdown: "ready",
      }),
    ]);
  });

  test("captures ts outputs and definitions for downstream markdown cells", async () => {
    const document = parseNotebookDocument(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'const selectedFolder = "Notes";',
        "lapis.markdown(`Folder: **${selectedFolder}**`);",
        "```",
        ":::",
        "",
        ':::cell{#summary lang="md"}',
        "Chosen folder: {{selectedFolder}}",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Notebook.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async () => new ArrayBuffer(0),
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;

    const result = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
    );

    expect(result.outputs.load).toEqual([
      expect.objectContaining({
        kind: "markdown",
        markdown: "Folder: **Notes**",
      }),
    ]);
    expect(result.outputs.summary).toEqual([
      expect.objectContaining({
        kind: "markdown",
        markdown: "Chosen folder: Notes",
      }),
    ]);
    expect(result.values.selectedFolder).toBe("Notes");
  });

  test("interpolates markdown expression cells from notebook state", async () => {
    const document = parseNotebookDocument(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'const selectedName = "Ada";',
        "const score = 7;",
        "```",
        ":::",
        "",
        ':::cell{#summary lang="md"}',
        "Hello, **${selectedName.toUpperCase()}**: ${score + 1}",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Notebook.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async () => new ArrayBuffer(0),
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;

    const result = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
    );

    expect(result.outputs.summary).toEqual([
      expect.objectContaining({
        kind: "markdown",
        markdown: "Hello, **ADA**: 8",
      }),
    ]);
  });

  test("interpolates HTML cells with escaped expression values", async () => {
    const document = parseNotebookDocument(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'const selectedName = "<Ada & Co>";',
        "```",
        ":::",
        "",
        ':::cell{#card lang="html"}',
        '<article data-name="${selectedName}"><strong>${selectedName}</strong></article>',
        ":::",
      ].join("\n"),
      {
        sourcePath: "Notebook.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async () => new ArrayBuffer(0),
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;

    const result = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
    );

    expect(result.outputs.card).toEqual([
      expect.objectContaining({
        kind: "html",
        html: '<article data-name="&lt;Ada &amp; Co&gt;"><strong>&lt;Ada &amp; Co&gt;</strong></article>',
      }),
    ]);
  });

  test("supports explicit display helper output in program cells", async () => {
    class FakeNode extends EventTarget {}
    vi.stubGlobal("Node", FakeNode);

    const document = parseNotebookDocument(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        "class DisplayNode extends Node {}",
        'const greeting = "Hello";',
        "display(`${greeting} from display`);",
        "display(new DisplayNode());",
        "```",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Notebook.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async () => new ArrayBuffer(0),
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;

    const result = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
    );

    expect(result.outputs.load).toEqual([
      expect.objectContaining({
        kind: "text",
        text: "Hello from display",
      }),
      expect.objectContaining({
        kind: "dom",
        role: "dom",
      }),
    ]);
  });

  test("exposes markdown and TeX tagged-template helpers in program cells", async () => {
    const document = parseNotebookDocument(
      [
        ':::cell{#helpers lang="ts"}',
        "```ts",
        'const label = "Velocity";',
        "md`## ${label}`;",
        "lapis.md`Inline ${label}`;",
        "tex`v = d / t`;",
        "tex.block`E = mc^2`;",
        "```",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Notebook.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async () => new ArrayBuffer(0),
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;

    const result = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
    );

    expect(result.outputs.helpers).toEqual([
      expect.objectContaining({ kind: "markdown", markdown: "## Velocity" }),
      expect.objectContaining({
        kind: "markdown",
        markdown: "Inline Velocity",
      }),
      expect.objectContaining({ kind: "markdown", markdown: "$v = d / t$" }),
      expect.objectContaining({
        kind: "markdown",
        markdown: "$$\nE = mc^2\n$$",
      }),
    ]);
  });

  test("uses an injected compile provider for JavaScript-like cells", async () => {
    const document = parseNotebookDocument(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        "const ignored: number = 0;",
        "```",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Compile.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async () => new ArrayBuffer(0),
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;
    const compileProvider = vi.fn(async () => ({
      code: 'lapis.markdown("compiled by provider");',
      importedBindings: [],
    }));

    const result = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
      { compileProvider },
    );

    expect(compileProvider).toHaveBeenCalledWith({
      source: "const ignored: number = 0;",
      language: "ts",
      sourcePath: "Compile.notebook.md",
      cellId: "load",
    });
    expect(result.outputs.load).toEqual([
      expect.objectContaining({
        kind: "markdown",
        markdown: "compiled by provider",
      }),
    ]);
  });

  test("uses injected notebook file readers for vault helper reads", async () => {
    const fileBuffer = encodeNotebookText("from provider");
    const fileReaderProvider = vi.fn(async () => fileBuffer);
    const document = parseNotebookDocument(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'const body = await lapis.vault.readText("./assets/demo.txt");',
        "lapis.markdown(body);",
        "```",
        ":::",
      ].join("\n"),
      { sourcePath: "Notebook Demo/Example.notebook.md" },
    );
    const session = new NotebookSession(document);
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: fileReaderProvider,
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;

    const result = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
    );

    expect(fileReaderProvider).toHaveBeenCalledWith(
      "./assets/demo.txt",
      "Notebook Demo/Example.notebook.md",
    );
    expect(result.outputs.load).toEqual([
      expect.objectContaining({
        kind: "markdown",
        markdown: "from provider",
      }),
    ]);
  });

  test("executes only the requested cell dependency closure", async () => {
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
        'lapis.markdown("load");',
        "```",
        ":::",
        "",
        ':::cell{#summary lang="md"}',
        "Chosen folder: {{selectedFolder}}",
        ":::",
        "",
        ':::cell{#tail lang="ts"}',
        "```ts",
        'lapis.markdown("tail");',
        "```",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Notebook.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async () => new ArrayBuffer(0),
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;

    const result = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
      {
        cellIds: ["summary"],
      },
    );

    expect(Object.keys(result.outputs)).toEqual(["load", "summary"]);
    expect(result.outputs.summary).toEqual([
      expect.objectContaining({
        kind: "markdown",
        markdown: "Chosen folder: Notes",
      }),
    ]);
    expect(session.getCellState("tail").state).toBe("idle");
  });

  test("skips satisfied input dependencies when rerunning a markdown cell", async () => {
    class FakeNode extends EventTarget {
      value: unknown;

      constructor(value: unknown) {
        super();
        this.value = value;
      }
    }
    vi.stubGlobal("Node", FakeNode);

    const document = parseNotebookDocument(
      [
        ':::cell{#controls lang="ts"}',
        "```ts",
        'const gain = view(Inputs.range([0, 10], { value: 5, step: 1, label: "Gain" }));',
        "```",
        ":::",
        "",
        ':::cell{#summary lang="md"}',
        "The gain is {{gain}}",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Notebook.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async () => new ArrayBuffer(0),
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;

    await executeNotebookDocument(host, document, session, duckdbService);

    expect(
      resolveExecutionOrder(document, session, { cellIds: ["summary"] }),
    ).toEqual(["summary"]);

    const result = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
      {
        cellIds: ["summary"],
      },
    );

    expect(Object.keys(result.outputs)).toEqual(["summary"]);
    expect(result.outputs.summary).toEqual([
      expect.objectContaining({ kind: "markdown", markdown: "The gain is 5" }),
    ]);
    expect(session.getInputValue("gain")).toBe(5);
  });

  test("passes the notebook source path when registering relative vault files", async () => {
    const document = parseNotebookDocument(
      [
        "---",
        "notebook:",
        "  version: 1",
        "---",
        "",
        ':::cell{#load lang="ts"}',
        "```ts",
        'await lapis.duckdb.registerVaultFile("demo_csv", "./assets/demo.csv");',
        'lapis.markdown("registered");',
        "```",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Notebook Demo/Example.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const readVaultFile = async (_path: string, _sourcePath?: string) =>
      new ArrayBuffer(0);
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile,
    };
    const hostSpy = vi.spyOn(host, "readVaultFile");
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;

    await executeNotebookDocument(host, document, session, duckdbService, {
      cellIds: ["load"],
    });

    expect(hostSpy).toHaveBeenCalledWith(
      "Notebook Demo/assets/demo.csv",
      "Notebook Demo/Example.notebook.md",
    );
    expect(session.getCellState("load").setupPhases).toEqual([
      expect.objectContaining({
        key: "duckdb:setup:load",
        status: "completed",
      }),
      expect.objectContaining({
        key: "duckdb:register:load:demo_csv",
        status: "completed",
      }),
    ]);
  });

  test("reports streamed execution progress for scheduled, running, and completed cells", async () => {
    const document = parseNotebookDocument(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'const selectedFolder = "Notes";',
        'lapis.markdown("load");',
        "```",
        ":::",
        "",
        ':::cell{#summary lang="md"}',
        "Chosen folder: {{selectedFolder}}",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Notebook.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async () => new ArrayBuffer(0),
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;
    const events: string[] = [];

    await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
      { cellIds: ["summary"] },
      (event) => {
        events.push(
          event.type === "execution-started"
            ? `${event.type}:${event.cellIds.join(",")}`
            : event.type === "cell-running"
              ? `${event.type}:${event.cellId}`
              : event.type === "cell-completed" || event.type === "cell-output"
                ? `${event.type}:${event.cellId}`
                : event.type === "status"
                  ? `${event.type}:${event.cellId ?? "notebook"}:${event.message}`
                  : event.type,
        );
      },
    );

    expect(events).toEqual([
      "execution-started:load,summary",
      "cell-running:load",
      "status:load:Running load",
      "cell-output:load",
      "cell-completed:load",
      "cell-running:summary",
      "cell-completed:summary",
    ]);
    expect(session.getCellState("load").state).toBe("completed");
    expect(session.getCellState("summary").state).toBe("completed");
  });

  test("captures Observable-style input values and ephemeral DOM outputs", async () => {
    class FakeNode extends EventTarget {}
    vi.stubGlobal("Node", FakeNode);

    const document = parseNotebookDocument(
      [
        ':::cell{#controls lang="ts"}',
        "```ts",
        "class FakeInput extends Node {",
        "  value = 7;",
        "}",
        'const gain = await lapis.view("gain", new FakeInput());',
        "lapis.markdown(`Gain: ${gain}`);",
        "```",
        ":::",
        "",
        ':::cell{#summary lang="md"}',
        "Selected gain: {{gain}}",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Inputs.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async () => new ArrayBuffer(0),
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;

    const result = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
    );

    expect(result.values.gain).toBe(7);
    expect(session.getInputValue("gain")).toBe(7);
    expect(result.outputs.controls).toEqual([
      expect.objectContaining({ kind: "dom", role: "input", label: "gain" }),
      expect.objectContaining({ kind: "markdown", markdown: "Gain: 7" }),
    ]);
    expect(result.outputs.summary).toEqual([
      expect.objectContaining({
        kind: "markdown",
        markdown: "Selected gain: 7",
      }),
    ]);
  });

  test("emits structured input outputs when input metadata is attached", async () => {
    class FakeNode extends EventTarget {
      value: unknown;

      constructor(value: unknown) {
        super();
        this.value = value;
      }
    }
    vi.stubGlobal("Node", FakeNode);

    const document = parseNotebookDocument(
      [
        ':::cell{#controls lang="ts"}',
        "```ts",
        'const gain = view(Inputs.range([0, 10], { value: 7, step: 1, label: "Gain" }));',
        "lapis.markdown(`Gain: ${gain}`);",
        "```",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Inputs.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async () => new ArrayBuffer(0),
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;

    const result = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
    );

    expect(result.outputs.controls).toEqual([
      {
        kind: "input",
        cellId: "controls",
        variableName: "gain",
        inputType: "range",
        value: 7,
        label: "Gain",
        config: { min: 0, max: 10, step: 1, label: "Gain" },
        reconstructable: true,
        source: {
          library: "@lapis-notes/notebook-input",
          factory: "range",
        },
      },
      expect.objectContaining({ kind: "markdown", markdown: "Gain: 7" }),
    ]);
    expect(result.values.gain).toBe(7);
    expect(session.getInputValue("gain")).toBe(7);
  });

  test("reruns Observable-style input cells without redeclaring previous values", async () => {
    class FakeNode extends EventTarget {}
    vi.stubGlobal("Node", FakeNode);

    const document = parseNotebookDocument(
      [
        ':::cell{#controls lang="ts"}',
        "```ts",
        "class FakeInput extends Node {",
        "  constructor(value) {",
        "    super();",
        "    this.value = value;",
        "  }",
        "}",
        "const gain = view(new FakeInput(7));",
        "lapis.markdown(`Gain: ${gain}`);",
        "```",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Inputs.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async () => new ArrayBuffer(0),
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;

    await executeNotebookDocument(host, document, session, duckdbService);
    const result = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
      {
        cellIds: ["controls"],
        skipDependencyClosure: true,
      },
    );

    expect(result.outputs.controls).toEqual([
      expect.objectContaining({ kind: "dom", role: "input", label: "gain" }),
      expect.objectContaining({ kind: "markdown", markdown: "Gain: 7" }),
    ]);
    expect(session.getCellState("controls").state).toBe("completed");
  });

  test("keeps previous DOM outputs registered until reruns produce replacements", async () => {
    class FakeNode extends EventTarget {
      value: unknown;

      constructor(value: unknown) {
        super();
        this.value = value;
      }
    }
    vi.stubGlobal("Node", FakeNode);

    const document = parseNotebookDocument(
      [
        ':::cell{#controls lang="ts"}',
        "```ts",
        "class FakeInput extends Node {",
        "  constructor(value) {",
        "    super();",
        "    this.value = value;",
        "  }",
        "}",
        'const marker = await lapis.vault.readText("./hold.txt");',
        'const gain = view(new FakeInput(marker === "next" ? 9 : 7));',
        "```",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Inputs.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    let readCount = 0;
    let resolvePendingRead: ((value: ArrayBuffer) => void) | undefined;
    const readVaultFile = vi.fn(async () => {
      readCount += 1;
      if (readCount === 1) {
        return encodeNotebookText("first");
      }

      return new Promise<ArrayBuffer>((resolve) => {
        resolvePendingRead = resolve;
      });
    });
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile,
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;

    await executeNotebookDocument(host, document, session, duckdbService);
    const previousDomOutput = session
      .getCellState("controls")
      .output?.find((output) => output.kind === "dom");
    expect(previousDomOutput).toMatchObject({
      kind: "dom",
      role: "input",
      label: "gain",
    });
    expect(claimNotebookDomOutput(previousDomOutput!.outputId)).toBeInstanceOf(
      FakeNode,
    );

    const rerun = executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
      {
        cellIds: ["controls"],
        skipDependencyClosure: true,
      },
    );
    await vi.waitFor(() => expect(readVaultFile).toHaveBeenCalledTimes(2));

    expect(claimNotebookDomOutput(previousDomOutput!.outputId)).toBeInstanceOf(
      FakeNode,
    );

    resolvePendingRead?.(encodeNotebookText("next"));
    await rerun;

    const nextDomOutput = session
      .getCellState("controls")
      .output?.find((output) => output.kind === "dom");
    expect(nextDomOutput).toMatchObject({
      kind: "dom",
      role: "input",
      label: "gain",
    });
    expect(nextDomOutput!.outputId).not.toBe(previousDomOutput!.outputId);
    expect(claimNotebookDomOutput(previousDomOutput!.outputId)).toBeNull();
    expect(claimNotebookDomOutput(nextDomOutput!.outputId)).toBeInstanceOf(
      FakeNode,
    );
  });

  test("loads configured runtime dependencies only when referenced by executed cells", async () => {
    const document = parseNotebookDocument(
      [
        ':::cell{#intro lang="ts"}',
        "```ts",
        'lapis.markdown("intro");',
        "```",
        ":::",
        "",
        ':::cell{#summary lang="ts"}',
        "```ts",
        "lapis.markdown(`Total: ${aq.sum([2, 3])}`);",
        "```",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Notebook.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async () => new ArrayBuffer(0),
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;
    const runtimeDependencyLoader = vi.fn(async () => ({
      sum: (values: number[]) =>
        values.reduce((total, value) => total + value, 0),
    }));

    const result = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
      {
        runtimeDependencies: [
          {
            packageName: "arquero",
            version: "8.0.0",
            globalName: "aq",
            resolver: { kind: "remote-esm" },
          },
        ],
        runtimeDependencyLoader,
      },
    );

    expect(runtimeDependencyLoader).toHaveBeenCalledTimes(1);
    expect(result.outputs.summary).toEqual([
      expect.objectContaining({ kind: "markdown", markdown: "Total: 5" }),
    ]);
  });

  test("supports static import syntax for locally installed packages", async () => {
    const document = parseNotebookDocument(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'import * as lodash from "lodash";',
        "lapis.markdown(`Total: ${lodash.sum([1, 2, 3])}`);",
        "```",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Notebook.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async () => new ArrayBuffer(0),
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;
    const moduleImportLoader = vi.fn(async (specifier: string) => {
      expect(specifier).toBe("https://esm.sh/lodash@4.17.21");
      return {
        sum(values: number[]) {
          return values.reduce((total, value) => total + value, 0);
        },
      };
    });

    const result = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
      {
        localPackageVersions: {
          lodash: "4.17.21",
        },
        moduleImportLoader,
      },
    );

    expect(moduleImportLoader).toHaveBeenCalledTimes(1);
    expect(result.outputs.load).toEqual([
      expect.objectContaining({ kind: "markdown", markdown: "Total: 6" }),
    ]);
  });

  test("supports static relative imports from sibling vault modules", async () => {
    const document = parseNotebookDocument(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'import { formatTotal } from "./helpers.js";',
        "lapis.markdown(formatTotal([1, 2, 3]));",
        "```",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Notebook Demo/Example.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const encoder = new TextEncoder();
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async (path: string, sourcePath?: string) => {
        if (
          path === "./helpers.js" &&
          sourcePath === "Notebook Demo/Example.notebook.md"
        ) {
          return cloneArrayBuffer(
            encoder.encode(
              [
                "export function formatTotal(values) {",
                "  return `Total: ${values.reduce((sum, value) => sum + value, 0)}`;",
                "}",
              ].join("\n"),
            ),
          );
        }

        throw new Error(`Unexpected vault read: ${path} (${sourcePath ?? ""})`);
      },
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;

    const result = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
    );

    expect(result.outputs.load).toEqual([
      expect.objectContaining({ kind: "markdown", markdown: "Total: 6" }),
    ]);
  });

  test("rejects relative imports that escape the vault root", async () => {
    const document = parseNotebookDocument(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'import { formatTotal } from "../helpers.js";',
        "lapis.markdown(formatTotal([1, 2, 3]));",
        "```",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Example.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async () => new ArrayBuffer(0),
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;

    const result = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
    );

    expect(result.outputs.load).toEqual([
      expect.objectContaining({
        kind: "error",
        message: expect.stringContaining(
          "Notebook relative import escapes the vault root",
        ),
      }),
    ]);
  });

  test("reloads notebook-local modules on later executions", async () => {
    const document = parseNotebookDocument(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'import { label } from "./helpers.js";',
        "lapis.markdown(label);",
        "```",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Notebook Demo/Example.notebook.md",
      },
    );
    const encoder = new TextEncoder();
    let helperLabel = "First import";
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async (path: string, sourcePath?: string) => {
        if (
          path === "./helpers.js" &&
          sourcePath === "Notebook Demo/Example.notebook.md"
        ) {
          return cloneArrayBuffer(
            encoder.encode(
              `export const label = ${JSON.stringify(helperLabel)};`,
            ),
          );
        }

        throw new Error(`Unexpected vault read: ${path} (${sourcePath ?? ""})`);
      },
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;

    const firstRun = await executeNotebookDocument(
      host,
      document,
      new NotebookSession(document),
      duckdbService,
    );

    helperLabel = "Updated import";

    const secondRun = await executeNotebookDocument(
      host,
      document,
      new NotebookSession(document),
      duckdbService,
    );

    expect(firstRun.outputs.load).toEqual([
      expect.objectContaining({ kind: "markdown", markdown: "First import" }),
    ]);
    expect(secondRun.outputs.load).toEqual([
      expect.objectContaining({ kind: "markdown", markdown: "Updated import" }),
    ]);
  });

  test("does not preload configured globals shadowed by static imports", async () => {
    const document = parseNotebookDocument(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'import * as lodash from "lodash";',
        "lapis.markdown(`Total: ${lodash.sum([1, 2, 3])}`);",
        "```",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Notebook.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async () => new ArrayBuffer(0),
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;
    const runtimeDependencyLoader = vi.fn(async () => {
      throw new Error("shadowed runtime dependency should not load");
    });
    const moduleImportLoader = vi.fn(async (specifier: string) => {
      expect(specifier).toBe("https://esm.sh/lodash@4.17.21");
      return {
        sum(values: number[]) {
          return values.reduce((total, value) => total + value, 0);
        },
      };
    });

    const result = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
      {
        runtimeDependencies: [
          {
            packageName: "@types/lodash",
            version: "4.17.24",
            globalName: "lodash",
            resolver: { kind: "remote-esm" },
          },
        ],
        runtimeDependencyLoader,
        localPackageVersions: {
          lodash: "4.17.21",
        },
        moduleImportLoader,
      },
    );

    expect(runtimeDependencyLoader).not.toHaveBeenCalled();
    expect(moduleImportLoader).toHaveBeenCalledTimes(1);
    expect(result.outputs.load).toEqual([
      expect.objectContaining({ kind: "markdown", markdown: "Total: 6" }),
    ]);
  });

  test("exposes vault-backed read helpers and FileAttachment", async () => {
    const document = parseNotebookDocument(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'const raw = await lapis.vault.readText("./data/config.json");',
        'const attachment = lapis.FileAttachment("./data/config.json");',
        "const parsed = await attachment.json();",
        "const bytes = await attachment.arrayBuffer();",
        "lapis.markdown(`${attachment.name}: ${parsed.label} (${bytes.byteLength}/${raw.length})`);",
        "```",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Notebook Demo/Example.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const encoded = new TextEncoder().encode(
      JSON.stringify({ label: "ready" }),
    );
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async (_path: string, _sourcePath?: string) =>
        cloneArrayBuffer(encoded),
    };
    const hostSpy = vi.spyOn(host, "readVaultFile");
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;

    const result = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
    );

    expect(hostSpy).toHaveBeenCalledWith(
      "./data/config.json",
      "Notebook Demo/Example.notebook.md",
    );
    expect(result.outputs.load).toEqual([
      expect.objectContaining({
        kind: "markdown",
        markdown: "config.json: ready (17/17)",
      }),
    ]);
  });

  test("supports Inputs.table with typed CSV attachments and preserves DSV column order", async () => {
    class FakeNode extends EventTarget {
      value: unknown;
    }
    vi.stubGlobal("Node", FakeNode);

    const document = parseNotebookDocument(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'const tableRows = await lapis.FileAttachment("./data/table.csv").csv({ typed: true });',
        'const selectedRow = view(Inputs.table(tableRows, { label: "CSV row", multiple: false, value: tableRows[0], rows: 4 }));',
        "lapis.markdown(`${selectedRow.name}: ${selectedRow.score}`);",
        "```",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Notebook Demo/Example.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const encoded = new TextEncoder().encode(
      ["name,region,score", "Ada,North,7", "Grace,West,9"].join("\n"),
    );
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async (_path: string, _sourcePath?: string) =>
        cloneArrayBuffer(encoded),
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;

    const result = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
    );

    expect(result.outputs.load).toEqual([
      {
        kind: "input",
        cellId: "load",
        variableName: "selectedRow",
        inputType: "table",
        value: { name: "Ada", region: "North", score: 7 },
        label: "CSV row",
        config: {
          label: "CSV row",
          multiple: false,
          rows: 4,
          data: Object.assign(
            [
              { name: "Ada", region: "North", score: 7 },
              { name: "Grace", region: "West", score: 9 },
            ],
            {
              columns: ["name", "region", "score"],
            },
          ),
        },
        reconstructable: true,
        source: {
          library: "@lapis-notes/notebook-input",
          factory: "table",
        },
      },
      expect.objectContaining({ kind: "markdown", markdown: "Ada: 7" }),
    ]);
    expect(result.values.selectedRow).toEqual({
      name: "Ada",
      region: "North",
      score: 7,
    });
  });

  test("exposes now and resolves invalidation on rerun and output clearing", async () => {
    delete (globalThis as { __lapisInvalidations?: number })
      .__lapisInvalidations;

    const document = parseNotebookDocument(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        "const observedNow = now;",
        "invalidation.then(() => {",
        "  globalThis.__lapisInvalidations = (globalThis.__lapisInvalidations ?? 0) + 1;",
        "});",
        "lapis.markdown(`Now: ${typeof now} ${observedNow > 0}`);",
        "```",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Notebook Demo/Lifecycle.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async () => new ArrayBuffer(0),
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;
    const testGlobal = globalThis as typeof globalThis & {
      __lapisInvalidations?: number;
    };

    const first = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
    );

    expect(first.outputs.load).toEqual([
      expect.objectContaining({
        kind: "markdown",
        markdown: "Now: number true",
      }),
    ]);
    expect(typeof first.values.observedNow).toBe("number");
    expect(testGlobal.__lapisInvalidations ?? 0).toBe(0);

    const second = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
      {
        cellIds: ["load"],
        skipDependencyClosure: true,
      },
    );

    await Promise.resolve();

    expect(typeof second.values.observedNow).toBe("number");
    expect(
      (second.values.observedNow as number) >=
        (first.values.observedNow as number),
    ).toBe(true);
    expect(testGlobal.__lapisInvalidations ?? 0).toBe(1);

    session.clearOutputs();
    await Promise.resolve();

    expect(testGlobal.__lapisInvalidations ?? 0).toBe(2);
  });

  test("exposes the bundled penguins sample dataset", async () => {
    const document = parseNotebookDocument(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'lapis.markdown(`${penguins.length}:${penguins[0]?.species ?? "Unknown"}`);',
        "```",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Notebook Demo/Penguins.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async () => new ArrayBuffer(0),
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;

    const result = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
    );

    expect(result.outputs.load).toEqual([
      expect.objectContaining({ kind: "markdown", markdown: "344:Adelie" }),
    ]);
  });

  test("exposes the upstream Observable sample dataset bundle", async () => {
    const document = parseNotebookDocument(
      [
        ':::cell{#load lang="ts"}',
        "```ts",
        'lapis.markdown(`${cars.length}:${cars[0]?.name ?? "Unknown"} ${weather.length}:${weather[0]?.weather ?? "Unknown"} ${miserables.nodes.length}:${miserables.links.length}`);',
        "```",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Notebook Demo/Sample Datasets.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async () => new ArrayBuffer(0),
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;

    const result = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
    );

    expect(result.outputs.load).toEqual([
      expect.objectContaining({
        kind: "markdown",
        markdown: "406:AMC Ambassador Brougham 2922:drizzle 77:254",
      }),
    ]);
  });

  test("lazily exposes bundled visualization helpers under lapis and bare globals", async () => {
    const document = parseNotebookDocument(
      [
        ':::cell{#chart lang="ts"}',
        "```ts",
        "const scale = d3.scaleLinear([0, 10], [0, 100]);",
        "const domain = lapis.d3.extent([3, 7, 11]);",
        'lapis.markdown(`Scale: ${scale(5)} Domain: ${domain.join("-")} Plot: ${typeof Plot.plot}/${typeof lapis.Plot.plot}`);',
        "```",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Visuals.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async () => new ArrayBuffer(0),
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;

    const result = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
    );

    expect(result.outputs.chart).toEqual([
      expect.objectContaining({
        kind: "markdown",
        markdown: "Scale: 50 Domain: 3-11 Plot: function/function",
      }),
    ]);
  });

  test("exposes bundled visualization globals without source-triggered identifier scanning", async () => {
    const document = parseNotebookDocument(
      [
        ':::cell{#chart lang="ts"}',
        "```ts",
        'const scale = eval(["d", "3.scaleLinear([0, 10], [0, 100])"].join(""));',
        'const plot = eval(["P", "lot.plot"].join(""));',
        "lapis.markdown(`Scale: ${scale(5)} Plot: ${typeof plot}`);",
        "```",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Visuals.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async () => new ArrayBuffer(0),
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;

    const result = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
    );

    expect(result.outputs.chart).toEqual([
      expect.objectContaining({
        kind: "markdown",
        markdown: "Scale: 50 Plot: function",
      }),
    ]);
  });

  test("exposes stdlib Promises and Generators namespaces by default", async () => {
    const document = parseNotebookDocument(
      [
        ':::cell{#helpers lang="ts"}',
        "```ts",
        "const values = Array.from(Generators.filter(Generators.map(Generators.range(0, 6), (value) => value + 1), (value) => value % 2 === 0));",
        'const delayed = await Promises.delay(0, values.join(","));',
        "lapis.markdown(`${delayed} ${typeof lapis.Generators.range}/${typeof lapis.Promises.delay}`);",
        "```",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Helpers.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async () => new ArrayBuffer(0),
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;

    const result = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
    );

    expect(result.outputs.helpers).toEqual([
      expect.objectContaining({
        kind: "markdown",
        markdown: "2,4,6 function/function",
      }),
    ]);
  });

  test("exposes stdlib DOM namespace by default", async () => {
    const document = parseNotebookDocument(
      [
        ':::cell{#helpers lang="ts"}',
        "```ts",
        'const marker = DOM.uid("chart");',
        "lapis.markdown(`${marker.id} ${typeof DOM.download}/${typeof lapis.DOM.uid}`);",
        "```",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Helpers.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async () => new ArrayBuffer(0),
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;

    const result = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
    );

    expect(result.outputs.helpers).toEqual([
      expect.objectContaining({
        kind: "markdown",
        markdown: expect.stringMatching(/^O-chart-\d+ function\/function$/),
      }),
    ]);
  });
});

function encodeNotebookText(value: string): ArrayBuffer {
  const bytes = new TextEncoder().encode(value);
  return cloneArrayBuffer(bytes);
}

function cloneArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

describe("sql table metadata", () => {
  test("attaches query schema metadata to sql table outputs", async () => {
    const document = parseNotebookDocument(
      [
        "---",
        "notebook:",
        "  version: 1",
        "---",
        "",
        ':::cell{#query lang="sql"}',
        "SELECT path, size FROM lapis.notes LIMIT 2",
        ":::",
      ].join("\n"),
      {
        sourcePath: "Notebook.notebook.md",
      },
    );
    const session = new NotebookSession(document);
    const host: NotebookExecutionHost = {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async () => new ArrayBuffer(0),
    };
    const duckdbService = {
      ensureAppTables: async (register: () => Promise<void>) => register(),
      query: async () => [],
      queryWithMeta: async (sql: string) => ({
        rows: [
          { path: "Notes/A.md", size: 12 },
          { path: "Notes/B.md", size: 5 },
        ],
        columns: ["path", "size"],
        columnMeta: [
          {
            key: "path",
            label: "path",
            type: "string",
            displayType: "VARCHAR",
            nullable: true,
          },
          {
            key: "size",
            label: "size",
            type: "number",
            displayType: "INTEGER",
            nullable: true,
          },
        ],
        schema: {
          rowCount: 2,
          queryTimeMs: 7,
          sourceSql: sql,
        },
      }),
      registerJsonTable: async () => {},
      registerFileBuffer: async () => {},
    } as any;

    const result = await executeNotebookDocument(
      host,
      document,
      session,
      duckdbService,
    );

    expect(result.outputs.query).toEqual([
      {
        kind: "table",
        columns: ["path", "size"],
        rows: [
          ["Notes/A.md", 12],
          ["Notes/B.md", 5],
        ],
        columnMeta: [
          {
            key: "path",
            label: "path",
            type: "string",
            displayType: "VARCHAR",
            nullable: true,
          },
          {
            key: "size",
            label: "size",
            type: "number",
            displayType: "INTEGER",
            nullable: true,
          },
        ],
        schema: {
          rowCount: 2,
          queryTimeMs: 7,
          sourceSql: "SELECT path, size FROM lapis.notes LIMIT 2",
        },
      },
    ]);
  });
});

test("retains live structured input owners after execution, including callback buttons", async () => {
  class FakeNode extends EventTarget {}
  vi.stubGlobal("Node", FakeNode);
  const { claimNotebookInputDomOutput, clearNotebookDomOutputsForSource } =
    await import("../notebook-dom-registry");
  const document = parseNotebookDocument(
    ':::cell{#controls lang="js"}\n```js\nconst count = view(Inputs.button("Increment", { reduce: value => value + 1 }));\n```\n:::',
    {
      sourcePath: "Callback.notebook.md",
      frontmatter: { version: 1, mode: "lazy" },
    },
  );
  try {
    const session = new NotebookSession(document);
    await executeNotebookDocument(
      {
        getAppTablesSnapshot: async () => ({
          notes: [],
          links: [],
          searchDocuments: [],
        }),
        readVaultFile: async () => new ArrayBuffer(0),
      },
      document,
      session,
    );
    expect(
      claimNotebookInputDomOutput(document.sourcePath, "controls", "count"),
    ).toBeInstanceOf(FakeNode);
  } finally {
    clearNotebookDomOutputsForSource(document.sourcePath!);
    vi.unstubAllGlobals();
  }
});

test("ordinary reruns preserve the search query as well as its matching row value", async () => {
  class FakeNode extends EventTarget {}
  vi.stubGlobal("Node", FakeNode);
  const { claimNotebookInputDomOutput, clearNotebookDomOutputsForSource } =
    await import("../notebook-dom-registry");
  const { getExtraInputModel } = await import(
    "../../../../packages/input/src/extra-model"
  );
  const document = parseNotebookDocument(
    ':::cell{#search lang="js"}\n```js\nconst matches = view(Inputs.search(["Ada", "Grace"], { query: "Ada" }));\n```\n:::',
    {
      sourcePath: "Search.notebook.md",
      frontmatter: { version: 1, mode: "lazy" },
    },
  );
  const session = new NotebookSession(document);
  const host = {
    getAppTablesSnapshot: async () => ({
      notes: [],
      links: [],
      searchDocuments: [],
    }),
    readVaultFile: async () => new ArrayBuffer(0),
  };
  try {
    await executeNotebookDocument(host, document, session);
    getExtraInputModel(
      claimNotebookInputDomOutput(document.sourcePath, "search", "matches")!,
    )!.setQuery("Grace");
    await executeNotebookDocument(host, document, session);
    const restored = claimNotebookInputDomOutput(
      document.sourcePath,
      "search",
      "matches",
    ) as Node & { query: string; value: unknown };
    expect(restored.query).toBe("Grace");
    expect(restored.value).toEqual(["Grace"]);
  } finally {
    clearNotebookDomOutputsForSource(document.sourcePath!);
    vi.unstubAllGlobals();
  }
});

test("dependent cells read input changes made while another cell awaits a promise", async () => {
  let release!: () => void;
  vi.stubGlobal(
    "__inputGate",
    new Promise<void>((resolve) => (release = resolve)),
  );
  const document = parseNotebookDocument(
    [
      ':::cell{#input lang="js"}\n```js\nconst counter = 0;\n```\n:::',
      ':::cell{#slow lang="js"}\n```js\nawait __inputGate;\n```\n:::',
      ':::cell{#value lang="js"}\n```js\ndisplay(counter);\n```\n:::',
    ].join("\n"),
    { sourcePath: "Reactive.notebook.md" },
  );
  const session = new NotebookSession(document);
  const host: NotebookExecutionHost = {
    getAppTablesSnapshot: async () => ({
      notes: [],
      links: [],
      searchDocuments: [],
    }),
    readVaultFile: async () => new ArrayBuffer(0),
  };
  const pending = executeNotebookDocument(host, document, session);
  try {
    await vi.waitFor(() =>
      expect(session.getCellState("slow").state).toBe("running"),
    );
    session.setInputValue("input", "counter", 7);
    release();
    const result = await pending;
    expect(result.outputs.value).toEqual([
      { kind: "code", language: "javascript", code: "7" },
    ]);
    expect(result.values.counter).toBe(7);
  } finally {
    release();
    await pending;
    vi.unstubAllGlobals();
  }
});

test("a running input cell cannot overwrite a newer control value on completion", async () => {
  class FakeNode extends EventTarget {}
  vi.stubGlobal("Node", FakeNode);
  let release!: () => void;
  vi.stubGlobal(
    "__ownInputGate",
    new Promise<void>((resolve) => (release = resolve)),
  );
  const { claimNotebookInputDomOutput, clearNotebookDomOutputsForSource } =
    await import("../notebook-dom-registry");
  const { getExtraInputModel } = await import(
    "../../../../packages/input/src/extra-model"
  );
  const document = parseNotebookDocument(
    ':::cell{#input lang="js"}\n```js\nconst counter = view(Inputs.button("Click"));\nawait __ownInputGate;\n```\n:::\n:::cell{#value lang="js"}\n```js\ndisplay(counter);\n```\n:::',
    { sourcePath: "Running-input.notebook.md" },
  );
  const session = new NotebookSession(document);
  const pending = executeNotebookDocument(
    {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async () => new ArrayBuffer(0),
    },
    document,
    session,
  );
  try {
    await vi.waitFor(() =>
      expect(
        claimNotebookInputDomOutput(document.sourcePath, "input", "counter"),
      ).toBeTruthy(),
    );
    getExtraInputModel(
      claimNotebookInputDomOutput(document.sourcePath, "input", "counter")!,
    )!.activate(0);
    release();
    const result = await pending;
    expect(result.values.counter).toBe(1);
    expect(result.outputs.value).toEqual([
      { kind: "code", language: "javascript", code: "1" },
    ]);
  } finally {
    release();
    await pending;
    clearNotebookDomOutputsForSource(document.sourcePath!);
    vi.unstubAllGlobals();
  }
});

test("display publishes while its cell is awaiting a promise without completing it", async () => {
  let release!: () => void;
  vi.stubGlobal(
    "__displayGate",
    new Promise<void>((resolve) => (release = resolve)),
  );
  const document = parseNotebookDocument(
    ':::cell{#value lang="js"}\n```js\ndisplay("ready");\nawait __displayGate;\ndisplay("done");\n```\n:::',
    { sourcePath: "Streaming.notebook.md" },
  );
  const session = new NotebookSession(document);
  const progress: any[] = [];
  const pending = executeNotebookDocument(
    {
      getAppTablesSnapshot: async () => ({
        notes: [],
        links: [],
        searchDocuments: [],
      }),
      readVaultFile: async () => new ArrayBuffer(0),
    },
    document,
    session,
    undefined,
    {},
    (event) => progress.push(event),
  );
  try {
    await vi.waitFor(() =>
      expect(session.getCellState("value").output).toEqual([
        { kind: "text", text: "ready" },
      ]),
    );
    expect(session.getCellState("value").state).toBe("running");
    expect(session.getExecutionState().completedCellIds).toEqual([]);
    expect(progress.some((event) => event.type === "cell-output")).toBe(true);
  } finally {
    release();
    await pending;
    vi.unstubAllGlobals();
  }
});

test("late display callbacks cannot mutate completed cell outputs", async () => {
  let late!: () => void;
  vi.stubGlobal(
    "__captureDisplay",
    (callback: () => void) => (late = callback),
  );
  const document = parseNotebookDocument(
    ':::cell{#value lang="js"}\n```js\n__captureDisplay(() => display("late"));\ndisplay("done");\n```\n:::',
    { sourcePath: "Late-display.notebook.md" },
  );
  const session = new NotebookSession(document);
  try {
    await executeNotebookDocument(
      {
        getAppTablesSnapshot: async () => ({
          notes: [],
          links: [],
          searchDocuments: [],
        }),
        readVaultFile: async () => new ArrayBuffer(0),
      },
      document,
      session,
    );
    late();
    expect(session.getCellState("value").output).toEqual([
      { kind: "text", text: "done" },
    ]);
  } finally {
    vi.unstubAllGlobals();
  }
});
