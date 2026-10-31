import { snapshotNotebookInputState } from "@lapis-notes/notebook-input";
import { claimNotebookInputDomOutput } from "./notebook-dom-registry";
import type { App, AppDatabaseNotebookState, TFile } from "@lapis-notes/api";
import type { NotebookOutput } from "../output";
import type { NotebookSession } from "./notebook-session";
import type { NotebookCell } from "../model/notebook-cell";
import {
  ensureNotebookId,
  normalizeNotebookId,
  notebookIdentityHasOtherOwner,
  notebookStateKey,
} from "./notebook-identity";

type StoredNotebookState = AppDatabaseNotebookState & { cleared?: true };

const logger = {
  debug: (...a: any[]) => console.debug("[notebook.persistence]", ...a),
  info: (...a: any[]) => console.log("[notebook.persistence]", ...a),
  warn: (...a: any[]) => console.warn("[notebook.persistence]", ...a),
  error: (...a: any[]) => console.error("[notebook.persistence]", ...a),
};

function normalizePersistedValue(value: unknown): unknown {
  if (typeof value === "function" || typeof value === "symbol")
    return undefined;
  if (typeof value === "bigint") {
    const asNumber = Number(value);
    return Number.isSafeInteger(asNumber) ? asNumber : value.toString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizePersistedValue(item));
  }

  if (value && typeof value === "object") {
    if (
      Object.getPrototypeOf(value) !== Object.prototype &&
      Object.getPrototypeOf(value) !== null
    )
      return undefined;
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        normalizePersistedValue(entryValue),
      ]),
    );
  }

  return value;
}

export async function loadNotebookPersistedState(
  app: App,
  sourcePath: string,
  notebookId?: string,
): Promise<AppDatabaseNotebookState | undefined> {
  try {
    const id = normalizeNotebookId(notebookId);
    if (id) {
      const saved = await app.appDatabase.getMeta<StoredNotebookState | null>(
        notebookStateKey(id),
      );
      if (saved === null || saved?.cleared) return undefined;
      if (saved)
        return (await notebookIdentityHasOtherOwner(app, id, sourcePath, saved))
          ? undefined
          : saved;
    }
    return await app.appDatabase.getNotebookState(sourcePath);
  } catch (error) {
    logger.warn("Failed to load notebook persisted state", {
      sourcePath,
      error,
    });
    return undefined;
  }
}

export async function saveNotebookPersistedState(
  app: App,
  file: TFile,
  session: NotebookSession,
): Promise<void> {
  const cells = Object.fromEntries(
    session.document.cells.map((cell) => {
      const state = session.getCellState(cell.id);
      // Clamp transient states to "stale" so that a crash or tab close during
      // execution does not persist "scheduled"/"running" — which would leave
      // the session permanently in-flight on the next load.
      const persistedState =
        state.state === "scheduled" || state.state === "running"
          ? "stale"
          : state.state;
      return [
        cell.id,
        normalizePersistedValue({
          state: persistedState,
          sourceHash: getNotebookCellSourceHash(cell),
          outputs: (state.output ?? []).filter(
            (output) => output.kind !== "dom",
          ) as NotebookOutput[],
          inputValues: (() => {
            const values = session.getCellInputValues(cell.id);
            return values
              ? Object.fromEntries(
                  Object.entries(values).map(([name, value]) => {
                    const node = claimNotebookInputDomOutput(
                      file.path,
                      cell.id,
                      name,
                    );
                    return [
                      name,
                      node ? snapshotNotebookInputState(node) : value,
                    ];
                  }),
                )
              : undefined;
          })(),
          error: state.error,
          durationMs: state.durationMs,
          setupPhases: state.setupPhases?.map((phase) => ({
            key: phase.key,
            label: phase.label,
            status: phase.status,
            durationMs: phase.durationMs,
            detail: phase.detail,
          })),
        }),
      ];
    }),
  ) as AppDatabaseNotebookState["cells"];

  try {
    let id = normalizeNotebookId(session.document.frontmatter?.id);
    if (id) {
      const previous =
        await app.appDatabase.getMeta<AppDatabaseNotebookState | null>(
          notebookStateKey(id),
        );
      if (
        previous &&
        (await notebookIdentityHasOtherOwner(app, id, file.path, previous))
      ) {
        id = await ensureNotebookId(app, file, id);
      }
    } else id = await ensureNotebookId(app, file);
    if (session.document.frontmatter) session.document.frontmatter.id = id;
    await app.appDatabase.setMeta(notebookStateKey(id), {
      sourcePath: file.path,
      mtime: file.stat.mtime,
      updatedAt: Date.now(),
      cells,
    });
  } catch (error) {
    logger.warn("Failed to save notebook persisted state", {
      sourcePath: file.path,
      error,
    });
  }
}

export async function deleteNotebookPersistedState(
  app: App,
  sourcePath: string,
  notebookId?: string,
): Promise<void> {
  try {
    let id = normalizeNotebookId(notebookId);
    if (id) {
      const previous =
        await app.appDatabase.getMeta<StoredNotebookState | null>(
          notebookStateKey(id),
        );
      if (
        previous &&
        (await notebookIdentityHasOtherOwner(app, id, sourcePath, previous))
      ) {
        const file = app.vault.getFileByPath(sourcePath);
        if (!file) return;
        id = await ensureNotebookId(app, file, id);
      }
      await app.appDatabase.setMeta(notebookStateKey(id), {
        sourcePath,
        mtime: 0,
        updatedAt: Date.now(),
        cells: {},
        cleared: true,
      } satisfies StoredNotebookState);
    }
    await app.appDatabase.deleteNotebookState(sourcePath);
  } catch (error) {
    logger.warn("Failed to delete notebook persisted state", {
      sourcePath,
      error,
    });
  }
}

export function restoreNotebookPersistedState(
  session: NotebookSession,
  state: AppDatabaseNotebookState,
  options: { trustFileMtime?: boolean } = {},
): void {
  session.restorePersistedState(state.cells, {
    trustAll: options.trustFileMtime,
    getCellSourceHash: getNotebookCellSourceHash,
  });
}

export function isNotebookStateFresh(
  state: AppDatabaseNotebookState | undefined,
  file: TFile,
): state is AppDatabaseNotebookState {
  return Boolean(state && state.mtime === file.stat.mtime);
}

export function isNotebookCellStateReusable(
  state: AppDatabaseNotebookState | undefined,
  file: TFile,
  cell: NotebookCell,
): boolean {
  if (!state) {
    return false;
  }
  if (state.mtime === file.stat.mtime) {
    return true;
  }

  return state.cells[cell.id]?.sourceHash === getNotebookCellSourceHash(cell);
}

export function getNotebookCellSourceHash(cell: NotebookCell): string {
  return stableStringHash(`${cell.lang}\0${cell.source}`);
}

function stableStringHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
