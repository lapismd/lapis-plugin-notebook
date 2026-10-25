import { LAPIS_NOTEBOOK_GLOBAL } from "@lapis-notes/notebook-stdlib/builtins";

const VIEW_DECLARATION_RE =
  /^(\s*)(const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*view\s*\(/;

export interface ObservableViewofTransformResult {
  code: string;
  viewDefs: string[];
  requiresDom: boolean;
}

export function transformObservableViewof(
  source: string,
): ObservableViewofTransformResult {
  const lines = source.split("\n");
  const output: string[] = [];
  const viewDefs: string[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const viewMatch = line.match(VIEW_DECLARATION_RE);
    if (!viewMatch) {
      output.push(line);
      continue;
    }

    const indentation = viewMatch[1] ?? "";
    const declaration = viewMatch[2];
    const name = viewMatch[3];
    const expressionStart = line.indexOf("view(");
    const firstExpressionLine = line.slice(expressionStart + "view(".length);
    const expressionLines = [firstExpressionLine];
    let balance = scanExpressionBalance(`(${firstExpressionLine}`);

    while (balance.depth > 0 && index + 1 < lines.length) {
      index += 1;
      const nextLine = lines[index];
      expressionLines.push(nextLine);
      balance = scanExpressionBalance(nextLine, balance);
    }

    const expression = stripTrailingSemicolon(
      stripTrailingViewCall(expressionLines.join("\n")),
    );
    viewDefs.push(name);
    output.push(
      `${indentation}${declaration} ${name} = await ${LAPIS_NOTEBOOK_GLOBAL}.view(${JSON.stringify(name)}, (${expression}));`,
    );
  }

  return {
    code: output.join("\n"),
    viewDefs: Array.from(new Set(viewDefs)),
    requiresDom: viewDefs.length > 0,
  };
}

function stripTrailingSemicolon(source: string): string {
  return source.replace(/;\s*$/, "");
}

function stripTrailingViewCall(source: string): string {
  return source.replace(/\)\s*;?\s*$/, "");
}

interface ScannerState {
  depth: number;
  quote: '"' | "'" | "`" | null;
  escaped: boolean;
  blockComment: boolean;
}

function scanExpressionBalance(
  source: string,
  previous: ScannerState = {
    depth: 0,
    quote: null,
    escaped: false,
    blockComment: false,
  },
): ScannerState {
  const state: ScannerState = { ...previous, escaped: false };

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (state.blockComment) {
      if (char === "*" && next === "/") {
        state.blockComment = false;
        index += 1;
      }
      continue;
    }

    if (state.quote) {
      if (state.escaped) {
        state.escaped = false;
        continue;
      }
      if (char === "\\") {
        state.escaped = true;
        continue;
      }
      if (char === state.quote) {
        state.quote = null;
      }
      continue;
    }

    if (char === "/" && next === "/") {
      break;
    }
    if (char === "/" && next === "*") {
      state.blockComment = true;
      index += 1;
      continue;
    }
    if (char === '"' || char === "'" || char === "`") {
      state.quote = char;
      continue;
    }
    if (char === "(" || char === "[" || char === "{") {
      state.depth += 1;
      continue;
    }
    if (char === ")" || char === "]" || char === "}") {
      state.depth = Math.max(0, state.depth - 1);
    }
  }

  return state;
}
