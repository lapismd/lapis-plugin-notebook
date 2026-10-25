import type {
  NotebookCell,
  NotebookCellAttributes,
  NotebookCellLanguage,
  NotebookCellRange,
  NotebookDocumentBlock,
  NotebookMarkdownBlock,
} from "../model/notebook-cell";
import type { NotebookDocument } from "../model/notebook-document";
import {
  DEFAULT_NOTEBOOK_FRONTMATTER,
  normalizeNotebookFrontmatter,
  type NotebookFrontmatter,
} from "../model/notebook-frontmatter";
import { isNotebookFilePath } from "../notebook-path";

export interface ParseNotebookDocumentOptions {
  sourcePath?: string;
  frontmatter?: unknown;
}

const CELL_OPEN_RE = /^:::cell\{([^}]*)\}[ \t]*$/gm;
const CELL_CLOSE_RE = /^:::[ \t]*$/gm;
const CODE_FENCE_RE = /^```([a-zA-Z0-9_-]+)?\r?\n([\s\S]*?)\r?\n```\s*$/;
const LEADING_BLANK_LINES_RE = /^(?:[ \t]*\r?\n)*/;
const TRAILING_BLANK_LINES_RE = /(?:\r?\n[ \t]*)*$/;

export function parseNotebookDocument(
  source: string,
  options: ParseNotebookDocumentOptions = {},
): NotebookDocument {
  if (!isNotebookFilePath(options.sourcePath)) {
    return {
      enabled: false,
      sourcePath: options.sourcePath,
      frontmatter: null,
      source,
      blocks: [],
      cells: [],
    };
  }

  const frontmatter = resolveFrontmatter(source, options.frontmatter);

  const blocks: NotebookDocumentBlock[] = [];
  const cells: NotebookCell[] = [];
  let cursor = 0;
  let cellIndex = 0;
  let match: RegExpExecArray | null;

  CELL_OPEN_RE.lastIndex = 0;
  while ((match = CELL_OPEN_RE.exec(source)) !== null) {
    const openStart = match.index;
    const openLineEnd = source.indexOf("\n", openStart);
    const contentStart = openLineEnd === -1 ? source.length : openLineEnd + 1;

    CELL_CLOSE_RE.lastIndex = contentStart;
    const closeMatch = CELL_CLOSE_RE.exec(source);
    if (!closeMatch) {
      break;
    }

    const closeStart = closeMatch.index;
    const closeEnd = closeStart + closeMatch[0].length;
    if (cursor < openStart) {
      const markdownBlock = createMarkdownBlock(source, cursor, openStart);
      if (markdownBlock) {
        blocks.push(markdownBlock);
      }
    }

    cellIndex += 1;
    const rawContent = source
      .slice(contentStart, closeStart)
      .replace(/\n$/, "");
    const attributes = parseCellAttributes(match[1], cellIndex, rawContent);
    const sourceRange = resolveCellSourceRange(
      source,
      contentStart,
      rawContent,
      attributes.lang,
    );
    const notebookCell: NotebookCell = {
      id: attributes.id,
      lang: attributes.lang,
      source: normalizeCellSource(attributes.lang, rawContent),
      range: createRange(source, openStart, closeEnd),
      sourceRange,
      attributes,
    };

    cells.push(notebookCell);
    blocks.push({ kind: "cell", cell: notebookCell });
    cursor = closeEnd;
    if (source[cursor] === "\n") {
      cursor += 1;
    }
    CELL_OPEN_RE.lastIndex = cursor;
  }

  if (cursor < source.length) {
    const markdownBlock = createMarkdownBlock(source, cursor, source.length);
    if (markdownBlock) {
      blocks.push(markdownBlock);
    }
  }

  return {
    enabled: true,
    sourcePath: options.sourcePath,
    frontmatter,
    source,
    blocks,
    cells,
  };
}

