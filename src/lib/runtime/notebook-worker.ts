import { notebookInputHostContext } from "./notebook-execution-host";
import { formatNotebookDisplayValue } from "./notebook-display-value";
import {
  awaitNotebookTask,
  throwIfNotebookAborted,
} from "./notebook-cancellation";
import {
  createNotebookStdlibRuntime,
  createNotebookVaultRuntime,
  cellUsesDuckDbRuntime,
  hasDomRuntimeReference,
  hasLiveDomRuntimeReference,
  loadNotebookRuntimeDependency,
  loadReferencedNotebookDependencyGlobals,
  resolveNotebookFilePath,
  resolveRuntimeDependencySpecifier,
  type NotebookStdlibOutputApi,
  type NormalizedNotebookUserDependencyDescriptor,
  type NotebookRuntimeModuleLoader,
} from "@lapis-notes/notebook-stdlib";
import {
  createNotebookViewRuntime,
  snapshotNotebookInputState,
  isNotebookDomNode,
  isTemplateStringsArray,
  loadNotebookDomRuntime,
  transformObservableViewof,
} from "@lapis-notes/notebook-input";
import type { NotebookDocument } from "../model/notebook-document";
import { lapis, type NotebookOutput } from "../output";
import type {
  NotebookDuckDbRuntime,
  NotebookDuckDbRuntimeProvider,
} from "@lapis-notes/notebook-duckdb";
import type {
  NotebookExecutionOptions as CoreNotebookExecutionOptions,
  NotebookExecutionResult,
  NotebookJavaScriptLikeCompileProvider,
  NotebookRuntimeDependencyLoader as CoreNotebookRuntimeDependencyLoader,
} from "@lapis-notes/notebook-core";
import { registerAppTablesSnapshot } from "./duckdb/register-app-tables";
import { registerVaultFile } from "./duckdb/register-vault-file";
import type { NotebookExecutionHost } from "./notebook-execution-host";
import { collectDependencyClosure } from "./notebook-graph";
import {
  clearNotebookDomOutputsForCell,
  notebookInputDomOutputId,
  claimNotebookInputDomOutput,
  createNotebookDomOutputId,
  emitNotebookInputChange,
  registerNotebookDomOutput,
} from "./notebook-dom-registry";
import { interpolateNotebookExpressions } from "./interpolation";
import type {
  NotebookExecutionProgressEvent,
  NotebookSession,
} from "./notebook-session";

export type { NotebookExecutionResult } from "@lapis-notes/notebook-core";
export type NotebookRuntimeDependencyLoader =
  CoreNotebookRuntimeDependencyLoader<NormalizedNotebookUserDependencyDescriptor>;
export type NotebookExecutionOptions =
  CoreNotebookExecutionOptions<NormalizedNotebookUserDependencyDescriptor> & {
    signal?: AbortSignal;
    localPackageVersions?: Record<string, string>;
    moduleImportLoader?: NotebookRuntimeModuleLoader;
  };

type CompiledJavaScriptLikeSource = {
  code: string;
  importedBindings: ReadonlySet<string>;
};

type NotebookLocalModuleExports = Record<string, unknown>;
type NotebookLocalModuleCache = Map<
  string,
  Promise<NotebookLocalModuleExports>
>;

let typescriptModule: Promise<typeof import("typescript")> | null = null;

const STATIC_MODULE_SYNTAX_RE = /(^|[\r\n])\s*(import|export)\b/m;
const NOTEBOOK_LOCAL_MODULE_EXT_RE = /\.(?:m?js)$/i;
const URL_IMPORT_RE = /^(?:https?:|data:|blob:)/i;

