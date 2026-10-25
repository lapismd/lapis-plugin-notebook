import { describe, expect, test } from "vitest";
import {
  createNotebookFileAttachment,
  createNotebookVaultRuntime,
  DOCUMENTED_BARE_NOTEBOOK_GLOBALS,
  LAPIS_BUILTIN_NAMES,
  cellUsesDuckDbRuntime,
  hasD3RuntimeReference,
  hasDomRuntimeReference,
  hasLiveDomRuntimeReference,
  hasPlotRuntimeReference,
  resolveNotebookFilePath,
  validateNotebookGlobalName,
} from "..";

describe("notebook stdlib builtins", () => {
  test("tracks current lapis and bare builtin names", () => {
    expect(LAPIS_BUILTIN_NAMES).toContain("duckdb");
    expect(LAPIS_BUILTIN_NAMES).toContain("vault");
    expect(LAPIS_BUILTIN_NAMES).toContain("FileAttachment");
    expect(LAPIS_BUILTIN_NAMES).toContain("d3");
    expect(LAPIS_BUILTIN_NAMES).toContain("Plot");
    expect(LAPIS_BUILTIN_NAMES).toContain("DOM");
    expect(LAPIS_BUILTIN_NAMES).toContain("Generators");
    expect(LAPIS_BUILTIN_NAMES).toContain("Promises");
    expect(LAPIS_BUILTIN_NAMES).toContain("Inputs");
    expect(DOCUMENTED_BARE_NOTEBOOK_GLOBALS).toEqual([
      "aapl",
      "alphabet",
      "cars",
      "citywages",
      "diamonds",
      "Inputs",
      "html",
      "md",
      "tex",
      "svg",
      "d3",
      "Plot",
      "DOM",
      "flare",
      "Generators",
      "industries",
      "invalidation",
      "miserables",
      "now",
      "olympians",
      "penguins",
      "pizza",
      "Promises",
      "weather",
    ]);
  });

  test("validates dependency globals against reserved builtin names", () => {
    expect(validateNotebookGlobalName("aq")).toEqual({ ok: true });
    expect(validateNotebookGlobalName("lapis")).toMatchObject({
      ok: false,
      reason: "reserved",
    });
    expect(validateNotebookGlobalName("html")).toMatchObject({
      ok: false,
      reason: "reserved",
    });
    expect(validateNotebookGlobalName("md")).toMatchObject({
      ok: false,
      reason: "reserved",
    });
    expect(validateNotebookGlobalName("tex")).toMatchObject({
      ok: false,
      reason: "reserved",
    });
    expect(validateNotebookGlobalName("d3")).toMatchObject({
      ok: false,
      reason: "reserved",
    });
    expect(validateNotebookGlobalName("Plot")).toMatchObject({
      ok: false,
      reason: "reserved",
    });
    expect(validateNotebookGlobalName("DOM")).toMatchObject({
      ok: false,
      reason: "reserved",
    });
    expect(validateNotebookGlobalName("Generators")).toMatchObject({
      ok: false,
      reason: "reserved",
    });
    expect(validateNotebookGlobalName("Promises")).toMatchObject({
      ok: false,
      reason: "reserved",
    });
    expect(validateNotebookGlobalName("not-valid")).toMatchObject({
      ok: false,
      reason: "invalid-identifier",
    });
    expect(validateNotebookGlobalName("aq", ["aq"])).toMatchObject({
      ok: false,
      reason: "duplicate",
    });
  });

  test("detects current runtime feature references", () => {
    expect(cellUsesDuckDbRuntime({ lang: "sql", source: "SELECT 1" })).toBe(
      true,
    );
    expect(
      cellUsesDuckDbRuntime({
        lang: "ts",
        source: "await lapis.duckdb.query('SELECT 1')",
      }),
    ).toBe(true);
    expect(
      cellUsesDuckDbRuntime({ lang: "ts", source: "lapis.table([])" }),
    ).toBe(false);
    expect(hasDomRuntimeReference("viewof gain = Inputs.range([0, 10])")).toBe(
      true,
    );
    expect(
      hasDomRuntimeReference("return lapis.html`<strong>${value}</strong>`"),
    ).toBe(true);
    expect(hasDomRuntimeReference("const marker = DOM.uid('plot')")).toBe(true);
    expect(hasDomRuntimeReference("const marker = lapis.DOM.uid('plot')")).toBe(
      true,
    );
    expect(hasLiveDomRuntimeReference("const marker = DOM.uid('plot')")).toBe(
      false,
    );
    expect(
      hasLiveDomRuntimeReference("const marker = lapis.DOM.uid('plot')"),
    ).toBe(false);
    expect(hasLiveDomRuntimeReference("DOM.download(() => new Blob())")).toBe(
      true,
    );
    expect(
      hasDomRuntimeReference('lapis.html("<strong>static</strong>")'),
    ).toBe(false);
    expect(hasD3RuntimeReference("const scale = d3.scaleLinear()")).toBe(true);
    expect(hasD3RuntimeReference("lapis.d3.extent(values)")).toBe(true);
    expect(hasPlotRuntimeReference("return Plot.plot({ marks: [] })")).toBe(
      true,
    );
    expect(
      hasPlotRuntimeReference("return lapis.Plot.plot({ marks: [] })"),
    ).toBe(true);
    expect(hasDomRuntimeReference("return Plot.plot({ marks: [] })")).toBe(
      true,
    );
    expect(hasLiveDomRuntimeReference("return Plot.plot({ marks: [] })")).toBe(
      true,
    );
  });

  test("normalizes notebook-relative file paths", () => {
    expect(
      resolveNotebookFilePath("/Data/sales.csv", "Notes/Report.notebook.md"),
    ).toBe("Data/sales.csv");
    expect(
      resolveNotebookFilePath("./assets/sales.csv", "Notes/Report.notebook.md"),
    ).toBe("Notes/assets/sales.csv");
    expect(
      resolveNotebookFilePath(
        "../Data/sales.csv",
        "Notes/Reports/Report.notebook.md",
      ),
    ).toBe("Notes/Data/sales.csv");
    expect(resolveNotebookFilePath("Data/./sales.csv")).toBe("Data/sales.csv");
  });

  test("creates vault-backed file attachments", async () => {
    const encoded = new TextEncoder().encode(
      JSON.stringify({ label: "ready" }),
    );
    const readVaultFile = async (_path: string, _sourcePath?: string) =>
      encoded.buffer.slice(0);
    const vaultRuntime = createNotebookVaultRuntime(
      readVaultFile,
      "Notebook Demo/Example.notebook.md",
    );
    const attachment = createNotebookFileAttachment(
      "./data/config.json",
      vaultRuntime,
    );

    await expect(attachment.text()).resolves.toBe('{"label":"ready"}');
    await expect(attachment.json()).resolves.toEqual({ label: "ready" });
    await expect(attachment.arrayBuffer()).resolves.toBeInstanceOf(ArrayBuffer);
    expect(attachment.name).toBe("config.json");
    expect(attachment.path).toBe("./data/config.json");
  });
});
