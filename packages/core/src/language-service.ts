const TYPESCRIPT_CELL_LANGUAGES = new Set(["ts", "typescript"]);

export type NotebookLanguageServiceCell = {
  id: string;
  lang: string;
  source: string;
  sourceRange: {
    startLine: number;
    startOffset: number;
  };
};

export type NotebookLanguageServiceDocument = {
  sourcePath?: string;
  cells: NotebookLanguageServiceCell[];
};

export type NotebookVirtualDocumentSegment = {
  cellId: string;
  virtualStartOffset: number;
  virtualEndOffset: number;
  virtualStartLine: number;
  sourceStartLine: number;
  sourceStartOffset: number;
};

export type NotebookVirtualTypeScriptDocument = {
  uri: string;
  languageId: "typescript";
  version: number;
  text: string;
  segments: NotebookVirtualDocumentSegment[];
};

export type NotebookMappedPosition = {
  cellId: string;
  line: number;
  character: number;
};

export type NotebookMappedRange = {
  cellId: string;
  start: NotebookMappedPosition;
  end: NotebookMappedPosition;
};

export function buildNotebookTypeScriptVirtualDocument(
  document: NotebookLanguageServiceDocument,
  version = 0,
): NotebookVirtualTypeScriptDocument {
  const chunks: string[] = [];
  const segments: NotebookVirtualDocumentSegment[] = [];

  for (const cell of document.cells.filter(isTypeScriptCell)) {
    chunks.push(`// --- notebook cell ${cell.id} ---\n`);
    const virtualStartOffset = chunks.join("").length;
    const virtualStartLine = countLines(chunks.join(""));
    chunks.push(cell.source);
    const virtualEndOffset = chunks.join("").length;
    chunks.push("\n");
    segments.push({
      cellId: cell.id,
      virtualStartOffset,
      virtualEndOffset,
      virtualStartLine,
      sourceStartLine: cell.sourceRange.startLine - 1,
      sourceStartOffset: cell.sourceRange.startOffset,
    });
  }

  const sourcePath = document.sourcePath ?? "Untitled.notebook.md";
  return {
    uri: `virtual:///notebooks/${encodeURIComponent(sourcePath)}.ts`,
    languageId: "typescript",
    version,
    text: chunks.join(""),
    segments,
  };
}

export function mapNotebookCellPositionToVirtual(
  virtualDocument: NotebookVirtualTypeScriptDocument,
  cellId: string,
  position: { line: number; character: number },
): { line: number; character: number } | null {
  const segment = virtualDocument.segments.find(
    (candidate) => candidate.cellId === cellId,
  );
  if (!segment) {
    return null;
  }

  return {
    line: segment.virtualStartLine + position.line,
    character: position.character,
  };
}

export function mapVirtualRangeToNotebookCell(
  virtualDocument: NotebookVirtualTypeScriptDocument,
  range: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  },
): NotebookMappedRange | null {
  const startOffset = positionToOffset(virtualDocument.text, range.start);
  const endOffset = positionToOffset(virtualDocument.text, range.end);
  const segment = virtualDocument.segments.find(
    (candidate) =>
      startOffset >= candidate.virtualStartOffset &&
      startOffset <= candidate.virtualEndOffset,
  );
  if (!segment || endOffset > segment.virtualEndOffset) {
    return null;
  }

  return {
    cellId: segment.cellId,
    start: {
      cellId: segment.cellId,
      line: Math.max(range.start.line - segment.virtualStartLine, 0),
      character: range.start.character,
    },
    end: {
      cellId: segment.cellId,
      line: Math.max(range.end.line - segment.virtualStartLine, 0),
      character: range.end.character,
    },
  };
}

function isTypeScriptCell(cell: NotebookLanguageServiceCell): boolean {
  return TYPESCRIPT_CELL_LANGUAGES.has(cell.lang);
}

function countLines(text: string): number {
  return text === "" ? 0 : text.split("\n").length - 1;
}

function positionToOffset(
  text: string,
  position: { line: number; character: number },
): number {
  const lines = text.split("\n");
  const line = Math.min(position.line, lines.length - 1);
  let offset = 0;
  for (let index = 0; index < line; index += 1) {
    offset += lines[index].length + 1;
  }
  return Math.min(offset + position.character, text.length);
}
