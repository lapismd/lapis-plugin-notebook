import type { NotebookCellAnalysis } from "./analyze-ts-cell";
import { collectNotebookSourceReferences } from "../interpolation";

export function analyzeMdCell(source: string): NotebookCellAnalysis {
  return {
    defs: [],
    refs: collectNotebookSourceReferences(source),
  };
}
