import {
  awaitNotebookTask,
  throwIfNotebookAborted,
} from "./notebook-cancellation";
import type { App } from "@lapis-notes/api";

const logger = {
  debug: (...a: any[]) => console.debug("[notebook.worker]", ...a),
  info: (...a: any[]) => console.log("[notebook.worker]", ...a),
  warn: (...a: any[]) => console.warn("[notebook.worker]", ...a),
  error: (...a: any[]) => console.error("[notebook.worker]", ...a),
};
import type { NotebookDocument } from "../model/notebook-document";
import { analyzeNotebookRuntimeFeatures } from "./analysis/analyze-runtime-features";
import type {
  NotebookDuckDbRuntime,
  NotebookDuckDbRuntimeProvider,
  NotebookDuckDbCatalog,
  NotebookDuckDbTablePreview,
} from "@lapis-notes/notebook-duckdb";
import {
  hasUnsupportedNotebookWorkerRuntimeDependency,
  NotebookWorkerCommandBroker,
  NotebookWorkerHostRequestResponder,
  shouldUseNotebookWorkerRuntime,
} from "@lapis-notes/notebook-worker";
import type {
  NotebookFileReaderProvider,
  NotebookJavaScriptLikeCompileProvider,
} from "@lapis-notes/notebook-core";
import { createNotebookExecutionHost } from "./notebook-execution-host";
import notebookWorkerUrl from "./notebook-runtime.worker?worker&url";
import type {
  NotebookExecutionOptions,
  NotebookExecutionResult,
} from "./notebook-worker";
import type { NotebookDuckDbServiceOptions } from "./duckdb/notebook-duckdb-service";
import type {
  NotebookWorkerCommandResponseMessage,
  NotebookWorkerExecuteResponse,
  NotebookWorkerHostRequestMessage,
  NotebookWorkerIncomingMessage,
  NotebookWorkerProgressMessage,
} from "./notebook-runtime-protocol";
import type { NotebookSession } from "./notebook-session";

export interface NotebookWorkerClientOptions {
  duckdbProvider?: NotebookDuckDbRuntimeProvider;
  duckdbServiceOptions?: NotebookDuckDbServiceOptions;
  onInputError?: import("./notebook-execution-host").NotebookExecutionHost["reportInputError"];
  fileReaderProvider?: NotebookFileReaderProvider;
  compileProvider?: NotebookJavaScriptLikeCompileProvider;
  pluginId?: string;
  pluginPath?: string;
  pluginVersion?: string;
}

type InspectableNotebookDuckDbRuntime = NotebookDuckDbRuntime & {
  inspectCatalog?: () => Promise<NotebookDuckDbCatalog>;
  inspectTablePreview?: (
    schemaName: string,
    tableName: string,
    limit?: number,
  ) => Promise<NotebookDuckDbTablePreview>;
  terminate?: () => Promise<void>;
};

export class NotebookWorkerClient {
  private readonly host;
  private readonly executions = new Map<AbortController, NotebookSession>();
  private fallbackDuckDb: InspectableNotebookDuckDbRuntime | null = null;
  private worker: Worker | null = null;
  private readonly commandBroker = new NotebookWorkerCommandBroker<
    NotebookExecutionResult,
    NotebookSession
  >();
  private readonly hostRequestResponder =
    new NotebookWorkerHostRequestResponder({
      resolve: (message) => this.resolveHostRequest(message),
    });

  constructor(
    private readonly app: App,
    private readonly options: NotebookWorkerClientOptions = {},
  ) {
    this.host = createNotebookExecutionHost(app, {
      fileReaderProvider: options.fileReaderProvider,
      onInputError: options.onInputError,
    });
  }

  async executeDocument(
    document: NotebookDocument,
    session: NotebookSession,
    options: NotebookExecutionOptions = {},
  ): Promise<NotebookExecutionResult> {
    const controller = new AbortController();
    this.executions.set(controller, session);
    const abort = () => {
      void this.terminate();
    };
    options.signal?.addEventListener("abort", abort, { once: true });
    try {
      throwIfNotebookAborted(options.signal);
      return await awaitNotebookTask(
        this.execute(document, session, {
          ...options,
          signal: controller.signal,
        }),
        controller.signal,
      );
    } finally {
      this.executions.delete(controller);
      options.signal?.removeEventListener("abort", abort);
    }
  }