export async function executeNotebookDocument(
  host: NotebookExecutionHost,
  document: NotebookDocument,
  session: NotebookSession,
  duckdbProvider?: NotebookDuckDbRuntimeProvider,
  options: NotebookExecutionOptions = {},
  reportProgress?: (event: NotebookExecutionProgressEvent) => void,
): Promise<NotebookExecutionResult> {
  throwIfNotebookAborted(options.signal);
  const values: Record<string, unknown> = session.getRuntimeValues();
  const outputs: Record<string, NotebookOutput[]> = {};
  const localModuleCache: NotebookLocalModuleCache = new Map();
  const executionOrder = resolveExecutionOrder(document, session, options);
  const executionHost = options.fileReaderProvider
    ? {
        ...host,
        readVaultFile: options.fileReaderProvider,
      }
    : host;

  if (executionOrder.length === 0) {
    return { outputs, values };
  }

  const firstCellId = executionOrder[0];
  const initialStatus = describeExecutionStart(executionOrder.length);
  session.beginExecution(executionOrder, initialStatus);
  reportProgress?.({
    type: "execution-started",
    cellIds: executionOrder,
    statusMessage: initialStatus,
  });

  let firstCellAlreadyRunning = false;
  if (firstCellId) {
    const firstCellStatus = `Preparing ${firstCellId}`;
    session.markRunning(firstCellId, firstCellStatus);
    reportProgress?.({
      type: "cell-running",
      cellId: firstCellId,
      statusMessage: firstCellStatus,
    });
    firstCellAlreadyRunning = true;
  }

  if (requiresDuckDb(document, executionOrder) && firstCellId) {
    const duckdbService = await resolveDuckDbService(duckdbProvider);
    const phaseKey = `duckdb:setup:${firstCellId}`;
    const phaseLabel = "Set up DuckDB app tables";
    const phaseDetail = "Setting up DuckDB app tables";
    session.startPhase(phaseKey, phaseLabel, firstCellId, phaseDetail);
    reportProgress?.({
      type: "phase-started",
      key: phaseKey,
      label: phaseLabel,
      cellId: firstCellId,
      detail: phaseDetail,
    });
    await duckdbService.ensureAppTables(async () => {
      await registerAppTablesSnapshot(
        duckdbService,
        await executionHost.getAppTablesSnapshot(),
      );
    });
    throwIfNotebookAborted(options.signal);
    session.finishPhase(phaseKey, firstCellId, phaseDetail);
    reportProgress?.({
      type: "phase-completed",
      key: phaseKey,
      cellId: firstCellId,
      detail: phaseDetail,
    });
  }

  for (const cellId of executionOrder) {
    throwIfNotebookAborted(options.signal);
    const node = session.graph.nodes.get(cellId);
    if (!node) {
      continue;
    }
    try {
      const invalidation = session.beginCellInvalidation(cellId);
      // Inputs may have changed while an earlier async cell was running.
      Object.assign(values, session.getRuntimeValues());
      for (const def of node.defs) {
        delete values[def];
      }
      delete values[cellId];

      if (!firstCellAlreadyRunning || cellId !== firstCellId) {
        const runningStatus = `Running ${cellId}`;
        session.markRunning(cellId, runningStatus);
        reportProgress?.({
          type: "cell-running",
          cellId,
          statusMessage: runningStatus,
        });
      } else {
        const runningStatus = `Running ${cellId}`;
        session.setStatusMessage(runningStatus, cellId);
        reportProgress?.({
          type: "status",
          message: runningStatus,
          cellId,
        });
      }
      const result = await awaitNotebookTask(
        executeCell(
          executionHost,
          node.cell,
          values,
          node.defs.filter((def) => def !== cellId),
          duckdbProvider,
          session,
          document.sourcePath,
          reportProgress,
          options.runtimeDependencies ?? [],
          options.runtimeDependencyLoader ?? loadNotebookRuntimeDependency,
          options.localPackageVersions ?? {},
          localModuleCache,
          options.moduleImportLoader,
          options.compileProvider,
          invalidation,
          options.signal,
        ),
        options.signal,
      );
      throwIfNotebookAborted(options.signal);
      outputs[cellId] = result.outputs;
      const definitions = new Map(result.definitions);
      for (const [name, value] of Object.entries(
        session.getCellInputValues(cellId) ?? {},
      )) {
        if (node.defs.includes(name)) definitions.set(name, value);
      }
      definitions.forEach((value, name) => {
        values[name] = value;
      });
      values[cellId] =
        result.value !== undefined
          ? result.value
          : result.outputs.length === 1
            ? result.outputs[0]
            : result.outputs;
      session.setRuntimeDefinitions(cellId, [
        ...definitions.entries(),
        [cellId, values[cellId]],
      ]);
      clearNotebookDomOutputsForCell(document.sourcePath, cellId, {
        exceptOutputIds: collectDomOutputIds(
          result.outputs,
          document.sourcePath,
        ),
      });
      session.setCellOutput(cellId, result.outputs);
      reportProgress?.({
        type: "cell-completed",
        cellId,
        outputs: result.outputs,
      });
    } catch (error) {
      throwIfNotebookAborted(options.signal);
      const message = error instanceof Error ? error.message : String(error);
      const failure = lapis.error(message);
      outputs[cellId] = [failure];
      clearNotebookDomOutputsForCell(document.sourcePath, cellId);
      session.setCellError(cellId, message);
      reportProgress?.({
        type: "cell-error",
        cellId,
        error: message,
      });
    }
  }

  throwIfNotebookAborted(options.signal);
  Object.assign(values, session.getRuntimeValues());
  return { outputs, values };
}

function collectDomOutputIds(
  outputs: readonly NotebookOutput[],
  sourcePath?: string,
): Set<string> {
  return new Set(
    outputs.flatMap((output) => {
      if (output.kind === "dom") return [output.outputId];
      if (output.kind === "input") {
        const id = notebookInputDomOutputId(
          sourcePath,
          output.cellId,
          output.variableName,
        );
        return id ? [id] : [];
      }
      return [];
    }),
  );
}

async function executeCell(
  host: NotebookExecutionHost,
  cell: NotebookDocument["cells"][number],
  values: Record<string, unknown>,
  defs: string[],
  duckdbProvider: NotebookDuckDbRuntimeProvider | undefined,
  session: NotebookSession,
  sourcePath?: string,
  reportProgress?: (event: NotebookExecutionProgressEvent) => void,
  runtimeDependencies: readonly NormalizedNotebookUserDependencyDescriptor[] = [],
  runtimeDependencyLoader: NotebookRuntimeDependencyLoader = loadNotebookRuntimeDependency,
  localPackageVersions: Readonly<Record<string, string>> = {},
  localModuleCache: NotebookLocalModuleCache = new Map(),
  moduleImportLoader?: NotebookRuntimeModuleLoader,
  compileProvider?: NotebookJavaScriptLikeCompileProvider,
  invalidation?: Promise<void>,
  signal?: AbortSignal,
): Promise<{
  outputs: NotebookOutput[];
  definitions: Array<[string, unknown]>;
  value: unknown;
}> {
  switch (cell.lang) {
    case "sql": {
      const duckdbService = await resolveDuckDbService(duckdbProvider);
      const sql = interpolatePlaceholders(cell.source, values, true);
      const tableResult = await duckdbService.queryWithMeta(sql);
      return {
        outputs: [
          lapis.table({
            columns: tableResult.columns,
            rows: tableResult.columns.map
              ? tableResult.rows.map((row) =>
                  tableResult.columns.map((column) => row[column]),
                )
              : [],
            columnMeta: tableResult.columnMeta,
            schema: tableResult.schema,
          }),
        ],
        definitions: [],
        value: tableResult.rows,
      };
    }
    case "md": {
      const rendered = await interpolateMarkdownSource(cell.source, values);
      return {
        outputs: [lapis.markdown(rendered)],
        definitions: [],
        value: rendered,
      };
    }
    case "html": {
      const rendered = await interpolateHtmlSource(cell.source, values);
      return {
        outputs: [lapis.html(rendered)],
        definitions: [],
        value: rendered,
      };
    }
    default:
      return executeJavaScriptLikeCell(
        host,
        cell.source,
        defs,
        values,
        duckdbProvider,
        session,
        cell.lang === "ts",
        sourcePath,
        reportProgress,
        cell.id,
        runtimeDependencies,
        runtimeDependencyLoader,
        localPackageVersions,
        localModuleCache,
        moduleImportLoader,
        compileProvider,
        invalidation,
        signal,
      );
  }
}

