import {
  createNotebookFileAttachment,
  type NotebookVaultRuntime,
} from "./files";
import { DOM } from "./dom";
import { Generators } from "./generators";
import { Promises } from "./promises";
import aapl from "./sample-datasets/aapl.json";
import alphabet from "./sample-datasets/alphabet.json";
import cars from "./sample-datasets/cars.json";
import citywages from "./sample-datasets/citywages.json";
import diamonds from "./sample-datasets/diamonds.json";
import flare from "./sample-datasets/flare.json";
import industries from "./sample-datasets/industries.json";
import miserables from "./sample-datasets/miserables.json";
import olympians from "./sample-datasets/olympians.json";
import penguins from "./sample-datasets/penguins.json";
import pizza from "./sample-datasets/pizza.json";
import weather from "./sample-datasets/weather.json";

export interface NotebookStdlibOutputApi<TOutput> {
  text(value: string): TOutput;
  markdown(value: string): TOutput;
  html(value: string): TOutput;
  table(...args: unknown[]): TOutput;
  chart(...args: unknown[]): TOutput;
  image(mime: string, data: string): TOutput;
  error(message: string, options?: { stack?: string }): TOutput;
}

export interface CreateNotebookStdlibRuntimeOptions<TOutput> {
  outputs: NotebookStdlibOutputApi<TOutput>;
  appendOutput: (output: TOutput) => void;
  vault: NotebookVaultRuntime;
  duckdb: unknown;
  now?: number;
  invalidation?: Promise<void>;
  loadD3?: () => Promise<unknown>;
  loadPlot?: () => Promise<unknown>;
  visualizationGlobals?: {
    Plot?: boolean;
  };
}

export interface NotebookStdlibRuntime<TOutput> {
  lapis: Record<string, unknown>;
  bareGlobals: {
    aapl: typeof aapl;
    alphabet: typeof alphabet;
    cars: typeof cars;
    citywages: typeof citywages;
    diamonds: typeof diamonds;
    DOM: typeof DOM;
    flare: typeof flare;
    Generators: typeof Generators;
    industries: typeof industries;
    d3: unknown;
    invalidation: Promise<void>;
    md: NotebookMarkdownTemplateHelper<TOutput>;
    miserables: typeof miserables;
    now: number;
    olympians: typeof olympians;
    penguins: typeof penguins;
    pizza: typeof pizza;
    Plot: unknown;
    Promises: typeof Promises;
    tex: NotebookTexTemplateHelper<TOutput>;
    weather: typeof weather;
  };
}

export type NotebookMarkdownTemplateHelper<TOutput> = (
  value: string | TemplateStringsArray,
  ...values: unknown[]
) => TOutput;

export type NotebookTexTemplateHelper<TOutput> =
  NotebookMarkdownTemplateHelper<TOutput> & {
    block: NotebookMarkdownTemplateHelper<TOutput>;
  };

let d3Module: Promise<unknown> | null = null;
let plotModule: Promise<unknown> | null = null;

export async function createNotebookStdlibRuntime<TOutput>(
  options: CreateNotebookStdlibRuntimeOptions<TOutput>,
): Promise<NotebookStdlibRuntime<TOutput>> {
  const loadD3 = options.loadD3 ?? loadNotebookStdlibD3;
  const loadPlot = options.loadPlot ?? loadNotebookStdlibPlot;
  const shouldLoadPlot = options.visualizationGlobals?.Plot ?? true;
  const [d3, Plot] = await Promise.all([
    loadD3(),
    shouldLoadPlot ? loadPlot() : Promise.resolve(undefined),
  ]);
  const now = options.now ?? Date.now();
  const invalidation = options.invalidation ?? new Promise<void>(() => {});
  const md = createMarkdownTemplateHelper(options);
  const tex = createTexTemplateHelper(options);

  const lapisRuntime: Record<string, unknown> = {
    aapl,
    alphabet,
    cars,
    citywages,
    diamonds,
    text(value: string) {
      const output = options.outputs.text(value);
      options.appendOutput(output);
      return output;
    },
    markdown(value: string) {
      const output = options.outputs.markdown(value);
      options.appendOutput(output);
      return output;
    },
    md,
    html(value: string) {
      const output = options.outputs.html(value);
      options.appendOutput(output);
      return output;
    },
    table(...args: unknown[]) {
      const output = options.outputs.table(...args);
      options.appendOutput(output);
      return output;
    },
    chart(...args: unknown[]) {
      const output = options.outputs.chart(...args);
      options.appendOutput(output);
      return output;
    },
    image(mime: string, data: string) {
      const output = options.outputs.image(mime, data);
      options.appendOutput(output);
      return output;
    },
    error(message: string, runtimeOptions?: { stack?: string }) {
      const output = options.outputs.error(message, runtimeOptions);
      options.appendOutput(output);
      return output;
    },
    duckdb: options.duckdb,
    vault: options.vault,
    FileAttachment(path: string) {
      return createNotebookFileAttachment(path, options.vault);
    },
    DOM,
    flare,
    Generators,
    industries,
    invalidation,
    miserables,
    now,
    olympians,
    penguins,
    pizza,
    Promises,
    tex,
    weather,
    d3,
    Plot,
  };

  return {
    lapis: lapisRuntime,
    bareGlobals: {
      aapl,
      alphabet,
      cars,
      citywages,
      diamonds,
      d3,
      DOM,
      flare,
      Generators,
      industries,
      invalidation,
      md,
      miserables,
      now,
      olympians,
      penguins,
      pizza,
      Plot,
      Promises,
      tex,
      weather,
    },
  };
}

function createMarkdownTemplateHelper<TOutput>(
  options: CreateNotebookStdlibRuntimeOptions<TOutput>,
): NotebookMarkdownTemplateHelper<TOutput> {
  return (value, ...values) => {
    const output = options.outputs.markdown(renderTemplate(value, values));
    options.appendOutput(output);
    return output;
  };
}

function createTexTemplateHelper<TOutput>(
  options: CreateNotebookStdlibRuntimeOptions<TOutput>,
): NotebookTexTemplateHelper<TOutput> {
  const inline = ((
    value: string | TemplateStringsArray,
    ...values: unknown[]
  ) => {
    const output = options.outputs.markdown(
      `$${renderTemplate(value, values)}$`,
    );
    options.appendOutput(output);
    return output;
  }) as NotebookTexTemplateHelper<TOutput>;
  inline.block = (value, ...values) => {
    const output = options.outputs.markdown(
      `$$\n${renderTemplate(value, values)}\n$$`,
    );
    options.appendOutput(output);
    return output;
  };
  return inline;
}

function renderTemplate(
  value: string | TemplateStringsArray,
  values: readonly unknown[],
): string {
  if (!isTemplateStringsArray(value)) {
    return String(value);
  }

  return value.reduce((rendered, chunk, index) => {
    const nextValue = index < values.length ? String(values[index]) : "";
    return `${rendered}${chunk}${nextValue}`;
  }, "");
}

function isTemplateStringsArray(
  value: string | TemplateStringsArray,
): value is TemplateStringsArray {
  return Array.isArray(value) && "raw" in value;
}

export async function loadNotebookStdlibD3(): Promise<unknown> {
  d3Module ??= import("d3");
  return d3Module;
}

export async function loadNotebookStdlibPlot(): Promise<unknown> {
  plotModule ??= import("@observablehq/plot");
  return plotModule;
}
