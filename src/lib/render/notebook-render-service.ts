import type { App, TFile } from "@lapis-notes/api";
import {
  bindNotebookInputNode,
  canReconstructNotebookInput,
  reconstructNotebookInputNode,
  transformObservableViewof,
} from "@lapis-notes/notebook-input";
import type { NotebookCell } from "../model/notebook-cell";
import type { NotebookDocument } from "../model/notebook-document";
import { parseNotebookDocument } from "../parse/parse-notebook-document";
import type { NotebookInputOutput, NotebookOutput } from "../output";
import type {
  NotebookCellExecutionState,
  NotebookCellRuntimeState,
  NotebookExecutionCheckpoint,
  NotebookExecutionPhase,
} from "../runtime/notebook-session";
import type { NotebookSession } from "../runtime/notebook-session";
import type { NotebookRuntimeController } from "../runtime/notebook-runtime-controller";

const logger = {
  debug: (...a: any[]) => console.debug("[notebook.render]", ...a),
  info: (...a: any[]) => console.log("[notebook.render]", ...a),
  warn: (...a: any[]) => console.warn("[notebook.render]", ...a),
  error: (...a: any[]) => console.error("[notebook.render]", ...a),
};
import { type NotebookExecutionOptions } from "../runtime/notebook-worker";
import {
  isNotebookStateFresh,
  loadNotebookPersistedState,
  restoreNotebookPersistedState,
  saveNotebookPersistedState,
} from "../runtime/notebook-output-store";
import {
  createNotebookDomOutputId,
  emitNotebookInputChange,
  claimNotebookDomOutput,
  claimNotebookInputDomOutput,
  registerNotebookDomOutput,
} from "../runtime/notebook-dom-registry";

type NotebookDocumentExecutor = (
  document: NotebookDocument,
  session: NotebookSession,
  options?: NotebookExecutionOptions,
) => Promise<unknown>;

export type RenderedNotebookCell = {
  cell: NotebookCell;
  outputs: NotebookOutput[];
  state: NotebookCellExecutionState;
  loading: boolean;
  error?: string;
  durationMs?: number;
  startedAt?: number;
  statusMessage?: string;
  setupPhases?: NotebookExecutionPhase[];
};

export class NotebookRenderService {
  private readonly hydratedPersistedSessions = new WeakSet<NotebookSession>();
  private readonly executionCheckpoints = new Map<
    string,
    NotebookExecutionCheckpoint
  >();

  constructor(
    private readonly app: App,
    private readonly runtimeController: NotebookRuntimeController,
    private readonly executeDocument: NotebookDocumentExecutor,
    private readonly executionPromises: Map<string, Promise<void>>,
    private readonly onNotebookOutputsChanged?: (
      sourcePath: string,
    ) => Promise<void> | void,
    private readonly cancelNotebookExecution?: (
      sourcePath: string,
    ) => Promise<void> | void,
  ) {}

  async loadNotebookDocument(
    file: TFile,
    sourcePath: string,
  ): Promise<NotebookDocument> {
    const source = await this.app.vault.cachedRead(file);
    return parseNotebookDocument(source, {
      sourcePath,
      frontmatter:
        this.app.metadataCache.getFileCache(file)?.frontmatter?.notebook,
    });
  }

  async getRenderedCell(
    sourcePath: string,
    cellId: string,
  ): Promise<RenderedNotebookCell | null> {
    const file = this.app.vault.getFileByPath(sourcePath);
    if (!file) {
      return null;
    }

    const document = await this.loadNotebookDocument(file, sourcePath);
    if (!document.enabled) {
      return null;
    }

    const cell = document.cells.find((candidate) => candidate.id === cellId);
    if (!cell) {
      return null;
    }

    const session = this.runtimeController.getOrCreateSession(document);
    await this.restorePersistedStateOnce(file, sourcePath, document, session);

    let cellState = this.runtimeController.getCellState(document, cell.id);
    if (this.shouldRecreateRestoredInputCell(sourcePath, cell, cellState)) {
      await this.runCell(sourcePath, cell.id).catch((error) => {
        logger.warn("Failed to recreate restored notebook input DOM", {
          sourcePath,
          cellId: cell.id,
          error,
        });
      });
      cellState = this.runtimeController.getCellState(document, cell.id);
    }

    return {
      cell,
      outputs: cellState.output ?? [],
      state: cellState.state,
      loading: cellState.state === "scheduled" || cellState.state === "running",
      error: cellState.error,
      durationMs: cellState.durationMs,
      startedAt: cellState.startedAt,
      statusMessage: cellState.statusMessage,
      setupPhases: cellState.setupPhases,
    };
  }