async function executeJavaScriptLikeCell(
  host: NotebookExecutionHost,
  source: string,
  defs: string[],
  values: Record<string, unknown>,
  duckdbProvider: NotebookDuckDbRuntimeProvider | undefined,
  session: NotebookSession,
  transpile: boolean,
  sourcePath?: string,
  reportProgress?: (event: NotebookExecutionProgressEvent) => void,
  cellId?: string,
  runtimeDependencies: readonly NormalizedNotebookUserDependencyDescriptor[] = [],
  runtimeDependencyLoader: NotebookRuntimeDependencyLoader = loadNotebookRuntimeDependency,
  localPackageVersions: Readonly<Record<string, string>> = {},
  localModuleCache: NotebookLocalModuleCache = new Map(),
  moduleImportLoader?: NotebookRuntimeModuleLoader,
  compileProvider?: NotebookJavaScriptLikeCompileProvider,
  invalidation?: Promise<void>,
  signal?: AbortSignal,
): Promise<{
  outputs: NotebookOutput[];
  definitions: Array<[string, unknown]>;
  value: unknown;
}> {
  const runtimeOutputs: NotebookOutput[] = [];
  let acceptsOutputs = true;
  const publishOutputs = () => {
    if (!acceptsOutputs || signal?.aborted || !cellId) return;
    const outputs = [...runtimeOutputs];
    session.setCellPartialOutput(cellId, outputs);
    reportProgress?.({ type: "cell-output", cellId, outputs });
  };
  const appendDisplayedValue = (value: unknown): unknown => {
    if (!acceptsOutputs || signal?.aborted) return value;
    const count = runtimeOutputs.length;
    appendNotebookDisplayValue(runtimeOutputs, value, cellId, sourcePath);
    if (runtimeOutputs.length !== count) publishOutputs();
    return value;
  };
  const transformed = transformObservableViewof(source);
  const runtimeRequiresDom =
    transformed.requiresDom || hasLiveDomRuntimeReference(source);
  const domRuntime = runtimeRequiresDom
    ? await loadNotebookDomRuntime(
        notebookInputHostContext(
          host,
          sourcePath,
          cellId,
          () => !signal?.aborted,
          signal,
        ),
      )
    : null;
  const compiledSource = await compileJavaScriptLikeSource(
    transformed.code,
    transpile,
    compileProvider,
    {
      sourcePath,
      cellId,
    },
  );
  throwIfNotebookAborted(signal);
  const dependencyEntries = await loadReferencedNotebookDependencyGlobals(
    source,
    runtimeDependencies.filter(
      (dependency) =>
        !compiledSource.importedBindings.has(dependency.globalName),
    ),
    runtimeDependencyLoader,
  );
  const runtimeModuleImporter = createNotebookModuleImporter(
    host,
    runtimeDependencies,
    localPackageVersions,
    sourcePath,
    localModuleCache,
    moduleImportLoader,
  );
  throwIfNotebookAborted(signal);
  const vaultRuntime = createNotebookVaultRuntime(
    (path, targetSourcePath) => host.readVaultFile(path, targetSourcePath),
    sourcePath,
  );

  const duckdbRuntime = {
    query: async (sql: string) => {
      const duckdbService = await resolveDuckDbService(duckdbProvider);
      return duckdbService.query(sql);
    },
    registerVaultFile: async (alias: string, path: string) => {
      const duckdbService = await resolveDuckDbService(duckdbProvider);
      const phaseKey = `duckdb:register:${cellId ?? "cell"}:${alias}`;
      const phaseLabel = `Register vault file ${alias}`;
      session.startPhase(phaseKey, phaseLabel, cellId, path);
      reportProgress?.({
        type: "phase-started",
        key: phaseKey,
        label: phaseLabel,
        cellId,
        detail: path,
      });
      try {
        await registerVaultFile(duckdbService, host, alias, path, sourcePath);
        throwIfNotebookAborted(signal);
        session.finishPhase(phaseKey, cellId, path);
        reportProgress?.({
          type: "phase-completed",
          key: phaseKey,
          cellId,
          detail: path,
        });
      } catch (error) {
        throwIfNotebookAborted(signal);
        const message = error instanceof Error ? error.message : String(error);
        session.finishPhase(phaseKey, cellId, message, message);
        reportProgress?.({
          type: "phase-completed",
          key: phaseKey,
          cellId,
          detail: message,
          error: message,
        });
        throw error;
      }
    },
  };

  const stdlibRuntime = await createNotebookStdlibRuntime({
    outputs: lapis as NotebookStdlibOutputApi<NotebookOutput>,
    appendOutput: (output) => {
      if (acceptsOutputs && !signal?.aborted) {
        runtimeOutputs.push(output);
        publishOutputs();
      }
    },
    vault: vaultRuntime,
    duckdb: duckdbRuntime,
    invalidation,
    now: Date.now(),
    visualizationGlobals: inferRequestedVisualizationGlobals(source),
  });
  throwIfNotebookAborted(signal);
  const lapisRuntime: Record<string, unknown> = {
    ...stdlibRuntime.lapis,
    display(value: unknown) {
      return appendDisplayedValue(value);
    },
    dom(
      node: Node,
      options?: { label?: string; role?: "input" | "html" | "svg" | "dom" },
    ) {
      if (!acceptsOutputs || signal?.aborted) return;
      const output = createDomOutput(node, cellId, sourcePath, options);
      runtimeOutputs.push(output);
      publishOutputs();
      return output;
    },
  };
  const baseHtml = lapisRuntime.html as (value: string) => unknown;
  lapisRuntime.html = (
    value: string | TemplateStringsArray,
    ...values: unknown[]
  ) => {
    if (isTemplateStringsArray(value)) {
      if (!domRuntime) {
        throw new Error(
          "lapis.html tagged templates require the notebook DOM runtime",
        );
      }
      return domRuntime.html(value, ...values);
    }
    return baseHtml(value);
  };

  if (domRuntime) {
    lapisRuntime.Inputs = domRuntime.Inputs;
    lapisRuntime.svg = domRuntime.svg;
    lapisRuntime.view = createNotebookViewRuntime({
      signal,
      cellId,
      sourcePath,
      getInputValue: (name) => {
        const current = session.getInputValue(name);
        if (current === undefined) return current;
        const previous = claimNotebookInputDomOutput(sourcePath, cellId!, name);
        return previous
          ? snapshotNotebookInputState(previous, { transient: true })
          : current;
      },
      setInputValue: (targetCellId, name, value) =>
        session.setInputValue(targetCellId, name, value),
      emitInputChange: emitNotebookInputChange,
      createOutputId: createNotebookDomOutputId,
      registerOutput: registerNotebookDomOutput,
      createOutput: ({
        outputId,
        cellId: targetCellId,
        label,
        role,
        metadata,
      }) =>
        metadata
          ? lapis.input(
              targetCellId,
              label,
              metadata.inputType,
              metadata.value,
              {
                label: metadata.label,
                config: metadata.config,
                reconstructable: metadata.reconstructable,
                source: metadata.source,
              },
            )
          : lapis.dom(outputId, targetCellId, { label, role }),
      appendOutput: (output) => {
        if (acceptsOutputs && !signal?.aborted) {
          runtimeOutputs.push(output);
          publishOutputs();
        }
      },
    });
  }
  // Cell IDs (e.g. "text-output") may contain hyphens that are invalid as
  // JS identifier names in new Function(). Filter to only valid identifiers.
  const isValidIdentifier = (name: string) =>
    /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name);
  const domArgNames = domRuntime ? ["Inputs", "html", "svg"] : [];
  const domArgValues = domRuntime
    ? [domRuntime.Inputs, domRuntime.html, domRuntime.svg]
    : [];
  const bareGlobalEntries = Object.entries(stdlibRuntime.bareGlobals);
  const builtinArgNames = new Set([
    ...dependencyEntries.map(([name]) => name),
    ...bareGlobalEntries.map(([name]) => name),
    ...domArgNames,
    "display",
    "__notebook_import_module",
  ]);
  const validValueEntries = Object.entries(values).filter(
    ([name]) => isValidIdentifier(name) && !builtinArgNames.has(name),
  );
  const argNames = [
    ...validValueEntries.map(([name]) => name),
    ...dependencyEntries.map(([name]) => name),
    ...bareGlobalEntries.map(([name]) => name),
    "display",
    "__notebook_import_module",
    "lapis",
    ...domArgNames,
  ];
  const argValues = [
    ...validValueEntries.map(([, value]) => value),
    ...dependencyEntries.map(([, value]) => value),
    ...bareGlobalEntries.map(([, value]) => value),
    appendDisplayedValue,
    runtimeModuleImporter,
    lapisRuntime,
    ...domArgValues,
  ];
  const definitionObject = defs.length
    ? `{${defs
        .map(
          (name) =>
            `${JSON.stringify(name)}: typeof ${name} === "undefined" ? undefined : ${name}`,
        )
        .join(",")}}`
    : "{}";
  const AsyncFunction = Object.getPrototypeOf(async function () {})
    .constructor as new (
    ...args: string[]
  ) => (...values: unknown[]) => Promise<unknown>;
  const runner = new AsyncFunction(
    ...argNames,
    `"use strict";
    ${compiledSource.code}
    return { __notebook_return: undefined, __notebook_defs: ${definitionObject} };`,
  ) as (...args: unknown[]) => Promise<unknown>;
  throwIfNotebookAborted(signal);
  try {
    const executed = await awaitNotebookTask(runner(...argValues), signal);
    throwIfNotebookAborted(signal);
    const result = isExecutionEnvelope(executed)
      ? executed
      : {
          __notebook_return: executed,
          __notebook_defs: {},
        };
    const definitions = Object.entries(result.__notebook_defs ?? {}).filter(
      ([, value]) => value !== undefined,
    );
    const returnValue = result.__notebook_return;

    if (returnValue !== undefined && runtimeOutputs.length === 0) {
      appendNotebookDisplayValue(
        runtimeOutputs,
        returnValue,
        cellId,
        sourcePath,
      );
    }

    return {
      outputs: runtimeOutputs,
      definitions,
      value: returnValue,
    };
  } finally {
    acceptsOutputs = false;
  }
}

