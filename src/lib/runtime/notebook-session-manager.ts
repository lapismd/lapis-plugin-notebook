import { EventDispatcher } from "@lapis-notes/api";

const logger = {
  debug: (...a: any[]) => console.debug("[notebook.session-manager]", ...a),
  info: (...a: any[]) => console.log("[notebook.session-manager]", ...a),
  warn: (...a: any[]) => console.warn("[notebook.session-manager]", ...a),
  error: (...a: any[]) => console.error("[notebook.session-manager]", ...a),
};
import type { NotebookDocument } from "../model/notebook-document";
import {
  createIdleExecutionState,
  type NotebookSessionChangeReason,
  type NotebookExecutionRunState,
  NotebookSession,
} from "./notebook-session";

export class NotebookSessionManager extends EventDispatcher<{
  changed: [sourcePath: string, reason: NotebookSessionChangeReason];
}> {
  private readonly sessions = new Map<string, NotebookSession>();

  getOrCreate(document: NotebookDocument): NotebookSession {
    const key = document.sourcePath ?? "__untitled__";
    const existing = this.sessions.get(key);
    if (existing) {
      const changed = existing.updateDocument(document);
      if (changed.length > 0) {
        logger.debug("session updated: cells changed", {
          key,
          changedCellIds: changed,
        });
      }
      return existing;
    }

    logger.info("session created", { key });
    const session = new NotebookSession(document, (reason) => {
      this.trigger("changed", key, reason);
    });
    this.sessions.set(key, session);
    return session;
  }

  get(sourcePath: string): NotebookSession | undefined {
    return this.sessions.get(sourcePath);
  }

  getExecutionState(sourcePath: string): NotebookExecutionRunState {
    return (
      this.sessions.get(sourcePath)?.getExecutionState() ??
      createIdleExecutionState()
    );
  }

  delete(sourcePath: string): void {
    const session = this.sessions.get(sourcePath);
    session?.invalidateAllCells();
    this.sessions.delete(sourcePath);
  }
}
