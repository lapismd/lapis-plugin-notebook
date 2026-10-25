import {
  buildNotebookGraphFromCells,
  type NotebookGraph,
} from "@lapis-notes/notebook-core/graph";
import type { NotebookCell } from "../model/notebook-cell";
import type { NotebookDocument } from "../model/notebook-document";
import { analyzeMdCell } from "./analysis/analyze-md-cell";
import { analyzeSqlCell } from "./analysis/analyze-sql-cell";
import {
  analyzeTsCell,
  type NotebookCellAnalysis,
} from "./analysis/analyze-ts-cell";

export type {
  NotebookGraph,
  NotebookGraphNode,
} from "@lapis-notes/notebook-core/graph";

export function buildNotebookGraph(
  document: NotebookDocument,
): NotebookGraph<NotebookCell> {
  return buildNotebookGraphFromCells(document.cells, analyzeCell);
}

export {
  collectDependencyClosure,
  collectStaleDescendants,
} from "@lapis-notes/notebook-core/graph";

function analyzeCell(cell: NotebookCell): NotebookCellAnalysis {
  switch (cell.lang) {
    case "sql":
      return analyzeSqlCell(cell.source);
    case "md":
    case "html":
      return analyzeMdCell(cell.source);
    default:
      return analyzeTsCell(cell.source);
  }
}