  private async execute(
    document: NotebookDocument,
    session: NotebookSession,
    options: NotebookExecutionOptions,
  ): Promise<NotebookExecutionResult> {
    const workerOptions = serializeNotebookWorkerExecutionOptions(options);
    const useWorker = this.shouldUseWorker(document, options);
    logger.info("executeDocument", {
      cellIds: options.cellIds,
      useWorker,
      sourcePath: document.sourcePath,
    });
    if (!useWorker) {
      logger.debug("executeDocument: using in-process fallback");
      return this.executeInProcess(document, session, options);
    }

    const worker = this.ensureWorker();
    const command = this.commandBroker.create(
      "execute",
      {
        document,
        cellIds: options.cellIds,
        options: workerOptions,
      },
      session,
    );
    logger.debug("executeDocument: posting command to worker", {
      id: command.id,
      cellIds: options.cellIds,
    });
    worker.postMessage(command.message satisfies NotebookWorkerIncomingMessage);
    return command.promise;
  }

  async terminate(): Promise<void> {
    for (const [controller, session] of this.executions) {
      controller.abort();
      session.invalidateAllCells();
    }
    this.executions.clear();
    this.worker?.terminate();
    this.worker = null;
    this.commandBroker.rejectAll(new Error("Notebook worker was terminated"));

    if (this.fallbackDuckDb) {
      await this.fallbackDuckDb.terminate?.();
      this.fallbackDuckDb = null;
    }
  }

  async inspectDuckDbCatalog(
    document: NotebookDocument,
  ): Promise<NotebookDuckDbCatalog | null> {
    if (this.shouldUseWorker(document) || !this.fallbackDuckDb) {
      return null;
    }

    return this.fallbackDuckDb.inspectCatalog?.() ?? null;
  }

  async inspectDuckDbTablePreview(
    document: NotebookDocument,
    schemaName: string,
    tableName: string,
    limit: number = 5,
  ): Promise<NotebookDuckDbTablePreview | null> {
    if (this.shouldUseWorker(document) || !this.fallbackDuckDb) {
      return null;
    }

    return (
      this.fallbackDuckDb.inspectTablePreview?.(schemaName, tableName, limit) ??
      null
    );
  }

  private async executeInProcess(
    document: NotebookDocument,
    session: NotebookSession,
    options: NotebookExecutionOptions,
  ): Promise<NotebookExecutionResult> {
    const { executeNotebookDocument } = await import("./notebook-worker");
    const duckdb = await this.resolveDuckDbRuntime();
    throwIfNotebookAborted(options.signal);
    return executeNotebookDocument(this.host, document, session, duckdb, {
      ...options,
      compileProvider: options.compileProvider ?? this.options.compileProvider,
    });
  }

  private async resolveDuckDbRuntime(): Promise<InspectableNotebookDuckDbRuntime> {
    if (this.fallbackDuckDb) {
      return this.fallbackDuckDb;
    }

    const configuredProvider = this.options.duckdbProvider;
    if (configuredProvider) {
      this.fallbackDuckDb = (
        typeof configuredProvider === "function"
          ? await configuredProvider()
          : configuredProvider
      ) as InspectableNotebookDuckDbRuntime;
      return this.fallbackDuckDb;
    }

    const { NotebookDuckDbService } = await import(
      "./duckdb/notebook-duckdb-service"
    );
    this.fallbackDuckDb = new NotebookDuckDbService(
      this.options.duckdbServiceOptions ?? {},
    );
    return this.fallbackDuckDb;
  }

  private ensureWorker(): Worker {
    if (this.worker) {
      return this.worker;
    }

    const worker = new Worker(notebookWorkerUrl, { type: "module" });
    worker.onmessage = (
      event: MessageEvent<
        | NotebookWorkerCommandResponseMessage
        | NotebookWorkerHostRequestMessage
        | NotebookWorkerProgressMessage
      >,
    ) => {
      void this.handleWorkerMessage(event.data, worker);
    };
    worker.onerror = (event) => {
      const details = [event.message, event.filename, event.lineno, event.colno]
        .filter(
          (value) => value !== undefined && value !== null && value !== "",
        )
        .join(":");
      const error = new Error(
        details
          ? `Notebook worker failed: ${details}`
          : "Notebook worker failed",
      );
      this.commandBroker.rejectAll(error);
    };
    this.worker = worker;
    return worker;
  }