function resolveFrontmatter(
  source: string,
  frontmatter: unknown,
): NotebookFrontmatter {
  const fromOption = normalizeNotebookFrontmatter(frontmatter);
  if (fromOption) {
    return fromOption;
  }

  const yamlBlock = source.match(/^---\n([\s\S]*?)\n---\n?/);
  if (!yamlBlock) {
    return { ...DEFAULT_NOTEBOOK_FRONTMATTER };
  }

  return (
    parseNotebookFrontmatterFromYaml(yamlBlock[1]) ?? {
      ...DEFAULT_NOTEBOOK_FRONTMATTER,
    }
  );
}

function parseNotebookFrontmatterFromYaml(
  yaml: string,
): NotebookFrontmatter | null {
  const lines = yaml.split(/\r?\n/);
  const notebookIndent = findNotebookIndent(lines);
  if (notebookIndent === null) {
    return null;
  }

  const notebook: Record<string, unknown> = {};
  let index = notebookIndent.index + 1;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) {
      index += 1;
      continue;
    }

    const indent = line.match(/^\s*/)?.[0].length ?? 0;
    if (indent <= notebookIndent.indent) {
      break;
    }

    const trimmed = line.trim();
    if (trimmed === "mounts:") {
      const mounts: Record<string, string> = {};
      index += 1;
      while (index < lines.length) {
        const mountLine = lines[index];
        if (!mountLine.trim()) {
          index += 1;
          continue;
        }

        const mountIndent = mountLine.match(/^\s*/)?.[0].length ?? 0;
        if (mountIndent <= indent) {
          break;
        }

        const [key, value] = splitYamlPair(mountLine.trim());
        if (key && value !== undefined) {
          mounts[key] = stripYamlString(value);
        }
        index += 1;
      }
      notebook.mounts = mounts;
      continue;
    }

    const [key, value] = splitYamlPair(trimmed);
    if (key && value !== undefined) {
      notebook[key] = parseYamlScalar(value);
    }
    index += 1;
  }

  return normalizeNotebookFrontmatter(notebook);
}

function findNotebookIndent(
  lines: string[],
): { index: number; indent: number } | null {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith("notebook:")) {
      continue;
    }

    return {
      index,
      indent: line.match(/^\s*/)?.[0].length ?? 0,
    };
  }

  return null;
}

function splitYamlPair(line: string): [string | null, string | undefined] {
  const delimiter = line.indexOf(":");
  if (delimiter === -1) {
    return [null, undefined];
  }

  const key = line.slice(0, delimiter).trim();
  const value = line.slice(delimiter + 1).trim();
  return [key || null, value];
}