function appendNotebookDisplayValue(
  runtimeOutputs: NotebookOutput[],
  value: unknown,
  cellId?: string,
  sourcePath?: string,
): void {
  if (isNotebookOutput(value)) {
    if (!runtimeOutputs.includes(value)) {
      runtimeOutputs.push(value);
    }
    return;
  }

  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(isNotebookOutput)
  ) {
    for (const output of value) {
      if (!runtimeOutputs.includes(output)) {
        runtimeOutputs.push(output);
      }
    }
    return;
  }

  if (isNotebookDomNode(value)) {
    runtimeOutputs.push(createDomOutput(value, cellId, sourcePath));
    return;
  }

  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(isNotebookDomNode)
  ) {
    runtimeOutputs.push(
      ...value.map((node) => createDomOutput(node, cellId, sourcePath)),
    );
    return;
  }

  runtimeOutputs.push(
    typeof value === "string"
      ? lapis.text(value)
      : lapis.code(formatNotebookDisplayValue(value), "javascript"),
  );
}

async function resolveDuckDbService(
  provider: NotebookDuckDbRuntimeProvider | undefined,
): Promise<NotebookDuckDbRuntime> {
  if (!provider) {
    throw new Error(
      "DuckDB runtime is not available for this notebook execution",
    );
  }

  return typeof provider === "function" ? provider() : provider;
}

async function transpileTypeScript(source: string): Promise<string> {
  typescriptModule ??= import("typescript");
  const ts = await typescriptModule;
  return ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
  }).outputText;
}

async function compileJavaScriptLikeSource(
  source: string,
  transpile: boolean,
  compileProvider?: NotebookJavaScriptLikeCompileProvider,
  context: { sourcePath?: string; cellId?: string } = {},
): Promise<CompiledJavaScriptLikeSource> {
  if (compileProvider) {
    const result = await compileProvider({
      source,
      language: transpile ? "ts" : "js",
      sourcePath: context.sourcePath,
      cellId: context.cellId,
    });
    return {
      code: result.code,
      importedBindings: new Set(result.importedBindings ?? []),
    };
  }

  const usesStaticModuleSyntax = STATIC_MODULE_SYNTAX_RE.test(source);
  if (!transpile && !usesStaticModuleSyntax) {
    return {
      code: source,
      importedBindings: new Set<string>(),
    };
  }

  typescriptModule ??= import("typescript");
  const ts = await typescriptModule;
  const rewrittenSource = usesStaticModuleSyntax
    ? rewriteNotebookModuleSyntax(
        ts,
        source,
        transpile ? ts.ScriptKind.TS : ts.ScriptKind.JS,
      )
    : {
        code: source,
        importedBindings: new Set<string>(),
      };

  if (!transpile) {
    return rewrittenSource;
  }

  return {
    code: await transpileTypeScript(rewrittenSource.code),
    importedBindings: rewrittenSource.importedBindings,
  };
}

