import type {
  NotebookCell,
  NotebookCellAttributes,
  NotebookCellRange,
} from "../model/notebook-cell";

export function replaceNotebookCellSource(
  documentSource: string,
  cell: Pick<NotebookCell, "sourceRange">,
  nextSource: string,
): string {
  const { startOffset, endOffset } = cell.sourceRange;
  return `${documentSource.slice(0, startOffset)}${nextSource}${documentSource.slice(endOffset)}`;
}

export function replaceNotebookCellAttributes(
  documentSource: string,
  cell: Pick<NotebookCell, "range">,
  nextAttributes: NotebookCellAttributes,
): string {
  const { startOffset, endOffset } = cell.range;
  const headerEnd = documentSource.indexOf("\n", startOffset);
  const lineEnd =
    headerEnd === -1 || headerEnd > endOffset ? endOffset : headerEnd;
  return `${documentSource.slice(0, startOffset)}${serializeNotebookCellOpen(nextAttributes)}${documentSource.slice(lineEnd)}`;
}

export function updateNotebookCellSourceRange(
  range: NotebookCellRange,
  nextSource: string,
): NotebookCellRange {
  const lineBreakCount = nextSource.match(/\n/g)?.length ?? 0;
  return {
    ...range,
    endOffset: range.startOffset + nextSource.length,
    endLine: range.startLine + lineBreakCount,
  };
}

function serializeNotebookCellOpen(attributes: NotebookCellAttributes): string {
  const tokens = [
    `#${attributes.id}`,
    `lang=${JSON.stringify(attributes.lang)}`,
  ];

  if (attributes.run) {
    tokens.push(`run=${attributes.run}`);
  }
  if (attributes.hide) {
    tokens.push("hide");
  }
  if (attributes.folded) {
    tokens.push("folded");
  }
  if (attributes.outputFolded) {
    tokens.push("outputFolded");
  }

  const reservedKeys = new Set([
    "id",
    "lang",
    "run",
    "hide",
    "folded",
    "outputFolded",
  ]);
  const extraEntries = Object.entries(attributes)
    .filter(
      ([key, value]) =>
        !reservedKeys.has(key) && value !== undefined && value !== false,
    )
    .sort(([left], [right]) => left.localeCompare(right));

  for (const [key, value] of extraEntries) {
    if (value === true) {
      tokens.push(key);
      continue;
    }
    tokens.push(`${key}=${JSON.stringify(value)}`);
  }

  return `:::cell{${tokens.join(" ")}}`;
}