  async runCell(sourcePath: string, cellId: string): Promise<void> {
    logger.info("runCell start", { sourcePath, cellId });
    const file = this.app.vault.getFileByPath(sourcePath);
    if (!file) {
      logger.warn("runCell: file not found", { sourcePath });
      return;
    }

    const document = await this.loadNotebookDocument(file, sourcePath);
    if (
      !document.enabled ||
      !document.cells.some((cell) => cell.id === cellId)
    ) {
      logger.warn("runCell: document not enabled or cell not found", {
        sourcePath,
        cellId,
      });
      return;
    }

    const preparedExecution = this.runtimeController.prepareExecution(
      document,
      { cellIds: [cellId] },
    );
    logger.info("runCell execution order", {
      cellId,
      executionOrder: preparedExecution.executionOrder,
    });
    if (preparedExecution.checkpoint) {
      this.executionCheckpoints.set(sourcePath, preparedExecution.checkpoint);
    } else {
      this.executionCheckpoints.delete(sourcePath);
    }

    try {
      await this.executeSessionOnce(file, document, preparedExecution.session, {
        cellIds: [cellId],
      });
      logger.info("runCell complete", { sourcePath, cellId });
    } catch (error) {
      logger.error("runCell failed", { sourcePath, cellId, error });
      this.runtimeController.restoreExecutionCheckpoint(
        sourcePath,
        preparedExecution.checkpoint,
      );
      throw error;
    } finally {
      this.executionCheckpoints.delete(sourcePath);
    }
  }

  async runCells(
    sourcePath: string,
    cellIds: string[],
    options: Pick<NotebookExecutionOptions, "skipDependencyClosure"> = {},
  ): Promise<void> {
    const file = this.app.vault.getFileByPath(sourcePath);
    if (!file || cellIds.length === 0) {
      return;
    }

    const document = await this.loadNotebookDocument(file, sourcePath);
    if (!document.enabled) {
      return;
    }

    const existingCellIds = new Set(document.cells.map((cell) => cell.id));
    const runnableCellIds = cellIds.filter((cellId) =>
      existingCellIds.has(cellId),
    );
    if (runnableCellIds.length === 0) {
      return;
    }

    const executionOptions = {
      cellIds: runnableCellIds,
      skipDependencyClosure: options.skipDependencyClosure,
    } satisfies NotebookExecutionOptions;
    const preparedExecution = this.runtimeController.prepareExecution(
      document,
      executionOptions,
    );
    if (preparedExecution.checkpoint) {
      this.executionCheckpoints.set(sourcePath, preparedExecution.checkpoint);
    } else {
      this.executionCheckpoints.delete(sourcePath);
    }

    try {
      await this.executeSessionOnce(
        file,
        document,
        preparedExecution.session,
        executionOptions,
      );
    } catch (error) {
      this.runtimeController.restoreExecutionCheckpoint(
        sourcePath,
        preparedExecution.checkpoint,
      );
      throw error;
    } finally {
      this.executionCheckpoints.delete(sourcePath);
    }
  }

  async runStaleCells(sourcePath: string): Promise<string[]> {
    const file = this.app.vault.getFileByPath(sourcePath);
    if (!file) {
      return [];
    }

    const document = await this.loadNotebookDocument(file, sourcePath);
    if (!document.enabled) {
      return [];
    }

    const staleCellIds = this.runtimeController.getStaleCellIds(document);
    if (staleCellIds.length === 0) {
      return [];
    }

    await this.runCells(sourcePath, staleCellIds);
    return staleCellIds;
  }

  claimDomOutput(outputId: string): Node | null {
    return claimNotebookDomOutput(outputId);
  }

  claimInputOutput(
    sourcePath: string,
    cellId: string,
    variableName: string,
  ): Node | null {
    return claimNotebookInputDomOutput(sourcePath, cellId, variableName);
  }

  async getOrCreateInputOutput(
    sourcePath: string,
    output: NotebookInputOutput,
  ): Promise<Node | null> {
    const existing = this.claimInputOutput(
      sourcePath,
      output.cellId,
      output.variableName,
    );
    if (existing) {
      return existing;
    }

    const node = await reconstructNotebookInputNode(output);
    if (!node) {
      return null;
    }

    const currentValue = this.runtimeController.getInputValue(
      sourcePath,
      output.variableName,
    );
    const binding = bindNotebookInputNode(node, {
      initialValue: currentValue ?? output.value,
      onChange: (value) => {
        emitNotebookInputChange({
          sourcePath,
          cellId: output.cellId,
          name: output.variableName,
          value,
        });
      },
    });

    if (currentValue !== binding.currentValue) {
      this.runtimeController.updateInputValue(
        sourcePath,
        output.cellId,
        output.variableName,
        binding.currentValue,
      );
    }

    registerNotebookDomOutput({
      outputId: createNotebookDomOutputId(output.cellId, output.variableName),
      sourcePath,
      cellId: output.cellId,
      name: output.variableName,
      role: "input",
      node,
      dispose: binding.dispose,
    });

    return node;
  }