  private shouldUseWorker(
    document: NotebookDocument,
    options: NotebookExecutionOptions = {},
  ): boolean {
    const features = analyzeNotebookRuntimeFeatures(document);
    return shouldUseNotebookWorkerRuntime({
      workerAvailable: typeof Worker !== "undefined",
      usesDuckDb: features.usesDuckDb,
      requiresDom: features.requiresDom,
      requiresLiveDom: features.requiresLiveDom,
      hasRuntimeDependencyLoader: !!options.runtimeDependencyLoader,
      hasUnsupportedRuntimeDependency:
        hasUnsupportedNotebookWorkerRuntimeDependency(
          options.runtimeDependencies,
        ),
      hasHostOnlyProvider: Boolean(
        options.compileProvider ||
          this.options.compileProvider ||
          options.fileReaderProvider,
      ),
    });
  }

  private async handleWorkerMessage(
    message:
      | NotebookWorkerCommandResponseMessage
      | NotebookWorkerHostRequestMessage
      | NotebookWorkerProgressMessage,
    worker: Worker,
  ): Promise<void> {
    if (message.channel === "host-request") {
      await this.handleHostRequest(message, worker);
      return;
    }

    if (message.channel === "progress") {
      this.commandBroker
        .contextFor(message.id)
        ?.applyProgressEvent(message.event);
      return;
    }

    const pending = this.commandBroker.take(message.id);
    if (!pending) {
      logger.warn("worker response for unknown command", { id: message.id });
      return;
    }

    if (!message.success || !message.result) {
      logger.error("worker command failed", {
        id: message.id,
        error: message.error,
      });
      pending.reject(
        new Error(message.error ?? "Notebook worker command failed"),
      );
      return;
    }

    logger.info("worker command succeeded", {
      id: message.id,
      executedCells: Object.keys(message.result.outputs),
    });
    this.applyWorkerState(pending.context, message.result);
    pending.resolve({
      outputs: message.result.outputs,
      values: message.result.values,
    });
  }

  private async handleHostRequest(
    message: NotebookWorkerHostRequestMessage,
    worker: Worker,
  ): Promise<void> {
    await this.hostRequestResponder.respond(message, (response, transfer) => {
      worker.postMessage(response, transfer);
    });
  }

  private async resolveHostRequest(
    message: NotebookWorkerHostRequestMessage,
  ): Promise<unknown> {
    switch (message.type) {
      case "get-app-tables":
        return this.host.getAppTablesSnapshot();
      case "read-vault-file":
        return this.host.readVaultFile(
          String(message.data.path ?? ""),
          typeof message.data.sourcePath === "string"
            ? message.data.sourcePath
            : undefined,
        );
      case "resolve-plugin-asset-url": {
        const relativePath = String(message.data.relativePath ?? "");
        const resolver =
          this.options.duckdbServiceOptions?.resolveAssetUrl ??
          (this.options.pluginId &&
          this.options.pluginPath &&
          this.options.pluginVersion
            ? (
                await import("./notebook-plugin-runtime-assets")
              ).createNotebookPluginAssetUrlResolver(this.app, {
                pluginId: this.options.pluginId,
                pluginPath: this.options.pluginPath,
                version: this.options.pluginVersion,
              })
            : undefined);
        if (!resolver) {
          throw new Error(
            "Notebook plugin asset resolver is unavailable in the worker host.",
          );
        }
        return resolver(relativePath);
      }
      default:
        throw new Error(`Unsupported notebook host request: ${message.type}`);
    }
  }

  private applyWorkerState(
    session: NotebookSession,
    result: NotebookWorkerExecuteResponse,
  ): void {
    const cellIds = Object.keys(result.cellStates);
    cellIds.forEach((cellId) => {
      session.hydrateCellState(cellId, result.cellStates[cellId]);
    });
  }
}

function serializeNotebookWorkerExecutionOptions(
  options: NotebookExecutionOptions,
): NotebookExecutionOptions {
  const {
    signal,
    runtimeDependencyLoader,
    moduleImportLoader,
    fileReaderProvider,
    compileProvider,
    ...serializableOptions
  } = options;
  return serializableOptions;
}