function rewriteNotebookModuleSyntax(
  ts: typeof import("typescript"),
  source: string,
  scriptKind: import("typescript").ScriptKind,
): CompiledJavaScriptLikeSource {
  const sourceFile = ts.createSourceFile(
    scriptKind === ts.ScriptKind.TS ? "cell.ts" : "cell.js",
    source,
    ts.ScriptTarget.Latest,
    true,
    scriptKind,
  );
  const statements: import("typescript").Statement[] = [];
  const importedBindings = new Set<string>();
  let importIndex = 0;

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      statements.push(
        ...rewriteImportDeclaration(
          ts,
          statement,
          importIndex,
          importedBindings,
        ),
      );
      if (statement.importClause && !statement.importClause.isTypeOnly) {
        importIndex += 1;
      }
      continue;
    }

    if (ts.isImportEqualsDeclaration(statement)) {
      throw new Error(
        "Notebook cells do not support TypeScript import-equals syntax. Use standard ESM imports instead.",
      );
    }

    if (
      ts.isExportDeclaration(statement) ||
      ts.isExportAssignment(statement) ||
      hasExportModifier(ts, statement)
    ) {
      throw new Error(
        "Notebook cells do not support ESM export syntax. Define values directly in the cell instead.",
      );
    }

    statements.push(statement);
  }

  const updatedSourceFile = ts.factory.updateSourceFile(sourceFile, statements);
  return {
    code: ts
      .createPrinter({ newLine: ts.NewLineKind.LineFeed })
      .printFile(updatedSourceFile),
    importedBindings,
  };
}

function rewriteImportDeclaration(
  ts: typeof import("typescript"),
  statement: import("typescript").ImportDeclaration,
  importIndex: number,
  importedBindings: Set<string>,
): import("typescript").Statement[] {
  if (!ts.isStringLiteral(statement.moduleSpecifier)) {
    throw new Error("Notebook cells require string-literal module specifiers.");
  }

  const importClause = statement.importClause;
  if (!importClause) {
    return [
      ts.factory.createExpressionStatement(
        createNotebookImportCall(ts, statement.moduleSpecifier.text),
      ),
    ];
  }

  if (importClause.isTypeOnly) {
    return [];
  }

  const rewritten: import("typescript").Statement[] = [];
  const tempIdentifier = ts.factory.createIdentifier(
    `__notebook_module_${importIndex}`,
  );
  rewritten.push(
    createConstVariableStatement(
      ts,
      tempIdentifier,
      createNotebookImportCall(ts, statement.moduleSpecifier.text),
    ),
  );

  if (importClause.name) {
    importedBindings.add(importClause.name.text);
    rewritten.push(
      createConstVariableStatement(
        ts,
        importClause.name,
        ts.factory.createBinaryExpression(
          ts.factory.createPropertyAccessExpression(tempIdentifier, "default"),
          ts.SyntaxKind.QuestionQuestionToken,
          tempIdentifier,
        ),
      ),
    );
  }

  if (importClause.namedBindings) {
    if (ts.isNamespaceImport(importClause.namedBindings)) {
      importedBindings.add(importClause.namedBindings.name.text);
      rewritten.push(
        createConstVariableStatement(
          ts,
          importClause.namedBindings.name,
          tempIdentifier,
        ),
      );
    } else {
      for (const element of importClause.namedBindings.elements) {
        collectBindingNames(ts, element.name, importedBindings);
      }
      rewritten.push(
        createConstVariableStatement(
          ts,
          ts.factory.createObjectBindingPattern(
            importClause.namedBindings.elements.map((element) =>
              ts.factory.createBindingElement(
                undefined,
                element.propertyName ?? undefined,
                element.name,
                undefined,
              ),
            ),
          ),
          tempIdentifier,
        ),
      );
    }
  }

  return rewritten;
}

function collectBindingNames(
  ts: typeof import("typescript"),
  name: import("typescript").BindingName,
  bindingNames: Set<string>,
): void {
  if (ts.isIdentifier(name)) {
    bindingNames.add(name.text);
    return;
  }

  for (const element of name.elements) {
    if (!ts.isBindingElement(element)) {
      continue;
    }
    collectBindingNames(ts, element.name, bindingNames);
  }
}

function createNotebookImportCall(
  ts: typeof import("typescript"),
  specifier: string,
): import("typescript").Expression {
  return ts.factory.createAwaitExpression(
    ts.factory.createCallExpression(
      ts.factory.createIdentifier("__notebook_import_module"),
      undefined,
      [ts.factory.createStringLiteral(specifier)],
    ),
  );
}

function createConstVariableStatement(
  ts: typeof import("typescript"),
  name: import("typescript").BindingName,
  initializer: import("typescript").Expression,
): import("typescript").Statement {
  return ts.factory.createVariableStatement(
    undefined,
    ts.factory.createVariableDeclarationList(
      [
        ts.factory.createVariableDeclaration(
          name,
          undefined,
          undefined,
          initializer,
        ),
      ],
      ts.NodeFlags.Const,
    ),
  );
}

function hasExportModifier(
  ts: typeof import("typescript"),
  statement: import("typescript").Statement,
): boolean {
  const modifiers = ts.canHaveModifiers(statement)
    ? ts.getModifiers(statement)
    : undefined;
  return Boolean(
    modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword,
    ),
  );
}

function createNotebookModuleImporter(
  host: NotebookExecutionHost,
  runtimeDependencies: readonly NormalizedNotebookUserDependencyDescriptor[],
  localPackageVersions: Readonly<Record<string, string>>,
  sourcePath: string | undefined,
  localModuleCache: NotebookLocalModuleCache,
  moduleImportLoader: NotebookRuntimeModuleLoader = loadNotebookModule,
): NotebookRuntimeModuleLoader {
  return async (specifier: string) => {
    if (URL_IMPORT_RE.test(specifier)) {
      return moduleImportLoader(specifier);
    }

    if (specifier.startsWith(".")) {
      return loadNotebookLocalModule(
        host,
        specifier,
        sourcePath,
        runtimeDependencies,
        localPackageVersions,
        localModuleCache,
        moduleImportLoader,
      );
    }

    if (specifier.startsWith("/")) {
      throw new Error(
        `Notebook imports do not support absolute vault module specifiers: ${specifier}`,
      );
    }

    const runtimeSpecifier = resolveNotebookRuntimeImportSpecifier(
      specifier,
      runtimeDependencies,
      localPackageVersions,
    );
    if (!runtimeSpecifier) {
      throw new Error(
        `Notebook module \"${specifier}\" is not available. Install it in packages/workspace/package.json dependencies or add it from Notebook Packages.`,
      );
    }

    return moduleImportLoader(runtimeSpecifier);
  };
}