function parseYamlScalar(value: string): string | number | boolean {
  if (/^-?\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  return stripYamlString(value);
}

function stripYamlString(value: string): string {
  return value.replace(/^['"]|['"]$/g, "");
}

function parseCellAttributes(
  rawAttributes: string,
  cellIndex: number,
  rawContent: string,
): NotebookCellAttributes {
  const attributes: Record<string, string | boolean> = {};
  const tokens =
    rawAttributes.match(/#[^\s]+|\w+=(?:"[^"]*"|'[^']*'|[^\s]+)|\w+/g) ?? [];

  for (const token of tokens) {
    if (token.startsWith("#")) {
      attributes.id = token.slice(1);
      continue;
    }

    const delimiter = token.indexOf("=");
    if (delimiter === -1) {
      attributes[token] = true;
      continue;
    }

    const key = token.slice(0, delimiter);
    const value = token.slice(delimiter + 1).replace(/^['"]|['"]$/g, "");
    attributes[key] = value;
  }

  const lang =
    attributes.lang === undefined
      ? inferCellLanguageFromRawContent(rawContent)
      : normalizeCellLanguage(attributes.lang);
  return {
    ...(attributes as Record<string, string | boolean | undefined>),
    id: String(attributes.id ?? `cell-${cellIndex}`),
    lang,
    run: normalizeRunMode(attributes.run),
    hide: attributes.hide === true,
    folded: attributes.folded === true,
    outputFolded: attributes.outputFolded === true,
  };
}

function normalizeCellLanguage(value: unknown): NotebookCellLanguage {
  return value === "js" || value === "sql" || value === "md" || value === "html"
    ? value
    : "ts";
}

function inferCellLanguageFromRawContent(
  rawContent: string,
): NotebookCellLanguage {
  return normalizeCellLanguage(matchFencedCellBody(rawContent)?.fenceLang);
}

function normalizeRunMode(
  value: unknown,
): "autorun" | "lazy" | "manual" | undefined {
  return value === "autorun" || value === "lazy" || value === "manual"
    ? value
    : undefined;
}

function normalizeCellSource(
  lang: NotebookCellLanguage,
  rawContent: string,
): string {
  const fenced = matchFencedCellBody(rawContent);
  if (!fenced) {
    return rawContent;
  }

  if (lang === "md" || lang === "html") {
    return fenced.source;
  }

  const fenceLang = normalizeCellLanguage(fenced.fenceLang);
  return fenceLang === lang ? fenced.source : rawContent;
}

function resolveCellSourceRange(
  source: string,
  contentStart: number,
  rawContent: string,
  lang: NotebookCellLanguage,
): NotebookCellRange {
  const fenced = matchFencedCellBody(rawContent);
  if (!fenced) {
    return createRange(source, contentStart, contentStart + rawContent.length);
  }

  const normalizedFenceLang = normalizeCellLanguage(fenced.fenceLang);
  const preservesFenceBody =
    lang === "md" || lang === "html" || normalizedFenceLang === lang;
  if (!preservesFenceBody) {
    return createRange(source, contentStart, contentStart + rawContent.length);
  }

  const sourceStart = contentStart + fenced.sourceStartOffset;
  const sourceEnd = contentStart + fenced.sourceEndOffset;
  return createRange(source, sourceStart, sourceEnd);
}

function matchFencedCellBody(rawContent: string): {
  fenceLang: string | undefined;
  source: string;
  sourceStartOffset: number;
  sourceEndOffset: number;
} | null {
  const leadingBlankLines = rawContent.match(LEADING_BLANK_LINES_RE)?.[0] ?? "";
  const trailingBlankLines =
    rawContent.match(TRAILING_BLANK_LINES_RE)?.[0] ?? "";
  const trimmedContent = rawContent.slice(
    leadingBlankLines.length,
    rawContent.length - trailingBlankLines.length,
  );
  const fenced = trimmedContent.match(CODE_FENCE_RE);
  if (!fenced) {
    return null;
  }

  const firstLineEnd = trimmedContent.indexOf("\n");
  const closingFenceStart = trimmedContent.lastIndexOf("\n```");
  if (
    firstLineEnd === -1 ||
    closingFenceStart === -1 ||
    closingFenceStart <= firstLineEnd
  ) {
    return null;
  }

  return {
    fenceLang: fenced[1],
    source: fenced[2],
    sourceStartOffset: leadingBlankLines.length + firstLineEnd + 1,
    sourceEndOffset: leadingBlankLines.length + closingFenceStart,
  };
}

function createMarkdownBlock(
  source: string,
  startOffset: number,
  endOffset: number,
): NotebookMarkdownBlock | null {
  const raw = source.slice(startOffset, endOffset);
  if (!raw.trim()) {
    return null;
  }

  return {
    kind: "markdown",
    source: raw,
    range: createRange(source, startOffset, endOffset),
  };
}

function createRange(source: string, startOffset: number, endOffset: number) {
  return {
    startOffset,
    endOffset,
    startLine: offsetToLine(source, startOffset),
    endLine: offsetToLine(source, endOffset),
  };
}

function offsetToLine(source: string, offset: number): number {
  return source.slice(0, offset).split("\n").length;
}