  async cancelExecution(sourcePath: string): Promise<boolean> {
    const pending = this.executionPromises.get(sourcePath);
    if (!pending) {
      return false;
    }

    const checkpoint = this.executionCheckpoints.get(sourcePath);
    this.runtimeController.restoreExecutionCheckpoint(sourcePath, checkpoint);

    await this.cancelNotebookExecution?.(sourcePath);
    await pending.catch(() => undefined);
    return true;
  }

  async clearCellOutput(sourcePath: string, cellId: string): Promise<void> {
    const file = this.app.vault.getFileByPath(sourcePath);
    if (!file) {
      return;
    }

    const document = await this.loadNotebookDocument(file, sourcePath);
    if (
      !document.enabled ||
      !document.cells.some((cell) => cell.id === cellId)
    ) {
      return;
    }

    this.runtimeController.clearCellOutput(document, cellId);
    const session = this.runtimeController.getOrCreateSession(document);
    await saveNotebookPersistedState(this.app, file, session);
    await this.onNotebookOutputsChanged?.(file.path);
  }

  private shouldRecreateRestoredInputCell(
    sourcePath: string,
    cell: NotebookCell,
    cellState: NotebookCellRuntimeState,
  ): boolean {
    if (cellState.state !== "completed") {
      return false;
    }
    if (
      !cellState.inputValues ||
      Object.keys(cellState.inputValues).length === 0
    ) {
      return false;
    }
    if (cell.lang !== "ts" && cell.lang !== "js") {
      return false;
    }

    const outputs = cellState.output ?? [];
    const inputOutputs = outputs.filter((output) => output.kind === "input");
    if (inputOutputs.length > 0) {
      return inputOutputs.some((output) => {
        if (
          this.claimInputOutput(sourcePath, output.cellId, output.variableName)
        ) {
          return false;
        }

        return !canReconstructNotebookInput(output);
      });
    }
    if (outputs.length > 0) {
      return false;
    }

    return transformObservableViewof(cell.source).requiresDom;
  }

  private async executeSessionOnce(
    file: TFile,
    document: NotebookDocument,
    session: NotebookSession,
    options?: { cellIds?: string[] },
  ): Promise<void> {
    const key = file.path;
    const pending = this.executionPromises.get(key);
    if (pending) {
      logger.warn(
        "executeSessionOnce: execution already in progress, waiting",
        { path: key, cellIds: options?.cellIds },
      );
      await pending;
      logger.warn(
        "executeSessionOnce: prior execution finished, returning without re-running",
        { path: key, cellIds: options?.cellIds },
      );
      return;
    }

    const task = this.executeDocument(document, session, options)
      .then(async () => {
        await saveNotebookPersistedState(this.app, file, session);
        await this.onNotebookOutputsChanged?.(file.path);
      })
      .catch((error) => {
        logger.error("executeSessionOnce: execution error", {
          path: key,
          error,
        });
        throw error;
      })
      .finally(() => {
        this.executionPromises.delete(key);
      });
    this.executionPromises.set(key, task);
    await task;
  }

  private async restorePersistedStateOnce(
    file: TFile,
    sourcePath: string,
    document: NotebookDocument,
    session: NotebookSession,
  ): Promise<void> {
    if (
      document.frontmatter?.mode !== "lazy" ||
      this.hydratedPersistedSessions.has(session)
    ) {
      return;
    }

    this.hydratedPersistedSessions.add(session);
    const persistedState = await loadNotebookPersistedState(
      this.app,
      sourcePath,
    );
    if (persistedState) {
      restoreNotebookPersistedState(session, persistedState, {
        trustFileMtime: isNotebookStateFresh(persistedState, file),
      });
    }
  }
}

let activeNotebookRenderService: NotebookRenderService | null = null;

export function registerNotebookRenderService(
  service: NotebookRenderService,
): void {
  activeNotebookRenderService = service;
}

export function unregisterNotebookRenderService(
  service: NotebookRenderService,
): void {
  if (activeNotebookRenderService === service) {
    activeNotebookRenderService = null;
  }
}

export function getNotebookRenderService(): NotebookRenderService | null {
  return activeNotebookRenderService;
}