async function loadNotebookLocalModule(
  host: NotebookExecutionHost,
  specifier: string,
  importingSourcePath: string | undefined,
  runtimeDependencies: readonly NormalizedNotebookUserDependencyDescriptor[],
  localPackageVersions: Readonly<Record<string, string>>,
  localModuleCache: NotebookLocalModuleCache,
  moduleImportLoader: NotebookRuntimeModuleLoader,
): Promise<NotebookLocalModuleExports> {
  const resolvedModulePath = resolveNotebookLocalModulePath(
    specifier,
    importingSourcePath,
  );
  const cachedModule = localModuleCache.get(resolvedModulePath);
  if (cachedModule) {
    return cachedModule;
  }

  const modulePromise = (async () => {
    const source = decodeNotebookModuleSource(
      await host.readVaultFile(specifier, importingSourcePath),
    );
    return evaluateNotebookLocalModule(
      host,
      source,
      resolvedModulePath,
      runtimeDependencies,
      localPackageVersions,
      localModuleCache,
      moduleImportLoader,
    );
  })();
  localModuleCache.set(resolvedModulePath, modulePromise);

  try {
    return await modulePromise;
  } catch (error) {
    localModuleCache.delete(resolvedModulePath);
    throw error;
  }
}

function resolveNotebookLocalModulePath(
  specifier: string,
  sourcePath: string | undefined,
): string {
  if (!sourcePath) {
    throw new Error(
      `Notebook relative imports require a notebook source path: ${specifier}`,
    );
  }

  const notebookDirectorySegments = sourcePath
    .split("/")
    .filter(Boolean)
    .slice(0, -1);

  for (const segment of specifier.split("/")) {
    if (!segment || segment === ".") {
      continue;
    }

    if (segment === "..") {
      if (notebookDirectorySegments.length === 0) {
        throw new Error(
          `Notebook relative import escapes the vault root: ${specifier}`,
        );
      }
      notebookDirectorySegments.pop();
      continue;
    }

    notebookDirectorySegments.push(segment);
  }

  const resolvedPath = notebookDirectorySegments.join("/");
  if (!resolvedPath) {
    throw new Error(
      `Notebook relative import resolved to an empty path: ${specifier}`,
    );
  }

  if (!NOTEBOOK_LOCAL_MODULE_EXT_RE.test(resolvedPath)) {
    throw new Error(
      `Notebook relative imports currently support only JavaScript modules (.js or .mjs): ${specifier}`,
    );
  }

  return resolveNotebookFilePath(resolvedPath);
}

function decodeNotebookModuleSource(buffer: ArrayBuffer): string {
  return new TextDecoder().decode(buffer);
}

async function evaluateNotebookLocalModule(
  host: NotebookExecutionHost,
  source: string,
  sourcePath: string,
  runtimeDependencies: readonly NormalizedNotebookUserDependencyDescriptor[],
  localPackageVersions: Readonly<Record<string, string>>,
  localModuleCache: NotebookLocalModuleCache,
  moduleImportLoader: NotebookRuntimeModuleLoader,
): Promise<NotebookLocalModuleExports> {
  typescriptModule ??= import("typescript");
  const ts = await typescriptModule;
  const compiledModule = rewriteNotebookLocalModuleSyntax(
    ts,
    source,
    sourcePath,
  );
  const runtimeModuleImporter = createNotebookModuleImporter(
    host,
    runtimeDependencies,
    localPackageVersions,
    sourcePath,
    localModuleCache,
    moduleImportLoader,
  );
  const AsyncFunction = Object.getPrototypeOf(async function () {})
    .constructor as new (
    ...args: string[]
  ) => (...values: unknown[]) => Promise<NotebookLocalModuleExports>;
  const runner = new AsyncFunction(
    "__notebook_import_module",
    `"use strict";
    const __notebook_exports = Object.create(null);
    ${compiledModule}
    return __notebook_exports;`,
  );
  return runner(runtimeModuleImporter);
}

function rewriteNotebookLocalModuleSyntax(
  ts: typeof import("typescript"),
  source: string,
  sourcePath: string,
): string {
  const sourceFile = ts.createSourceFile(
    sourcePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const statements: import("typescript").Statement[] = [];
  let importIndex = 0;

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement)) {
      statements.push(
        ...rewriteImportDeclaration(ts, statement, importIndex, new Set()),
      );
      if (statement.importClause && !statement.importClause.isTypeOnly) {
        importIndex += 1;
      }
      continue;
    }

    if (ts.isImportEqualsDeclaration(statement)) {
      throw new Error(
        "Notebook local modules do not support TypeScript import-equals syntax. Use standard ESM imports instead.",
      );
    }

    if (ts.isExportAssignment(statement)) {
      if (statement.isExportEquals) {
        throw new Error(
          "Notebook local modules do not support TypeScript export-equals syntax. Use standard ESM exports instead.",
        );
      }
      statements.push(
        createNotebookModuleExportAssignment(
          ts,
          "default",
          statement.expression,
        ),
      );
      continue;
    }

    if (ts.isExportDeclaration(statement)) {
      statements.push(...rewriteNotebookModuleExportDeclaration(ts, statement));
      continue;
    }

    if (hasExportModifier(ts, statement)) {
      statements.push(...rewriteExportedNotebookModuleStatement(ts, statement));
      continue;
    }

    statements.push(statement);
  }

  return ts
    .createPrinter({ newLine: ts.NewLineKind.LineFeed })
    .printFile(ts.factory.updateSourceFile(sourceFile, statements));
}

