import { RESERVED_NOTEBOOK_GLOBAL_NAMES } from "@lapis-notes/notebook-stdlib";

const PLACEHOLDER_RE = /\{\{\s*([A-Za-z_$][\w$]*)\s*\}\}/g;
const IDENTIFIER_RE = /\b[A-Za-z_$][\w$]*\b/g;

const RESERVED_EXPRESSION_NAMES = new Set([
  ...RESERVED_NOTEBOOK_GLOBAL_NAMES,
  "Array",
  "Boolean",
  "Date",
  "Error",
  "JSON",
  "Map",
  "Math",
  "Number",
  "Object",
  "Promise",
  "RegExp",
  "Set",
  "String",
  "Symbol",
  "undefined",
  "NaN",
  "Infinity",
  "await",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "default",
  "delete",
  "do",
  "else",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "function",
  "if",
  "import",
  "in",
  "instanceof",
  "let",
  "new",
  "null",
  "return",
  "super",
  "switch",
  "this",
  "throw",
  "true",
  "try",
  "typeof",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

export type NotebookInterpolationExpression = {
  expression: string;
  startOffset: number;
  endOffset: number;
};

export function collectNotebookSourceReferences(source: string): string[] {
  const refs = new Set<string>();
  for (const ref of collectPlaceholderReferences(source)) {
    refs.add(ref);
  }
  for (const interpolation of parseNotebookInterpolationExpressions(source)) {
    for (const ref of collectExpressionReferences(interpolation.expression)) {
      refs.add(ref);
    }
  }
  return Array.from(refs);
}

export function collectPlaceholderReferences(source: string): string[] {
  return Array.from(source.matchAll(PLACEHOLDER_RE), (match) => match[1]);
}

export function parseNotebookInterpolationExpressions(
  source: string,
): NotebookInterpolationExpression[] {
  const expressions: NotebookInterpolationExpression[] = [];
  let offset = 0;

  while (offset < source.length) {
    const start = source.indexOf("${", offset);
    if (start === -1) {
      break;
    }

    const end = findInterpolationEnd(source, start + 2);
    if (end === -1) {
      break;
    }

    expressions.push({
      expression: source.slice(start + 2, end).trim(),
      startOffset: start,
      endOffset: end + 1,
    });
    offset = end + 1;
  }

  return expressions;
}

export async function interpolateNotebookExpressions(
  source: string,
  evaluate: (expression: string) => Promise<unknown>,
  format: (value: unknown) => string,
): Promise<string> {
  const expressions = parseNotebookInterpolationExpressions(source);
  if (expressions.length === 0) {
    return source;
  }

  let rendered = "";
  let cursor = 0;
  for (const interpolation of expressions) {
    rendered += source.slice(cursor, interpolation.startOffset);
    rendered += format(await evaluate(interpolation.expression));
    cursor = interpolation.endOffset;
  }
  rendered += source.slice(cursor);
  return rendered;
}

function collectExpressionReferences(expression: string): string[] {
  const refs = new Set<string>();
  let match: RegExpExecArray | null;
  IDENTIFIER_RE.lastIndex = 0;

  while ((match = IDENTIFIER_RE.exec(expression)) !== null) {
    const name = match[0];
    const previous = expression[match.index - 1];
    if (previous === "." || RESERVED_EXPRESSION_NAMES.has(name)) {
      continue;
    }
    refs.add(name);
  }

  return Array.from(refs);
}

function findInterpolationEnd(source: string, start: number): number {
  let depth = 1;
  let quote: '"' | "'" | "`" | null = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === "\n" || char === "\r") {
        lineComment = false;
      }
      continue;
    }

    if (blockComment) {
      if (char === "*" && next === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === "/" && next === "/") {
      lineComment = true;
      index += 1;
      continue;
    }

    if (char === "/" && next === "*") {
      blockComment = true;
      index += 1;
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}
