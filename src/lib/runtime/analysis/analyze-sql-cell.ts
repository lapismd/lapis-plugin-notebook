import type { NotebookCellAnalysis } from "./analyze-ts-cell";

const PLACEHOLDER_RE = /\{\{\s*([A-Za-z_$][\w$]*)\s*\}\}/g;

export function analyzeSqlCell(source: string): NotebookCellAnalysis {
  return {
    defs: [],
    refs: Array.from(
      source.matchAll(PLACEHOLDER_RE),
      (match) => match[1],
    ).filter((name, index, names) => names.indexOf(name) === index),
  };
}