function rewriteNotebookModuleExportDeclaration(
  ts: typeof import("typescript"),
  statement: import("typescript").ExportDeclaration,
): import("typescript").Statement[] {
  if (statement.moduleSpecifier) {
    throw new Error(
      "Notebook local modules do not support re-export syntax. Import and re-export bindings explicitly instead.",
    );
  }

  if (!statement.exportClause || ts.isNamespaceExport(statement.exportClause)) {
    throw new Error(
      "Notebook local modules do not support export-all syntax. Export named bindings explicitly instead.",
    );
  }

  return statement.exportClause.elements.map((element) =>
    createNotebookModuleExportAssignment(
      ts,
      element.name.text,
      ts.factory.createIdentifier((element.propertyName ?? element.name).text),
    ),
  );
}

function rewriteExportedNotebookModuleStatement(
  ts: typeof import("typescript"),
  statement: import("typescript").Statement,
): import("typescript").Statement[] {
  const defaultExport = hasDefaultModifier(ts, statement);

  if (ts.isVariableStatement(statement)) {
    if (defaultExport) {
      throw new Error(
        "Notebook local modules do not support default-exported variable statements. Use `export default expression` or named exports instead.",
      );
    }

    const exportedNames = collectVariableStatementBindingNames(ts, statement);
    return [
      ts.factory.updateVariableStatement(
        statement,
        filterNotebookExportModifiers(ts, statement.modifiers),
        statement.declarationList,
      ),
      ...exportedNames.map((name) =>
        createNotebookModuleExportAssignment(
          ts,
          name,
          ts.factory.createIdentifier(name),
        ),
      ),
    ];
  }

  if (ts.isFunctionDeclaration(statement)) {
    if (!statement.name) {
      throw new Error(
        "Notebook local modules require named function exports so notebook diagnostics stay clear.",
      );
    }

    return [
      ts.factory.updateFunctionDeclaration(
        statement,
        filterNotebookExportModifiers(ts, statement.modifiers),
        statement.asteriskToken,
        statement.name,
        statement.typeParameters,
        statement.parameters,
        statement.type,
        statement.body,
      ),
      createNotebookModuleExportAssignment(
        ts,
        defaultExport ? "default" : statement.name.text,
        ts.factory.createIdentifier(statement.name.text),
      ),
    ];
  }

  if (ts.isClassDeclaration(statement)) {
    if (!statement.name) {
      throw new Error(
        "Notebook local modules require named class exports so notebook diagnostics stay clear.",
      );
    }

    return [
      ts.factory.updateClassDeclaration(
        statement,
        filterNotebookExportModifiers(ts, statement.modifiers),
        statement.name,
        statement.typeParameters,
        statement.heritageClauses,
        statement.members,
      ),
      createNotebookModuleExportAssignment(
        ts,
        defaultExport ? "default" : statement.name.text,
        ts.factory.createIdentifier(statement.name.text),
      ),
    ];
  }

  throw new Error(
    "Notebook local modules currently support only exported variables, functions, classes, and `export default expression`.",
  );
}

function filterNotebookExportModifiers(
  ts: typeof import("typescript"),
  modifiers: readonly import("typescript").ModifierLike[] | undefined,
): readonly import("typescript").Modifier[] | undefined {
  if (!modifiers?.length) {
    return undefined;
  }

  const filtered = modifiers.filter(
    (modifier): modifier is import("typescript").Modifier =>
      !ts.isDecorator(modifier) &&
      modifier.kind !== ts.SyntaxKind.ExportKeyword &&
      modifier.kind !== ts.SyntaxKind.DefaultKeyword,
  );
  return filtered.length > 0 ? filtered : undefined;
}

function hasDefaultModifier(
  ts: typeof import("typescript"),
  statement: import("typescript").Statement,
): boolean {
  const modifiers = ts.canHaveModifiers(statement)
    ? ts.getModifiers(statement)
    : undefined;
  return Boolean(
    modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword,
    ),
  );
}

function collectVariableStatementBindingNames(
  ts: typeof import("typescript"),
  statement: import("typescript").VariableStatement,
): string[] {
  const bindingNames = new Set<string>();
  for (const declaration of statement.declarationList.declarations) {
    collectBindingNames(ts, declaration.name, bindingNames);
  }
  return [...bindingNames];
}

function createNotebookModuleExportAssignment(
  ts: typeof import("typescript"),
  exportName: string,
  expression: import("typescript").Expression,
): import("typescript").Statement {
  return ts.factory.createExpressionStatement(
    ts.factory.createBinaryExpression(
      ts.factory.createElementAccessExpression(
        ts.factory.createIdentifier("__notebook_exports"),
        ts.factory.createStringLiteral(exportName),
      ),
      ts.SyntaxKind.EqualsToken,
      expression,
    ),
  );
}

function resolveNotebookRuntimeImportSpecifier(
  specifier: string,
  runtimeDependencies: readonly NormalizedNotebookUserDependencyDescriptor[],
  localPackageVersions: Readonly<Record<string, string>>,
): string | null {
  const parsedSpecifier = parseNotebookPackageSpecifier(specifier);
  if (!parsedSpecifier) {
    return null;
  }

  const runtimeDependency = runtimeDependencies.find(
    (dependency) => dependency.packageName === parsedSpecifier.packageName,
  );
  if (runtimeDependency) {
    return appendNotebookImportSubpath(
      resolveRuntimeDependencySpecifier(runtimeDependency),
      parsedSpecifier.subpath,
    );
  }

  const localVersion = localPackageVersions[parsedSpecifier.packageName];
  if (!localVersion) {
    return null;
  }

  return appendNotebookImportSubpath(
    `https://esm.sh/${parsedSpecifier.packageName}@${localVersion}`,
    parsedSpecifier.subpath,
  );
}

function parseNotebookPackageSpecifier(
  specifier: string,
): { packageName: string; subpath: string } | null {
  if (
    !specifier ||
    specifier.startsWith(".") ||
    specifier.startsWith("/") ||
    URL_IMPORT_RE.test(specifier)
  ) {
    return null;
  }

  if (specifier.startsWith("@")) {
    const [scope, name, ...subpath] = specifier.split("/");
    if (!scope || !name) {
      return null;
    }
    return {
      packageName: `${scope}/${name}`,
      subpath: subpath.join("/"),
    };
  }

  const [name, ...subpath] = specifier.split("/");
  if (!name) {
    return null;
  }

  return {
    packageName: name,
    subpath: subpath.join("/"),
  };
}

