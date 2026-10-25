import { transformObservableViewof } from "@lapis-notes/notebook-input";
import { RESERVED_NOTEBOOK_GLOBAL_NAMES } from "@lapis-notes/notebook-stdlib";

const DECLARATION_RE =
  /\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g;
const IDENTIFIER_RE = /\b[A-Za-z_$][\w$]*\b/g;
const RESERVED = new Set([
  ...RESERVED_NOTEBOOK_GLOBAL_NAMES,
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

export interface NotebookCellAnalysis {
  defs: string[];
  refs: string[];
}

export function analyzeTsCell(source: string): NotebookCellAnalysis {
  const transformed = transformObservableViewof(source);
  const code = transformed.code;
  const defs = Array.from(
    code.matchAll(DECLARATION_RE),
    (match) => match[1],
  ).filter(Boolean);
  const defSet = new Set(defs);
  const refs = Array.from(
    code.matchAll(IDENTIFIER_RE),
    (match) => match[0],
  ).filter(
    (name, index, names) =>
      !RESERVED.has(name) &&
      !defSet.has(name) &&
      names.indexOf(name) === index &&
      !code.match(new RegExp(`\\.${name}\\b`)),
  );

  return {
    defs,
    refs,
  };
}
