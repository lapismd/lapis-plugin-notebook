import {
  diagnosticResourceForPath,
  type DiagnosticCollection,
  type WorkspaceDiagnostic,
} from "@lapis-notes/api";
import type { NotebookDocument } from "../model/notebook-document";
import type { NotebookRunSummary } from "./notebook-run-coordinator";

type DiagnosticRun = { id: number; previous: Map<string, WorkspaceDiagnostic> };
/** Adapts notebook failures to the host-owned Problems collection. */
export class NotebookRunDiagnostics {
  private readonly documents = new Map<string, NotebookDocument>();
  private readonly entries = new Map<
    string,
    Map<string, WorkspaceDiagnostic>
  >();
  private readonly runs = new Map<string, DiagnosticRun>();
  constructor(private readonly collection: DiagnosticCollection) {}
  setDocument(document: NotebookDocument): void {
    if (document.sourcePath) this.documents.set(document.sourcePath, document);
  }
  inputError(
    path: string | undefined,
    cellId: string | undefined,
    error: unknown,
  ): void {
    if (!path) return;
    const diagnostics =
      this.entries.get(path) ?? new Map<string, WorkspaceDiagnostic>();
    this.entries.set(path, diagnostics);
    const cell = this.documents
      .get(path)
      ?.cells.find((cell) => cell.id === cellId);
    const line = cell ? Math.max(0, cell.sourceRange.startLine - 1) : undefined;
    diagnostics.set(cellId ?? "__run__", {
      message: error instanceof Error ? error.message : String(error),
      severity: "error",
      source: "Notebook",
      code: cellId ? `cell:${cellId}` : "input",
      range:
        line === undefined
          ? undefined
          : { start: { line, character: 0 }, end: { line, character: 1 } },
    });
    this.collection.set(diagnosticResourceForPath(path), [
      ...diagnostics.values(),
    ]);
  }
  update(summary: NotebookRunSummary): void {
    const path = summary.sourcePath;
    const diagnostics =
      this.entries.get(path) ?? new Map<string, WorkspaceDiagnostic>();
    this.entries.set(path, diagnostics);
    if (this.runs.get(path)?.id !== summary.id) {
      this.runs.set(path, { id: summary.id, previous: new Map(diagnostics) });
      for (const cellId of summary.plannedCellIds) diagnostics.delete(cellId);
      diagnostics.delete("__run__");
    }
    if (summary.outcome === "cancelled") {
      this.entries.set(path, new Map(this.runs.get(path)!.previous));
    } else {
      for (const error of summary.errors) {
        const cell = this.documents
          .get(path)
          ?.cells.find((cell) => cell.id === error.cellId);
        const line = cell
          ? Math.max(0, cell.sourceRange.startLine - 1)
          : undefined;
        diagnostics.set(error.cellId ?? "__run__", {
          message: error.message,
          severity: "error",
          source: "Notebook",
          code: error.cellId ? `cell:${error.cellId}` : "execution",
          range:
            line === undefined
              ? undefined
              : { start: { line, character: 0 }, end: { line, character: 1 } },
        });
      }
    }
    const next = [...this.entries.get(path)!.values()];
    if (next.length) this.collection.set(diagnosticResourceForPath(path), next);
    else this.collection.delete(diagnosticResourceForPath(path));
  }
}
