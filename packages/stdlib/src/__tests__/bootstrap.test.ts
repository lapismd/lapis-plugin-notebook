import { describe, expect, test, vi } from "vitest";
import { createNotebookStdlibRuntime, createNotebookVaultRuntime } from "..";

describe("notebook stdlib bootstrap", () => {
  test("creates canonical lapis bindings and bundled bare globals", async () => {
    const outputs: string[] = [];
    const readVaultFile = vi.fn(async () =>
      new TextEncoder().encode('{"label":"ready"}').buffer.slice(0),
    );
    const runtime = await createNotebookStdlibRuntime({
      outputs: {
        text: (value) => `text:${value}`,
        markdown: (value) => `markdown:${value}`,
        html: (value) => `html:${value}`,
        table: (...args) => `table:${args.length}`,
        chart: (...args) => `chart:${args.length}`,
        image: (mime, data) => `image:${mime}:${data}`,
        error: (message) => `error:${message}`,
      },
      appendOutput: (output) => outputs.push(output),
      vault: createNotebookVaultRuntime(readVaultFile, "Notebook.notebook.md"),
      duckdb: { query: vi.fn(), registerVaultFile: vi.fn() },
      loadD3: async () => ({ scaleLinear: () => "d3" }),
      loadPlot: async () => ({ plot: () => "plot" }),
    });

    expect(runtime.bareGlobals.d3).toEqual({
      scaleLinear: expect.any(Function),
    });
    expect(runtime.bareGlobals.md).toBeInstanceOf(Function);
    expect(runtime.bareGlobals.tex).toBeInstanceOf(Function);
    expect(runtime.bareGlobals.Plot).toEqual({ plot: expect.any(Function) });
    expect(runtime.bareGlobals.DOM.uid).toBeInstanceOf(Function);
    expect(runtime.bareGlobals.Generators.range).toBeInstanceOf(Function);
    expect(runtime.bareGlobals.Promises.delay).toBeInstanceOf(Function);
    expect(runtime.lapis.DOM).toBe(runtime.bareGlobals.DOM);
    expect((runtime.lapis.markdown as (value: string) => string)("ready")).toBe(
      "markdown:ready",
    );
    expect(outputs).toEqual(["markdown:ready"]);

    expect(
      (runtime.bareGlobals.md as (
        strings: TemplateStringsArray,
        ...values: unknown[]
      ) => string)`# ${"Title"}`,
    ).toBe("markdown:# Title");
    expect(
      (runtime.bareGlobals.tex as (
        strings: TemplateStringsArray,
      ) => string)`x^2`,
    ).toBe("markdown:$x^2$");
    expect(
      (runtime.bareGlobals.tex.block as (
        strings: TemplateStringsArray,
      ) => string)`x^2`,
    ).toBe("markdown:$$\nx^2\n$$");
    expect(outputs.slice(1)).toEqual([
      "markdown:# Title",
      "markdown:$x^2$",
      "markdown:$$\nx^2\n$$",
    ]);

    const attachment = (
      runtime.lapis.FileAttachment as (path: string) => {
        json: () => Promise<unknown>;
      }
    )("./data/config.json");
    await expect(attachment.json()).resolves.toEqual({ label: "ready" });
    expect(readVaultFile).toHaveBeenCalledWith(
      "./data/config.json",
      "Notebook.notebook.md",
    );
  });

  test("skips visualization module loading when globals are not requested", async () => {
    const loadD3 = vi.fn(async () => ({ scaleLinear: () => "d3" }));
    const loadPlot = vi.fn(async () => ({ plot: () => "plot" }));

    const runtime = await createNotebookStdlibRuntime({
      outputs: {
        text: (value) => `text:${value}`,
        markdown: (value) => `markdown:${value}`,
        html: (value) => `html:${value}`,
        table: (...args) => `table:${args.length}`,
        chart: (...args) => `chart:${args.length}`,
        image: (mime, data) => `image:${mime}:${data}`,
        error: (message) => `error:${message}`,
      },
      appendOutput: () => {},
      vault: createNotebookVaultRuntime(
        async () => new ArrayBuffer(0),
        "Notebook.notebook.md",
      ),
      duckdb: { query: vi.fn(), registerVaultFile: vi.fn() },
      loadD3,
      loadPlot,
      visualizationGlobals: {
        Plot: false,
      },
    });

    expect(loadD3).toHaveBeenCalledTimes(1);
    expect(loadPlot).not.toHaveBeenCalled();
    expect(runtime.bareGlobals.d3).toEqual({
      scaleLinear: expect.any(Function),
    });
    expect(runtime.bareGlobals.Plot).toBeUndefined();
  });
});
