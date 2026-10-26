import { Notice, type App, type Editor, type TFile } from "@lapis-notes/api";
import { getActiveNotebookFile } from "../notebook-file";
import type { NotebookCell } from "../model/notebook-cell";
import { parseNotebookDocument } from "../parse/parse-notebook-document";
import { saveNotebookPersistedState } from "../runtime/notebook-output-store";
import type { NotebookRuntimeController } from "../runtime/notebook-runtime-controller";
import type { NotebookSession } from "../runtime/notebook-session";

type NotebookRuntime = {
  executeDocument: (
    document: ActiveNotebookContext["document"],
    session: NotebookSession,
    options?: { cellIds?: string[]; skipDependencyClosure?: boolean },
  ) => Promise<unknown>;
};

type NotebookRunScope = "all" | "current" | "stale";

interface ActiveNotebookContext {
  file: TFile;
  source: string;
  persistState: boolean;
  document: ReturnType<typeof parseNotebookDocument>;
  editor: Editor | null;
}

interface ActiveNotebookView {
  file?: TFile;
  editor?: Editor;
}

export async function runActiveNotebook(
  app: App,
  runtimeController: NotebookRuntimeController,
  runtime: NotebookRuntime,
): Promise<TFile | null> {
  return executeActiveNotebook(app, runtimeController, runtime, "all");
}

export async function runCurrentNotebookCell(
  app: App,
  runtimeController: NotebookRuntimeController,
  runtime: NotebookRuntime,
): Promise<TFile | null> {
  return executeActiveNotebook(app, runtimeController, runtime, "current");
}

export async function runStaleNotebookCells(
  app: App,
  runtimeController: NotebookRuntimeController,
  runtime: NotebookRuntime,
): Promise<TFile | null> {
  return executeActiveNotebook(app, runtimeController, runtime, "stale");
}

async function executeActiveNotebook(
  app: App,
  runtimeController: NotebookRuntimeController,
  runtime: NotebookRuntime,
  scope: NotebookRunScope,
): Promise<TFile | null> {
  const context = await loadActiveNotebookContext(app);
  if (!context) {
    return null;
  }

  const cellIds = resolveCellIds(scope, context, runtimeController);
  if (scope !== "all" && (!cellIds || cellIds.length === 0)) {
    return null;
  }

  const preparedExecution = runtimeController.prepareExecution(
    context.document,
    { cellIds },
  );

  try {
    await runtime.executeDocument(context.document, preparedExecution.session, {
      cellIds,
    });
  } catch (error) {
    runtimeController.restoreExecutionCheckpoint(
      context.document.sourcePath ?? context.file.path,
      preparedExecution.checkpoint,
    );
    throw error;
  }

  if (context.persistState) {
    await saveNotebookPersistedState(
      app,
      context.file,
      preparedExecution.session,
    );
  }

  new Notice(successMessage(scope, context.persistState));
  return context.file;
}

async function loadActiveNotebookContext(
  app: App,
): Promise<ActiveNotebookContext | null> {
  const safeModeApp = app as App & {
    safeMode?: { disableNotebookExecution?: boolean };
  };
  if (
    app.contextKeys?.get("safeMode.notebookExecutionDisabled") === true ||
    safeModeApp.safeMode?.disableNotebookExecution === true
  ) {
    new Notice("Notebook execution is disabled while Safe Mode is active");
    return null;
  }

  const file = getActiveNotebookFile(
    app,
    "Notebook execution is only available for notebook notes",
  );
  if (!file) {
    return null;
  }

  const cachedSource = await app.vault.cachedRead(file);
  const view = app.workspace.activeLeaf?.view as ActiveNotebookView | undefined;
  const editor = view?.file?.path === file.path ? (view.editor ?? null) : null;
  const source = editor?.getValue() ?? cachedSource;
  const document = parseNotebookDocument(source, {
    sourcePath: file.path,
    frontmatter: app.metadataCache.getFileCache(file)?.frontmatter?.notebook,
  });
  if (!document.enabled) {
    new Notice("Open a notebook note before running this command");
    return null;
  }

  return {
    file,
    source,
    persistState:
      normalizeComparableSource(source) ===
      normalizeComparableSource(cachedSource),
    document,
    editor,
  };
}

function resolveCellIds(
  scope: NotebookRunScope,
  context: ActiveNotebookContext,
  runtimeController: NotebookRuntimeController,
): string[] | undefined {
  if (scope === "all") {
    return undefined;
  }

  if (scope === "current") {
    if (!context.editor) {
      new Notice(
        "Run current cell is only available in markdown source or live preview",
      );
      return [];
    }

    const cell = findCellAtCursor(context.editor, context.document.cells);
    if (!cell) {
      new Notice("Place the cursor inside a notebook cell to run it");
      return [];
    }

    return [cell.id];
  }

  const staleCellIds = runtimeController.getStaleCellIds(context.document);
  if (staleCellIds.length === 0) {
    new Notice("No stale notebook cells to run");
  }
  return staleCellIds;
}

function findCellAtCursor(
  editor: Editor,
  cells: NotebookCell[],
): NotebookCell | null {
  const offset = editor.posToOffset(editor.getCursor("head"));
  return (
    cells.find(
      (cell) =>
        offset >= cell.range.startOffset && offset <= cell.range.endOffset,
    ) ?? null
  );
}

function successMessage(scope: NotebookRunScope, persisted: boolean): string {
  const base =
    scope === "all"
      ? "Ran notebook"
      : scope === "current"
        ? "Ran current notebook cell"
        : "Ran stale notebook cells";
  return persisted ? base : `${base} from unsaved editor content`;
}

function normalizeComparableSource(source: string): string {
  return source.replace(/\r\n/g, "\n").replace(/\n$/, "");
}
