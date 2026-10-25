import type { AppDatabaseNotebookCellState } from "@lapis-notes/api";
import type { NotebookAppTablesSnapshot } from "./duckdb/register-app-tables";
import type {
  NotebookDuckDbService,
  NotebookDuckDbServiceOptions,
} from "./duckdb/notebook-duckdb-service";
import type { NotebookExecutionHost } from "./notebook-execution-host";
import {
  NotebookWorkerShell,
  type NotebookWorkerShellCommandContext,
} from "@lapis-notes/notebook-worker";
import type { NotebookDocument } from "../model/notebook-document";
import {
  executeNotebookDocument,
  type NotebookExecutionOptions,
  type NotebookExecutionResult,
} from "./notebook-worker";
import {
  type NotebookWorkerExecuteRequest,
  type NotebookWorkerExecuteResponse,
  type NotebookWorkerIncomingMessage,
  type NotebookWorkerOutgoingMessage,
} from "./notebook-runtime-protocol";
import {
  NotebookSession,
  type NotebookExecutionProgressEvent,
} from "./notebook-session";

const workerShell = new NotebookWorkerShell<
  NotebookDocument,
  NotebookExecutionOptions,
  NotebookExecutionResult,
  AppDatabaseNotebookCellState,
  NotebookExecutionProgressEvent
>({
  postMessage: (message) => {
    self.postMessage(message satisfies NotebookWorkerOutgoingMessage);
  },
  execute: (request, context) => executeInWorker(request, context),
});
let duckdbService: Promise<NotebookDuckDbService> | null = null;
let duckdbServiceOptions: NotebookDuckDbServiceOptions | null = null;

self.onmessage = async (event: MessageEvent<NotebookWorkerIncomingMessage>) => {
  await workerShell.handleMessage(event.data);
};

async function executeInWorker(
  request: NotebookWorkerExecuteRequest,
  context: NotebookWorkerShellCommandContext<NotebookExecutionProgressEvent>,
): Promise<NotebookWorkerExecuteResponse> {
  const document = request.document;
  const options = {
    ...(request.options ?? {}),
    cellIds: request.options?.cellIds ?? request.cellIds,
  };
  const session = new NotebookSession(document);
  const host: NotebookExecutionHost = {
    getAppTablesSnapshot: () =>
      context.hostRequests.request<NotebookAppTablesSnapshot>(
        "get-app-tables",
        {},
      ),
    readVaultFile: (path: string, sourcePath?: string) =>
      context.hostRequests.request<ArrayBuffer>("read-vault-file", {
        path,
        sourcePath: sourcePath ?? document.sourcePath,
      }),
  };
  const result = await executeNotebookDocument(
    host,
    document,
    session,
    getDuckDbService.bind(null, context),
    options,
    context.postProgress,
  );

  return {
    ...result,
    cellStates: serializeCellStates(document, session, result),
  };
}

async function resolveDuckDbServiceOptions(
  context: NotebookWorkerShellCommandContext<NotebookExecutionProgressEvent>,
): Promise<NotebookDuckDbServiceOptions> {
  duckdbServiceOptions ??= {
    resolveAssetUrl: async (relativePath) =>
      context.hostRequests.request<string>("resolve-plugin-asset-url", {
        relativePath,
      }),
  };
  return duckdbServiceOptions;
}

async function getDuckDbService(
  context: NotebookWorkerShellCommandContext<NotebookExecutionProgressEvent>,
): Promise<NotebookDuckDbService> {
  duckdbService ??= import("./duckdb/notebook-duckdb-service").then(
    async ({ NotebookDuckDbService }) =>
      new NotebookDuckDbService(await resolveDuckDbServiceOptions(context)),
  );
  return duckdbService;
}

function serializeCellStates(
  document: NotebookDocument,
  session: NotebookSession,
  result: NotebookExecutionResult,
): Record<string, AppDatabaseNotebookCellState> {
  // Only include cells that were actually executed so the main thread does not
  // overwrite state (including durationMs) for cells that were not part of this
  // run (e.g. when running a single cell, other cells should keep their timing).
  const executedCellIds = new Set(Object.keys(result.outputs));
  return Object.fromEntries(
    document.cells
      .filter((cell) => executedCellIds.has(cell.id))
      .map((cell) => {
        const state = session.getCellState(cell.id);
        return [
          cell.id,
          {
            state: state.state,
            outputs: state.output ?? result.outputs[cell.id] ?? [],
            error: state.error,
            durationMs: state.durationMs,
            setupPhases: state.setupPhases?.map((phase) => ({
              key: phase.key,
              label: phase.label,
              status: phase.status,
              durationMs: phase.durationMs,
              detail: phase.detail,
            })),
          },
        ];
      }),
  );
}

export default {};