function appendNotebookImportSubpath(
  baseSpecifier: string,
  subpath: string,
): string {
  if (!subpath) {
    return baseSpecifier;
  }

  return `${baseSpecifier}/${subpath.replace(/^\/+/, "")}`;
}

async function loadNotebookModule(specifier: string): Promise<unknown> {
  return import(/* @vite-ignore */ specifier);
}

function interpolatePlaceholders(
  source: string,
  values: Record<string, unknown>,
  sqlMode: boolean,
): string {
  return source.replace(
    /\{\{\s*([A-Za-z_$][\w$]*)\s*\}\}/g,
    (_, key: string) => {
      const value = values[key];
      if (sqlMode) {
        return formatSqlLiteral(value);
      }
      return formatNotebookValue(value);
    },
  );
}

async function interpolateMarkdownSource(
  source: string,
  values: Record<string, unknown>,
): Promise<string> {
  const withExpressions = await interpolateNotebookExpressions(
    source,
    (expression) => evaluateNotebookExpression(expression, values),
    formatNotebookValue,
  );
  return interpolatePlaceholders(withExpressions, values, false);
}

async function interpolateHtmlSource(
  source: string,
  values: Record<string, unknown>,
): Promise<string> {
  return interpolateNotebookExpressions(
    source,
    (expression) => evaluateNotebookExpression(expression, values),
    (value) => escapeHtml(formatNotebookValue(value)),
  );
}

async function evaluateNotebookExpression(
  expression: string,
  values: Record<string, unknown>,
): Promise<unknown> {
  const entries = Object.entries(values).filter(([name]) =>
    /^[A-Za-z_$][\w$]*$/.test(name),
  );
  const AsyncFunction = Object.getPrototypeOf(async function () {})
    .constructor as new (
    ...args: string[]
  ) => (...values: unknown[]) => Promise<unknown>;
  const runner = new AsyncFunction(
    ...entries.map(([name]) => name),
    `"use strict"; return (${expression});`,
  );
  return runner(...entries.map(([, value]) => value));
}

function formatSqlLiteral(value: unknown): string {
  if (value === null || value === undefined) {
    return "NULL";
  }
  if (typeof value === "number" || typeof value === "bigint") {
    return String(value);
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function formatNotebookValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "bigint") {
    return String(value);
  }
  return JSON.stringify(value, null, 2) ?? String(value);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

function isNotebookOutput(value: unknown): value is NotebookOutput {
  return Boolean(
    value &&
      typeof value === "object" &&
      "kind" in value &&
      typeof (value as { kind?: unknown }).kind === "string",
  );
}

function isExecutionEnvelope(value: unknown): value is {
  __notebook_return: unknown;
  __notebook_defs: Record<string, unknown>;
} {
  return Boolean(
    value &&
      typeof value === "object" &&
      "__notebook_defs" in value &&
      "__notebook_return" in value,
  );
}

export function resolveExecutionOrder(
  document: NotebookDocument,
  session: NotebookSession,
  options: NotebookExecutionOptions,
): string[] {
  const orderedCellIds =
    session.graph.order.length > 0
      ? session.graph.order
      : document.cells.map((cell) => cell.id);
  if (!options.cellIds || options.cellIds.length === 0) {
    return orderedCellIds;
  }

  if (options.skipDependencyClosure) {
    const requested = new Set(options.cellIds);
    return orderedCellIds.filter((cellId) => requested.has(cellId));
  }

  const requested = new Set(options.cellIds);
  const required = new Set(
    collectDependencyClosure(session.graph, options.cellIds),
  );
  const runtimeValues = session.getRuntimeValues();
  const included = new Set<string>();

  for (const cellId of orderedCellIds) {
    if (!required.has(cellId)) {
      continue;
    }

    const node = session.graph.nodes.get(cellId);
    const dependencyNeedsExecution =
      node?.dependencies.some((dependency) => included.has(dependency)) ??
      false;
    if (
      requested.has(cellId) ||
      dependencyNeedsExecution ||
      !isExecutionSatisfied(session, runtimeValues, cellId)
    ) {
      included.add(cellId);
    }
  }

  return orderedCellIds.filter((cellId) => included.has(cellId));
}

function isExecutionSatisfied(
  session: NotebookSession,
  runtimeValues: Record<string, unknown>,
  cellId: string,
): boolean {
  const node = session.graph.nodes.get(cellId);
  if (!node) {
    return false;
  }

  const state = session.getCellState(cellId);
  if (state.state !== "completed") {
    return false;
  }

  return node.defs.every((definition) => definition in runtimeValues);
}

function createDomOutput(
  node: Node,
  cellId: string | undefined,
  sourcePath: string | undefined,
  options: { label?: string; role?: "input" | "html" | "svg" | "dom" } = {},
): NotebookOutput {
  const ownerCellId = cellId ?? "cell";
  const outputId = createNotebookDomOutputId(ownerCellId, options.label);
  registerNotebookDomOutput({
    outputId,
    sourcePath,
    cellId: ownerCellId,
    role: options.role ?? inferDomRole(node),
    node,
  });
  return lapis.dom(outputId, ownerCellId, {
    label: options.label,
    role: options.role ?? inferDomRole(node),
  });
}

function inferDomRole(node: Node): "html" | "svg" | "dom" {
  if (typeof SVGElement !== "undefined" && node instanceof SVGElement) {
    return "svg";
  }
  if (typeof HTMLElement !== "undefined" && node instanceof HTMLElement) {
    return "html";
  }
  return "dom";
}

function requiresDuckDb(
  document: NotebookDocument,
  executionOrder: string[],
): boolean {
  const cellsById = new Map(document.cells.map((cell) => [cell.id, cell]));
  return executionOrder.some((cellId) => {
    const cell = cellsById.get(cellId);
    return !!cell && cellUsesDuckDbRuntime(cell);
  });
}

function inferRequestedVisualizationGlobals(source: string): {
  Plot: boolean;
} {
  return {
    Plot: /(?:^|[^\w$.])Plot\b|\blapis\.Plot\b/.test(source),
  };
}

export function describeExecutionStart(cellCount: number): string {
  return cellCount === 1
    ? "Queued 1 notebook cell"
    : `Queued ${cellCount} notebook cells`;
}
